import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Evolution API returns QR in different fields depending on version
// v1: { base64: '...' } | v2: { qrcode: { base64: '...' } } | some: { qrcode: { code: '...' } }
function extractQrCode(data: Record<string, unknown>): string | null {
  if (typeof data?.base64 === 'string') return data.base64
  const qr = data?.qrcode as Record<string, unknown> | undefined
  if (typeof qr?.base64 === 'string') return qr.base64
  if (typeof qr?.code === 'string') return qr.code
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const bodyConfig = await req.json()
    const { action, instanceName, atendenteId, atendenteNome, phoneNumber } = bodyConfig
    // Fallback: Use body variables, otherwise Deno.env
    const evolutionApiUrl = bodyConfig.evolutionApiUrl || Deno.env.get('EVOLUTION_URL')
    const apiKey = bodyConfig.apiKey || Deno.env.get('EVOLUTION_API')

    if (action === 'create_instance') {
      if (!evolutionApiUrl || !apiKey) {
        return new Response(JSON.stringify({ error: 'Evolution API credentials missing' }), { status: 400, headers: corsHeaders })
      }

      let qrcode = null
      let status = 'disconnected'

      try {
        // 1. Tentar criar a instância na Evolution API PRIMEIRO
        const createRes = await fetch(`${evolutionApiUrl}/instance/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
          body: JSON.stringify({
            instanceName,
            integration: 'WHATSAPP-BAILEYS',
            qrcode: true,
            webhook: {
              url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/whatsapp-webhook`,
              events: ['messages.upsert', 'connection.update'],
            },
          }),
        })

        const createData = await createRes.json()

        if (!createRes.ok) {
          // Instância já existe, tenta conectar
          const connectRes = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
            method: 'GET',
            headers: { 'apikey': apiKey },
          })
          const connectData = await connectRes.json()
          qrcode = extractQrCode(connectData)
          status = connectData.instance?.state || 'connecting'
          console.log('connect fallback response keys:', Object.keys(connectData), 'qrcode found:', !!qrcode)
        } else {
          qrcode = extractQrCode(createData)
          status = 'connecting'
          console.log('create_instance response keys:', Object.keys(createData), 'qrcode found:', !!qrcode)
        }

        // 2. Após gerar a instância com sucesso na Evolution, salvamos no Banco de Dados
        console.log('Creating instance table text:', instanceName, evolutionApiUrl, apiKey, atendenteId, atendenteNome, phoneNumber)
        const { data: channel, error } = await supabase
          .from('whatsapp_channels')
          .upsert({
            instance_name: instanceName,
            evolution_api_url: evolutionApiUrl,
            api_key: apiKey,
            atendente_id: atendenteId,
            atendente_nome: atendenteNome,
            phone_number: phoneNumber,
            status: status === 'open' ? 'connected' : status,
          }, { onConflict: 'instance_name' })
          .select()
          .single()

        if (error) {
           throw new Error('Falha ao inserir no supabase: ' + error.message)
        }

        return new Response(JSON.stringify({ 
          ok: true, 
          channel, 
          qrcode,
          status
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      } catch (evoError: any) {
        console.error('Evolution API error:', evoError)
        return new Response(JSON.stringify({ 
          ok: false, 
          error_evolution: 'Não foi possível conectar à Evolution API ou salvar a instância: ' + (evoError.message || evoError),
          status: 'disconnected'
        }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }
    }

    if (action === 'check_status') {
      const { data: channel } = await supabase
        .from('whatsapp_channels')
        .select('*')
        .eq('instance_name', instanceName)
        .single()

      if (!channel) {
        return new Response(JSON.stringify({ error: 'Channel not found' }), { 
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const eUrl = channel.evolution_api_url || Deno.env.get('EVOLUTION_URL')
      const eKey = channel.api_key || Deno.env.get('EVOLUTION_API')

      // If Evolution API is configured, check live status
      if (eUrl && eKey) {
        try {
          const statusRes = await fetch(`${eUrl}/instance/connectionState/${instanceName}`, {
            headers: { 'apikey': eKey },
          })
          const statusData = await statusRes.json()
          const state = statusData.instance?.state || 'disconnected'
          const status = state === 'open' ? 'connected' : state === 'close' ? 'disconnected' : 'connecting'

          await supabase
            .from('whatsapp_channels')
            .update({ status })
            .eq('id', channel.id)

          return new Response(JSON.stringify({ ok: true, channel: { ...channel, status } }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          })
        } catch {
          return new Response(JSON.stringify({ ok: true, channel }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          })
        }
      }

      return new Response(JSON.stringify({ ok: true, channel }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'get_qrcode') {
      const { data: channel } = await supabase
        .from('whatsapp_channels')
        .select('*')
        .eq('instance_name', instanceName)
        .single()

      const eUrl = channel?.evolution_api_url || Deno.env.get('EVOLUTION_URL')
      const eKey = channel?.api_key || Deno.env.get('EVOLUTION_API')

      if (!eUrl || !eKey) {
        return new Response(JSON.stringify({ error: 'Evolution API not configured' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const connectRes = await fetch(`${eUrl}/instance/connect/${instanceName}`, {
        headers: { 'apikey': eKey },
      })
      const connectData = await connectRes.json()

      const qrcode = extractQrCode(connectData)
      console.log('get_qrcode response keys:', Object.keys(connectData), 'qrcode found:', !!qrcode)
      return new Response(JSON.stringify({ 
        ok: true, 
        qrcode,
        status: connectData.instance?.state || 'connecting'
      }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'list_channels') {
      const { data: channels } = await supabase
        .from('whatsapp_channels')
        .select('*')
        .order('created_at', { ascending: false })

      return new Response(JSON.stringify({ ok: true, channels: channels || [] }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (action === 'delete_channel') {
      await supabase.from('whatsapp_channels').delete().eq('instance_name', instanceName)
      return new Response(JSON.stringify({ ok: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { 
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error('Connect error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
