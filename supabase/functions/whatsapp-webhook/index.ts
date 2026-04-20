import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SAC_INSTANCE = 'atendente'

function normalizeEvent(event: string): string {
  return event?.toUpperCase().replace('.', '_')
}

function extrairTextoMensagem(message: any): string {
  if (!message) return '[Mídia]'
  if (message.conversation) return message.conversation
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text
  if (message.imageMessage?.caption) return message.imageMessage.caption
  if (message.videoMessage?.caption) return message.videoMessage.caption
  if (message.documentMessage?.title) return message.documentMessage.title
  if (message.audioMessage) return '[Áudio]'
  if (message.stickerMessage) return '[Figurinha]'
  return '[Mídia]'
}

// ── Gera texto de notificação ────────────────────────────────────────────────
function gerarTextoNotificacao(
  telefoneCliente: string,
  nomeCliente: string | null,
  ultimaMensagem: string
): string {
  const nome = nomeCliente || telefoneCliente
  return `📨 Nova mensagem no SAC TFA Viagens\n\n👤 Cliente: ${nome}\n📞 Telefone: ${telefoneCliente}\n💬 Mensagem: ${ultimaMensagem}\n\nClique para responder via WhatsApp:`
}

// ── Gera link wa.me ──────────────────────────────────────────────────────────
function gerarLinkWaMe(telefoneCliente: string, texto: string): string {
  const phoneClean = telefoneCliente.replace(/[^0-9]/g, '')
  return `https://wa.me/${phoneClean}?text=${encodeURIComponent(texto)}`
}

console.log('🚀 Serviço whatsapp-webhook iniciado e aguardando requisições...')

// ── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Busca variáveis com prefixo VITE_ pois é assim que estão no seu arquivo .env
    const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
    const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL ou Key não encontrados no ambiente.')
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    let body;
    try {
      body = await req.json()
    } catch (err) {
      console.log('[Webhook] Requisição recebida sem um JSON válido (Ping ou método inválido).')
      return new Response('OK', { status: 200 })
    }

    const event = normalizeEvent(body?.event)
    const instance = body?.instance
    const data = body?.data

    console.log(`[Webhook] Evento: ${event} | Instância: ${instance}`)

    if (event === 'MESSAGES_UPSERT') {
      const remoteJid = data?.key?.remoteJid
      const fromMe = data?.key?.fromMe || false

      // Ignora: broadcasts, grupos, mensagens enviadas pelo próprio SAC
      if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us') || fromMe) {
        return new Response('Ignorado', { status: 200 })
      }

      // Só processa mensagens do SAC principal
      if (instance !== SAC_INSTANCE) {
        console.log(`[Webhook] Instância ${instance} ignorada — não é o SAC.`)
        return new Response('OK', { status: 200 })
      }

      const telefone = remoteJid.replace('@s.whatsapp.net', '')
      const nomeContato = data?.pushName?.trim() || null
      const mensagemTexto = extrairTextoMensagem(data?.message)

      console.log(`[Webhook] Mensagem de: ${telefone} (${nomeContato}): ${mensagemTexto}`)

      // ── 1. Busca atendentes ONLINE com telefone cadastrado ─────────────────
      const { data: atendentesOnline, error: atenErr } = await supabase
        .from('atendentes')
        .select('id, nome, telefone, status')
        .eq('status', 'ONLINE')

      if (atenErr) console.error('[Webhook] Erro ao buscar atendentes:', atenErr)

      const atendentesDisponiveis = (atendentesOnline ?? []).filter(
        (a: any) => a.telefone && a.telefone.trim() !== ''
      )

      console.log(`[Webhook] Atendentes ONLINE disponíveis: ${atendentesDisponiveis.length}`)

      // ── 2. Localiza ou cria o lead ─────────────────────────────────────────
      let { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('telefone', telefone)
        .maybeSingle()

      if (!lead) {
        console.log('[Webhook] Novo lead — aplicando round-robin...')

        // Pega próximo atendente da fila (função PostgreSQL existente)
        const { data: atendenteId } = await supabase.rpc('proxima_da_fila')

        const { data: novoLead, error: insertError } = await supabase
          .from('leads')
          .insert({
            telefone,
            nome: nomeContato,
            canal_origem: 'ORGANICO',
            status: atendenteId ? 'EM_ATENDIMENTO' : 'AGUARDANDO',
            atendente_id: atendenteId || null,
            ultima_mensagem: mensagemTexto,
          })
          .select()
          .single()

        if (insertError) throw insertError
        lead = novoLead

        console.log(`[Webhook] Lead criado: ${lead.id} | Atendente: ${atendenteId ?? 'nenhum'}`)
      } else {
        // Atualiza lead existente
        await supabase
          .from('leads')
          .update({
            ultima_mensagem: mensagemTexto,
            atualizado_em: new Date().toISOString(),
            nome: lead.nome || nomeContato,
          })
          .eq('id', lead.id)

        console.log(`[Webhook] Lead existente atualizado: ${lead.id}`)
      }

      // ── 3. Salva mensagem na tabela ────────────────────────────────────────
      await supabase.from('mensagens').insert({
        lead_id: lead.id,
        origem: 'LEAD',
        tipo: 'TEXTO',
        conteudo: mensagemTexto,
      })

      // ── 4. Registra aviso no sistema com os links WA.ME ────────────────────
      if (atendentesDisponiveis.length > 0) {
        console.log(`[Webhook] Gerando links wa.me para ${atendentesDisponiveis.length} atendente(s)...`)

        const texto = gerarTextoNotificacao(telefone, nomeContato, mensagemTexto)
        const linkWaMe = gerarLinkWaMe(telefone, texto)

        // Registra como mensagem de sistema
        await supabase.from('mensagens').insert({
          lead_id: lead.id,
          origem: 'SISTEMA',
          tipo: 'SISTEMA',
          conteudo: `🔔 Novo lead na fila!\nDisponível para os atendentes iniciarem contato.\n\n🔗 Clique e responda:\n${linkWaMe}`
        })
      } else {
        console.warn('[Webhook] Nenhum atendente ONLINE com telefone cadastrado.')
        await supabase.from('mensagens').insert({
          lead_id: lead.id,
          origem: 'SISTEMA',
          tipo: 'SISTEMA',
          conteudo: `⚠️ Mensagem recebida de ${nomeContato || telefone}, mas nenhum atendente ONLINE.`,
        })
      }

      // ── 5. Retorno ao webhoook (cliente não receberá auto-resposta via evolution) ──
      console.log(`[Webhook] Concluído para lead ${lead.id}`)

      return new Response(JSON.stringify({ ok: true, lead_id: lead.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error) {
    console.error('[Webhook] Erro Crítico:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})