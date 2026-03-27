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

    const { action, instanceName, evolutionApiUrl, apiKey, atendenteId, atendenteNome, phoneNumber } = await req.json()

    if (action === 'create_instance') {
      // Register the channel in our DB
      const { data: channel, error } = await supabase
        .from('whatsapp_channels')
        .upsert({
          instance_name: instanceName,
          evolution_api_url: evolutionApiUrl,
          api_key: apiKey,
          atendente_id: atendenteId,
          atendente_nome: atendenteNome,
          phone_number: phoneNumber,
          status: 'connecting',
        }, { onConflict: 'instance_name' })
        .select()
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // If Evolution API URL is provided, create instance and get QR code
      if (evolutionApiUrl && apiKey) {
        try {
          // Create instance on Evolution API
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
            // Instance might already exist, try to connect
            const connectRes = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
              method: 'GET',
              headers: { 'apikey': apiKey },
            })
            const connectData = await connectRes.json()

            const qrcode = extractQrCode(connectData)
            console.log('connect fallback response keys:', Object.keys(connectData), 'qrcode found:', !!qrcode)
            return new Response(JSON.stringify({ 
              ok: true, 
              channel, 
              qrcode,
              status: connectData.instance?.state || 'connecting'
            }), { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            })
          }

          const qrcode = extractQrCode(createData)
          console.log('create_instance response keys:', Object.keys(createData), 'qrcode found:', !!qrcode)
          return new Response(JSON.stringify({ 
            ok: true, 
            channel, 
            qrcode,
            status: 'connecting'
          }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          })
        } catch (evoError) {
          console.error('Evolution API error:', evoError)
          return new Response(JSON.stringify({ 
            ok: true, 
            channel, 
            error_evolution: 'Não foi possível conectar à Evolution API. Verifique a URL e a chave.',
            status: 'disconnected'
          }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          })
        }
      }

      return new Response(JSON.stringify({ ok: true, channel, status: 'disconnected' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
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

      // If Evolution API is configured, check live status
      if (channel.evolution_api_url && channel.api_key) {
        try {
          const statusRes = await fetch(`${channel.evolution_api_url}/instance/connectionState/${instanceName}`, {
            headers: { 'apikey': channel.api_key },
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

      if (!channel?.evolution_api_url || !channel?.api_key) {
        return new Response(JSON.stringify({ error: 'Evolution API not configured' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      const connectRes = await fetch(`${channel.evolution_api_url}/instance/connect/${instanceName}`, {
        headers: { 'apikey': channel.api_key },
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
