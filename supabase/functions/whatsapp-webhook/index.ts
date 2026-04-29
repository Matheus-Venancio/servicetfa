import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SAC_INSTANCE = 'sactfa'

async function enviarMensagem(
  evolutionUrl: string,
  apiKey: string,
  instanceName: string,
  numero: string,
  texto: string
): Promise<boolean> {
  try {
    const phoneClean = numero.replace('@s.whatsapp.net', '').replace(/[^0-9]/g, '')
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const ok = (data = {}) => new Response(JSON.stringify({ ok: true, ...data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  const erro = (msg: string, status = 500) => new Response(JSON.stringify({ ok: false, error: msg }), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const EVOLUTION_URL = Deno.env.get('EVOLUTION_URL') || 'https://evolution.innovatedigitals.com.br'
    const EVOLUTION_API = Deno.env.get('EVOLUTION_API') || 'd3b7573358045479207c1e94adfbf4a3'

    let body: any
    try {
      body = await req.json()
    } catch {
      return ok({ info: 'body inválido ignorado' })
    }

    const event    = (body.event || '').toLowerCase().replace('.', '_')
    const instance = body.instance
    const data     = body.data

    console.log(`[Webhook] event=${event} instance=${instance}`)

    // ── connection_update ────────────────────────────────────────────────────
    if (event === 'connection_update') {
      const state = data?.state
      if (state && instance) {
        const status = state === 'open' ? 'connected'
          : state === 'close' ? 'disconnected'
          : 'connecting'
        await supabase
          .from('whatsapp_channels')
          .update({ status })
          .eq('instance_name', instance)
        console.log(`[Webhook] Canal ${instance} → ${status}`)
      }
      return ok()
    }

    // ── messages_upsert ──────────────────────────────────────────────────────
    if (event === 'messages_upsert') {
      const remoteJid     = data?.key?.remoteJid
      const fromMe        = data?.key?.fromMe || false
      const pushName      = data?.pushName?.trim() || null
      const messageId     = data?.key?.id
      const mensagemTexto =
        data?.message?.conversation ||
        data?.message?.extendedTextMessage?.text ||
        data?.message?.imageMessage?.caption ||
        '[Mídia]'

      // Ignora broadcasts, grupos e mensagens enviadas pelo SAC
      if (
        !remoteJid ||
        remoteJid === 'status@broadcast' ||
        remoteJid.endsWith('@g.us') ||
        fromMe
      ) {
        return ok({ info: 'ignorado' })
      }

      // Só processa mensagens do SAC
      if (instance !== SAC_INSTANCE) {
        console.log(`[Webhook] Instância ${instance} ignorada — não é o SAC`)
        return ok({ info: 'instância ignorada' })
      }

      const telefone = remoteJid
        .replace('@s.whatsapp.net', '')
        .replace('@lid', '')
        .replace(/[^0-9]/g, '')

      // ── Verifica se lead já existe ────────────────────────────────────────
      const { data: leadExistente } = await supabase
        .from('leads')
        .select('*')
        .eq('telefone', telefone)
        .maybeSingle()

      if (!leadExistente) {
        // ── NOVO LEAD → Round-Robin ───────────────────────────────────────
        console.log(`[Webhook] Novo lead: ${telefone} (${pushName}). Iniciando round-robin...`)

        const { data: atendenteId, error: rpcErr } = await supabase.rpc('proxima_da_fila')
        if (rpcErr) console.error('[Webhook] Erro proxima_da_fila:', rpcErr)

        let atendente: any = null
        if (atendenteId) {
          const { data: a } = await supabase
            .from('atendentes')
            .select('*')
            .eq('id', atendenteId)
            .single()
          atendente = a
          console.log(`[Webhook] Atendente selecionado: ${atendente?.nome}`)
        }

        // Insere lead na tabela
        const { data: novoLead, error: insertErr } = await supabase
          .from('leads')
          .insert({
            nome: pushName,
            telefone,
            status: atendenteId ? 'EM_ATENDIMENTO' : 'AGUARDANDO',
            canal_origem: 'ORGANICO',
            atendente_id: atendenteId || null,
            ultima_mensagem: mensagemTexto,
          })
          .select()
          .single()

        if (insertErr) {
          console.error('[Webhook] Erro ao criar lead:', insertErr)
          return erro('Erro ao criar lead: ' + insertErr.message)
        }

        console.log(`[Webhook] Lead criado: ${novoLead.id}`)

        // ── Notifica atendente via instância DELE ─────────────────────────
        if (atendente?.telefone) {
          // Busca canal/instância do atendente
          const { data: canalAtendente } = await supabase
            .from('whatsapp_channels')
            .select('instance_name, evolution_api_url, api_key')
            .eq('atendente_id', atendente.id)
            .maybeSingle()

          const instanciaEnvio = canalAtendente?.instance_name || SAC_INSTANCE
          const urlEnvio       = canalAtendente?.evolution_api_url || EVOLUTION_URL
          const keyEnvio       = canalAtendente?.api_key || EVOLUTION_API

          const linkWaMe = `https://wa.me/${telefone}?text=${encodeURIComponent(`Olá ${pushName || ''}! Atendendo pelo TFA Viagens.`)}`

          const notificacao =
            `🔔 *Novo lead no SAC TFA Viagens*\n\n` +
            `👤 *Nome:* ${pushName || 'Desconhecido'}\n` +
            `📞 *Telefone:* ${telefone}\n` +
            `💬 *Mensagem:* ${mensagemTexto}\n\n` +
            `👆 Toque para responder:\n${linkWaMe}`

          const enviou = await enviarMensagem(
            urlEnvio,
            keyEnvio,
            instanciaEnvio,
            atendente.telefone,
            notificacao
          )

          console.log(`[Webhook] Notificação ao atendente ${atendente.nome} via ${instanciaEnvio}: ${enviou ? 'OK' : 'FALHOU'}`)
        } else {
          console.warn('[Webhook] Atendente sem telefone — notificação não enviada')
        }

        // ── Confirmação automática ao cliente ─────────────────────────────
        await enviarMensagem(
          EVOLUTION_URL,
          EVOLUTION_API,
          SAC_INSTANCE,
          telefone,
          `Olá${pushName ? ` ${pushName}` : ''}! 😊\n\nRecebemos sua mensagem e já notificamos nossa equipe. Em breve um atendente entrará em contato com você.`
        )

        return ok({ distribuido_para: atendente?.nome ?? 'fila_espera' })
      }

      // ── LEAD EXISTENTE → apenas atualiza ─────────────────────────────────
      console.log(`[Webhook] Lead existente: ${leadExistente.id}. Atualizando...`)

      await supabase
        .from('leads')
        .update({
          ultima_mensagem: mensagemTexto,
          atualizado_em: new Date().toISOString(),
          nome: leadExistente.nome || pushName,
        })
        .eq('id', leadExistente.id)

      return ok({ lead_id: leadExistente.id })
    }

    return ok({ info: 'evento ignorado' })

  } catch (e: any) {
    console.error('[Webhook] Erro crítico:', e)
    return erro('Erro interno: ' + e.message)
  }
})