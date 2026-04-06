import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Constantes ──────────────────────────────────────────────────────────────
// Instance name do número SAC (o número que o cliente contata)
const SAC_INSTANCE = 'tfa-a91ddc66'

// ─── Helper: envia mensagem via Evolution API ────────────────────────────────
async function enviarMensagem(
  evolutionUrl: string,
  apiKey: string,
  instanceName: string,
  numero: string,        // número destino no formato 5511999999999 (sem @)
  texto: string
): Promise<boolean> {
  try {
    const phoneClean = numero.replace('@s.whatsapp.net', '').replace('@g.us', '')
    const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      body: JSON.stringify({ number: phoneClean, text: texto }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error(`[enviarMensagem] Falhou (${res.status}):`, err)
      return false
    }
    return true
  } catch (e) {
    console.error('[enviarMensagem] Erro de rede:', e)
    return false
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL') || 'https://evolution.innovatedigitals.com.br'
    const EVOLUTION_API = Deno.env.get('EVOLUTION_API') || ''

    const body = await req.json()
    console.log('[Webhook] Evento recebido:', body.event, '| Instância:', body.instance)

    const event    = body.event
    const instance = body.instance
    const data     = body.data

    // ── 1. messages.upsert ───────────────────────────────────────────────────
    if (event === 'messages.upsert') {
      const remoteJid      = data?.key?.remoteJid
      const fromMe         = data?.key?.fromMe || false
      const mensagemTexto  = data?.message?.conversation
        || data?.message?.extendedTextMessage?.text
        || data?.message?.imageMessage?.caption
        || '[Mídia]'
      const pushName  = data?.pushName || ''
      const messageId = data?.key?.id

      // Ignora broadcasts e status
      if (!remoteJid || remoteJid === 'status@broadcast') {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Ignora mensagens enviadas pelo próprio sistema (fromMe)
      if (fromMe) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const contactPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')

      // ── Localiza o canal pelo instance_name ──────────────────────────────
      const { data: channel } = await supabase
        .from('whatsapp_channels')
        .select('*')
        .eq('instance_name', instance)
        .maybeSingle()

      if (!channel) {
        console.error('[Webhook] Canal não encontrado para instância:', instance)
        return new Response(JSON.stringify({ error: 'Channel not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── Verifica se já existe conversa com este contato ──────────────────
      const { data: conversaExistente } = await supabase
        .from('conversations')
        .select('*')
        .eq('channel_id', channel.id)
        .eq('remote_jid', remoteJid)
        .maybeSingle()

      // ── NOVO CONTATO no SAC → Round-Robin ────────────────────────────────
      if (!conversaExistente && instance === SAC_INSTANCE) {
        console.log('[Webhook] Novo contato no SAC. Iniciando round-robin...')

        // Chama a função atômica do Supabase
        const { data: atendenteId, error: rpcError } = await supabase
          .rpc('proxima_da_fila')

        if (rpcError) {
          console.error('[Webhook] Erro no proxima_da_fila:', rpcError)
        }

        let atendenteSelecionado: any = null

        if (atendenteId) {
          const { data: atendente } = await supabase
            .from('atendentes')
            .select('*')
            .eq('id', atendenteId)
            .single()

          atendenteSelecionado = atendente
          console.log('[Webhook] Atendente selecionado:', atendente?.nome)
        }

        // Cria conversa vinculada ao atendente selecionado
        const { data: novaConversa, error: convCreateErr } = await supabase
          .from('conversations')
          .insert({
            channel_id: channel.id,
            remote_jid: remoteJid,
            contact_name: pushName || contactPhone,
            contact_phone: contactPhone,
            atendente_id: atendenteSelecionado?.id ?? null,
            atendente_nome: atendenteSelecionado?.nome ?? null,
            status: 'ABERTA',
            unread_count: 1,
            last_message: mensagemTexto,
            last_message_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (convCreateErr) {
          console.error('[Webhook] Erro ao criar conversa:', convCreateErr)
          return new Response(JSON.stringify({ error: convCreateErr.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Salva a mensagem do cliente
        await supabase.from('messages').insert({
          conversation_id: novaConversa!.id,
          origin: 'LEAD',
          content: mensagemTexto,
          sender_name: pushName || contactPhone,
          sender_phone: contactPhone,
          whatsapp_message_id: messageId,
        })

        // ── Encaminha para o WhatsApp do atendente via SAC ────────────────
        if (atendenteSelecionado?.telefone && EVOLUTION_API) {
          const sacApiKey   = channel.api_key   || EVOLUTION_API
          const sacEvoUrl   = channel.evolution_api_url || EVOLUTION_URL

          const notificacao =
            `📨 *Novo cliente do SAC*\n` +
            `👤 Nome: ${pushName || 'Desconhecido'}\n` +
            `📱 Telefone: ${contactPhone}\n\n` +
            `💬 Mensagem:\n_${mensagemTexto}_\n\n` +
            `_Responda pelo painel TFA Viagens._`

          const encaminhado = await enviarMensagem(
            sacEvoUrl,
            sacApiKey,
            SAC_INSTANCE,                      // enviamos a partir do SAC
            atendenteSelecionado.telefone,      // para o número do atendente
            notificacao
          )

          console.log('[Webhook] Notificação encaminhada ao atendente:', encaminhado)
        } else {
          console.warn('[Webhook] Atendente sem telefone cadastrado ou EVOLUTION_API não configurada. Notificação não enviada.')
        }

        return new Response(JSON.stringify({ ok: true, distribuido_para: atendenteSelecionado?.nome ?? 'fila_espera' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── CONVERSA EXISTENTE → só registra a mensagem ──────────────────────
      const conversa = conversaExistente ?? null

      if (!conversa) {
        // Canal que não é SAC e conversa não existe: cria normalmente sem round-robin
        const { data: novaConversa, error: convErr } = await supabase
          .from('conversations')
          .insert({
            channel_id: channel.id,
            remote_jid: remoteJid,
            contact_name: pushName || contactPhone,
            contact_phone: contactPhone,
            atendente_id: channel.atendente_id ?? null,
            atendente_nome: channel.atendente_nome ?? null,
            status: 'ABERTA',
            unread_count: 1,
            last_message: mensagemTexto,
            last_message_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (convErr) {
          return new Response(JSON.stringify({ error: convErr.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        await supabase.from('messages').insert({
          conversation_id: novaConversa!.id,
          origin: 'LEAD',
          content: mensagemTexto,
          sender_name: pushName || contactPhone,
          sender_phone: contactPhone,
          whatsapp_message_id: messageId,
        })

        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Conversa existente: atualiza e adiciona mensagem
      await supabase
        .from('conversations')
        .update({
          last_message: mensagemTexto,
          last_message_at: new Date().toISOString(),
          contact_name: pushName || conversa.contact_name,
          unread_count: (conversa.unread_count ?? 0) + 1,
        })
        .eq('id', conversa.id)

      await supabase.from('messages').insert({
        conversation_id: conversa.id,
        origin: 'LEAD',
        content: mensagemTexto,
        sender_name: pushName || contactPhone,
        sender_phone: contactPhone,
        whatsapp_message_id: messageId,
      })

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── 2. connection.update ─────────────────────────────────────────────────
    if (event === 'connection.update') {
      const state = data?.state
      if (state && instance) {
        const status = state === 'open' ? 'connected' : state === 'close' ? 'disconnected' : 'connecting'
        await supabase
          .from('whatsapp_channels')
          .update({ status })
          .eq('instance_name', instance)
        console.log('[Webhook] Status atualizado para instância', instance, '→', status)
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, info: 'evento ignorado' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[Webhook] Erro crítico:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
