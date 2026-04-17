import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Fallback hardcoded (caso os Secrets não estejam configurados no Supabase) ─
const EVOLUTION_URL_DEFAULT = 'https://evolution.innovatedigitals.com.br'
const EVOLUTION_API_DEFAULT = 'd3b7573358045479207c1e94adfbf4a3'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // SEMPRE retorna 200 — erros vêm no campo { ok: false, error: "..." }
  // Isso evita que o Supabase client interprete erros da Evolution como falha
  const json = (payload: object) =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { action, instanceName, remoteJid, message, numero, atendenteId } = body

    // ── Resolve o instanceName ────────────────────────────────────────────────
    let resolvedInstance = instanceName

    if (!resolvedInstance && atendenteId) {
      const { data: ch } = await supabase
        .from('whatsapp_channels')
        .select('instance_name')
        .eq('atendente_id', atendenteId)
        .maybeSingle()

      resolvedInstance = ch?.instance_name || `tfa-${atendenteId.slice(0, 8)}`
    }

    if (!resolvedInstance) {
      return json({ ok: false, error: 'instanceName ou atendenteId obrigatório' })
    }

    // ── Busca credenciais do canal (ou usa fallback hardcoded) ───────────────
    const { data: channelData } = await supabase
      .from('whatsapp_channels')
      .select('evolution_api_url, api_key')
      .eq('instance_name', resolvedInstance)
      .maybeSingle()

    const evoUrl = channelData?.evolution_api_url
      || Deno.env.get('EVOLUTION_URL')
      || EVOLUTION_URL_DEFAULT

    const evoKey = channelData?.api_key
      || Deno.env.get('EVOLUTION_API')
      || EVOLUTION_API_DEFAULT

    console.log(`[Mirror] action=${action} instance=${resolvedInstance} evoUrl=${evoUrl}`)

    // ── GET CHATS (tenta múltiplos endpoints da Evolution API) ────────────────
   if (action === 'get_chats') {
  // Endpoint correto confirmado
  const res = await fetch(`${evoUrl}/chat/findChats/${resolvedInstance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: evoKey },
    body: '{}',
  });

  if (!res.ok) {
    return new Response(JSON.stringify({ ok: false, error: `Evolution retornou ${res.status}` }), { headers: corsHeaders });
  }

  const raw = await res.json();

  // Normaliza: injeta id a partir do remoteJid pois a Evolution retorna id: null
  const chats = (Array.isArray(raw) ? raw : []).map((c: any) => ({
    ...c,
    id: c.id ?? c.lastMessage?.key?.remoteJid ?? null,
  })).filter((c: any) => c.id != null);

  return new Response(JSON.stringify({ chats }), { headers: corsHeaders });
}

    // ── GET MESSAGES ──────────────────────────────────────────────────────────
    if (action === 'get_messages') {
      if (!remoteJid) return json({ ok: false, error: 'remoteJid obrigatório' })

      let raw: any; let status: number
      try {
        const res = await fetch(`${evoUrl}/chat/findMessages/${resolvedInstance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evoKey },
          body: JSON.stringify({ where: { key: { remoteJid } }, limit: 60 }),
        })
        status = res.status
        raw = await res.json().catch(() => ({}))
        console.log(`[Mirror] get_messages → HTTP ${status}`, JSON.stringify(raw).slice(0, 200))
      } catch (fetchErr) {
        return json({ ok: false, error: `Falha ao buscar mensagens: ${fetchErr}` })
      }

      if (status !== 200 && status !== 201) {
        return json({
          ok: false,
          error: `Evolution API retornou ${status}: ${raw?.message || JSON.stringify(raw).slice(0, 200)}`,
        })
      }

      const messages = raw?.messages?.records ?? raw?.records ?? (Array.isArray(raw) ? raw : [])
      return json({ ok: true, messages })
    }

    // ── SEND MESSAGE ──────────────────────────────────────────────────────────
    if (action === 'send_message') {
      if (!numero || !message) return json({ ok: false, error: 'numero e message obrigatórios' })

      let raw: any; let status: number
      try {
        const res = await fetch(`${evoUrl}/message/sendText/${resolvedInstance}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: evoKey },
          body: JSON.stringify({ number: numero, text: message }),
        })
        status = res.status
        raw = await res.json().catch(() => ({}))
        console.log(`[Mirror] send_message → HTTP ${status} to=${numero}`)
      } catch (fetchErr) {
        return json({ ok: false, error: `Falha ao enviar mensagem: ${fetchErr}` })
      }

      if (status !== 200 && status !== 201) {
        return json({
          ok: false,
          error: `Falha ao enviar: ${raw?.message || JSON.stringify(raw).slice(0, 200)}`,
        })
      }

      return json({ ok: true, result: raw })
    }

    // ── DEBUG — mostra configuração ───────────────────────────────────────────
    if (action === 'debug') {
      return json({
        ok: true,
        resolvedInstance,
        evoUrl,
        evoKeySet: !!evoKey,
        channelFound: !!channelData,
      })
    }

    return json({ ok: false, error: `Ação desconhecida: ${action}. Use: get_chats | get_messages | send_message | debug` })

  } catch (err) {
    console.error('[Mirror] Erro crítico:', err)
    return json({ ok: false, error: 'Erro interno na Edge Function', detail: String(err) })
  }
})
