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
  // Busca chats e contatos em paralelo
  const [chatsRes, contactsRes] = await Promise.all([
    fetch(`${evoUrl}/chat/findChats/${resolvedInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evoKey },
      body: '{}',
    }),
    fetch(`${evoUrl}/contact/findContacts/${resolvedInstance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: evoKey },
      body: '{}',
    }),
  ]);

  const rawChats = await chatsRes.json().catch(() => []);
  const rawContacts = await contactsRes.json().catch(() => []);

  // Monta dicionário: remoteJid → nome
  const contactMap: Record<string, string> = {};
  const contactList = Array.isArray(rawContacts) ? rawContacts : (rawContacts?.contacts ?? []);
  for (const c of contactList) {
    if (c.id) {
      contactMap[c.id] = c.pushName || c.notify || c.name || '';
    }
  }

  // Normaliza chats injetando nome do contato
  const chats = (Array.isArray(rawChats) ? rawChats : []).map((c: any) => {
    const jid = c.id ?? c.lastMessage?.key?.remoteJid ?? null;
    const isGroup = jid?.endsWith('@g.us');
    const nome =
      contactMap[jid] ||
      (!isGroup ? c.lastMessage?.pushName : null) ||
      null;

    return { ...c, id: jid, contactName: nome };
  }).filter((c: any) => c.id != null);

  return json({ ok: true, chats });
}

    // ── GET MESSAGES ──────────────────────────────────────────────────────────
    if (action === 'get_messages') {
      if (!remoteJid) return json({ ok: false, error: 'remoteJid obrigatório' })

      // Tenta os endpoints conhecidos da Evolution por versão
      const candidatos = [
        {
          method: 'POST',
          url: `${evoUrl}/chat/findMessages/${resolvedInstance}`,
          reqBody: JSON.stringify({ where: { key: { remoteJid } }, limit: 60 }),
        },
        {
          method: 'POST',
          url: `${evoUrl}/chat/findMessages/${resolvedInstance}`,
          reqBody: JSON.stringify({ remoteJid, limit: 60 }),
        },
        {
          method: 'GET',
          url: `${evoUrl}/chat/findMessages/${resolvedInstance}?remoteJid=${encodeURIComponent(remoteJid)}`,
          reqBody: undefined,
        },
        {
          method: 'POST',
          url: `${evoUrl}/message/findMessages/${resolvedInstance}`,
          reqBody: JSON.stringify({ where: { key: { remoteJid } }, limit: 60 }),
        },
      ]

      let messages: any[] = []

      for (const c of candidatos) {
        try {
          const opts: RequestInit = {
            method: c.method,
            headers: { 'Content-Type': 'application/json', apikey: evoKey },
          }
          if (c.method === 'POST' && c.reqBody) opts.body = c.reqBody

          const res = await fetch(c.url, opts)
          const resBody = await res.json().catch(() => ({}))
          console.log(`[Mirror] get_messages: ${c.method} ${c.url} → ${res.status}`, JSON.stringify(resBody).slice(0, 300))

          if (res.ok) {
            const raw =
              resBody?.messages?.records ??
              resBody?.messages ??
              resBody?.records ??
              (Array.isArray(resBody) ? resBody : [])

            // Filtra somente mensagens com key.id válido para evitar key=null no React
            messages = (Array.isArray(raw) ? raw : []).filter(
              (m: any) => m?.key != null && m?.key?.id != null
            )
            break
          }
        } catch (e) {
          console.error('[Mirror] candidato erro:', e)
        }
      }

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
