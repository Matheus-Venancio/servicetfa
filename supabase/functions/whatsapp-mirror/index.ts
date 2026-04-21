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

      console.log('[Mirror] rawChats[0]:', JSON.stringify(rawChats[0]))

      const contactMap: Record<string, string> = {};
      const contactList = Array.isArray(rawContacts) ? rawContacts : (rawContacts?.contacts ?? []);
      for (const c of contactList) {
        if (c.id) contactMap[c.id] = c.pushName || c.notify || c.name || '';
      }

      const chatsRaw = Array.isArray(rawChats) ? rawChats : (rawChats?.chats ?? []);

      // Mapeia usando os campos corretos do findChats v2.3.7
      const mapped = chatsRaw.map((c: any) => {
        const jidOriginal = c.remoteJid ?? null;
        const jidAlt = c.lastMessage?.key?.remoteJidAlt ?? null;
        const isLid = jidOriginal?.endsWith('@lid');
        const isGroup = jidOriginal?.endsWith('@g.us');

        // ← Se for @lid e tiver remoteJidAlt, usa o número real como id
        const jid = (isLid && jidAlt) ? jidAlt : jidOriginal;

        // Nome: pushName do chat, ou da mensagem recebida
        const pushNameChat = c.pushName;
        const pushNameMsg = c.lastMessage?.pushName !== 'Você' ? c.lastMessage?.pushName : null;
        const pushNameFinal = pushNameChat || pushNameMsg;
        const nomeValido = pushNameFinal &&
          !/^\d+$/.test(pushNameFinal) &&
          !pushNameFinal.includes('@');

        // Número limpo para deduplicação
        const phoneNumber = jid?.replace('@s.whatsapp.net', '') ?? null;

        return {
          id: jid,                                          // ← agora usa número real
          phoneNumber: isGroup ? null : phoneNumber,
          isLid: false,                                     // ← já resolvido acima
          contactName: nomeValido ? pushNameFinal : null,
          lastMessage: c.lastMessage,
          unreadCount: c.unreadCount ?? 0,
          profilePicUrl: c.profilePicUrl ?? null,
        };
      }).filter((c: any) => c.id != null && c.id !== '');

      // Deduplica por número — mantém @s.whatsapp.net, descarta @lid duplicado
      const phoneMap: Record<string, any> = {};

      for (const c of mapped) {
        if (!c.phoneNumber) {
          phoneMap[c.id] = c; // grupos e sem número: mantém pelo id
          continue;
        }

        const existing = phoneMap[c.phoneNumber];
        if (!existing) {
          phoneMap[c.phoneNumber] = c;
        } else {
          // Prefere @s.whatsapp.net sobre @lid
          const preferCurrent = !c.isLid && existing.isLid;
          const preferExisting = c.isLid && !existing.isLid;
          const currentNewer = (c.lastMessage?.messageTimestamp ?? 0) > (existing.lastMessage?.messageTimestamp ?? 0);

          if (preferCurrent) {
            phoneMap[c.phoneNumber] = { ...c, contactName: c.contactName || existing.contactName };
          } else if (!preferExisting && currentNewer) {
            phoneMap[c.phoneNumber] = { ...c, contactName: c.contactName || existing.contactName };
          } else {
            // Mantém existing mas pega nome se não tinha
            if (!existing.contactName && c.contactName) {
              phoneMap[c.phoneNumber].contactName = c.contactName;
            }
          }
        }
      }

      const chats = Object.values(phoneMap);
      return json({ ok: true, chats });
    };


    // ── GET MESSAGES ──────────────────────────────────────────────────────────
    if (action === 'get_messages') {
      if (!remoteJid) return json({ ok: false, error: 'remoteJid obrigatório' })

      // Tenta os endpoints conhecidos da Evolution por versão
      const candidatos = [
        {
          method: 'POST',
          url: `${evoUrl}/chat/findMessages/${resolvedInstance}`,
          // ← estrutura correta que a Evolution v2 aceita
          reqBody: JSON.stringify({
            where: { key: { remoteJid } },
            limit: 60,
          }),
        },
        {
          method: 'POST',
          url: `${evoUrl}/chat/findMessages/${resolvedInstance}`,
          reqBody: JSON.stringify({
            where: { remoteJid },
            limit: 60,
          }),
        },
        {
          method: 'POST',
          url: `${evoUrl}/chat/findMessages/${resolvedInstance}`,
          reqBody: JSON.stringify({ remoteJid, limit: 60 }),
        },
      ];

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

    if (action === 'delete_message') {
      const { messageKeyId, remoteJid: delJid } = body;
      if (!messageKeyId || !delJid) return json({ ok: false, error: 'messageKeyId e remoteJid obrigatórios' });

      const res = await fetch(`${evoUrl}/chat/deleteMessageForEveryone/${resolvedInstance}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({
          id: messageKeyId,
          remoteJid: delJid,
          fromMe: true,
        }),
      });

      const raw = await res.json().catch(() => ({}));
      console.log(`[Mirror] delete_message → ${res.status}`, raw);
      if (!res.ok) return json({ ok: false, error: raw?.message ?? `Erro ${res.status}` });
      return json({ ok: true });
    }

    if (action === 'edit_message') {
      const { messageKeyId, remoteJid: editJid, newText, number } = body;
      if (!messageKeyId || !editJid || !newText) return json({ ok: false, error: 'messageKeyId, remoteJid e newText obrigatórios' });

      const res = await fetch(`${evoUrl}/chat/updateMessage/${resolvedInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({
          number: number,
          key: { id: messageKeyId, fromMe: true, remoteJid: editJid },
          text: newText,
        }),
      });

      const raw = await res.json().catch(() => ({}));
      console.log(`[Mirror] edit_message → ${res.status}`, raw);
      if (!res.ok) return json({ ok: false, error: raw?.message ?? `Erro ${res.status}` });
      return json({ ok: true });
    }

    if (action === 'send_media') {
      const { number, mediatype, mimetype, fileName, caption, mediaBase64 } = body;
      if (!number || !mediaBase64 || !mediatype) return json({ ok: false, error: 'number, mediaBase64 e mediatype obrigatórios' });

      const res = await fetch(`${evoUrl}/message/sendMedia/${resolvedInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({
          number,
          mediatype,
          mimetype,
          media: mediaBase64,
          fileName: fileName || 'arquivo',
          caption: caption || '',
        }),
      });

      const raw = await res.json().catch(() => ({}));
      console.log(`[Mirror] send_media → ${res.status}`, JSON.stringify(raw).slice(0, 200));
      if (!res.ok) return json({ ok: false, error: raw?.message ?? `Erro ${res.status}` });
      return json({ ok: true, result: raw });
    }

    if (action === 'send_audio') {
      const { number, audioBase64 } = body;
      if (!number || !audioBase64) return json({ ok: false, error: 'number e audioBase64 obrigatórios' });

      const res = await fetch(`${evoUrl}/message/sendWhatsAppAudio/${resolvedInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({
          number,
          audio: audioBase64,
          encoding: true,
        }),
      });

      const raw = await res.json().catch(() => ({}));
      console.log(`[Mirror] send_audio → ${res.status}`);
      if (!res.ok) return json({ ok: false, error: raw?.message ?? `Erro ${res.status}` });
      return json({ ok: true, result: raw });
    }

    if (action === 'get_media') {
      const { messageId, mediaType } = body;
      if (!messageId) return json({ ok: false, error: 'messageId obrigatório' });

      const isAudio = mediaType === 'audioMessage';

      const res = await fetch(`${evoUrl}/chat/getBase64FromMediaMessage/${resolvedInstance}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: evoKey },
        body: JSON.stringify({
          message: { key: { id: messageId } },
          convertToMp4: isAudio, // ← converte áudio para mp4/aac que o browser suporta
        }),
      });

      const raw = await res.json().catch(() => ({}));
      if (!res.ok) return json({ ok: false, error: raw?.message ?? `Erro ${res.status}` });

      return json({ ok: true, base64: raw.base64, mimetype: raw.mimetype, fileName: raw.fileName });
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
