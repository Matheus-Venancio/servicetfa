import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Constante: instance_name do número SAC da empresa ───────────────────────
const SAC_INSTANCE = 'atendente'

// ─── Helper: normaliza nome do evento ───────────────────────────────────
function normalizeEvent(event: string): string {
  return event?.toUpperCase().replace('.', '_')
}

// ─── Helper: extrai texto da mensagem ──────────────────────────────────────
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

console.log("EVOLUTION URL", Deno.env.get('EVOLUTION_URL'))

console.log("extrairTextoMensagem", extrairTextoMensagem)
// ─── Helper: gera link wa.me ──────────────────────────────────────────────────
function gerarLinkWhatsApp(telefoneCliente: string, nomeCliente: string | null): string {
  const texto = `Olá${nomeCliente ? ` ${nomeCliente}` : ''}! Sou seu atendente da TFA Viagens. Como posso ajudar?`
  return `https://wa.me/${telefoneCliente}?text=${encodeURIComponent(texto)}`
}

// ─── Helper: envia mensagem via Evolution API ────────────────────────────────
async function enviarMensagemEvolution(
  evolutionUrl: string,
  apiKey: string,
  instanceName: string,
  numero: string,
  texto: string
): Promise<boolean> {
  try {
    const phoneClean = numero.replace('@s.whatsapp.net', '').replace('@g.us', '').replace(/[^0-9]/g, '')
    console.log(`[Evolution] Enviando mensagem para ${phoneClean} via instância ${instanceName}...`)
    
    const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      body: JSON.stringify({ number: phoneClean, text: texto }),
    })
    
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      console.error(`[Evolution] Erro ao enviar (${res.status}):`, err)
      return false
    }
    
    console.log(`[Evolution] Mensagem enviada com sucesso para ${phoneClean}`)
    return true
  } catch (e) {
    console.error('[Evolution] Erro de rede:', e)
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
    const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API') || ''

    const body = await req.json()
    const event = normalizeEvent(body.event)
    const instance = body.instance
    const data = body.data

    console.log(`[Webhook] Evento: ${event} | Instância: ${instance}`)

    if (event === 'MESSAGES_UPSERT') {
      const remoteJid = data?.key?.remoteJid
      const fromMe = data?.key?.fromMe || false

      if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us') || fromMe) {
        return new Response('Ignorado', { status: 200 })
      }

      if (instance !== SAC_INSTANCE) {
        console.log(`[Webhook] Instância ${instance} não é o SAC. Ignorando distribuição.`)
        return new Response('OK', { status: 200 })
      }

      const telefone = remoteJid.replace('@s.whatsapp.net', '')
      const nomeContato = data?.pushName?.trim() || null
      const mensagemTexto = extrairTextoMensagem(data?.message)

      console.log(`[Webhook] Mensagem de: ${telefone} (${nomeContato}): ${mensagemTexto}`)

      // 1. Busca Configurações do Canal (para pegar a API Key da instância se necessário)
      const { data: channel } = await supabase
        .from('whatsapp_channels')
        .select('*')
        .eq('instance_name', instance)
        .maybeSingle()

      const sacApiKey = channel?.api_key || EVOLUTION_API_KEY

      // 2. Localiza ou Cria Lead
      let { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('telefone', telefone)
        .maybeSingle()

      let isNewLead = false

      if (!lead) {
        console.log('[Webhook] Novo lead detectado. Iniciando round-robin...')
        isNewLead = true
        const { data: atendenteId } = await supabase.rpc('proxima_da_fila')
        
        const { data: novoLead, error: insertError } = await supabase
          .from('leads')
          .insert({
            telefone,
            nome: nomeContato,
            canal_origem: 'ORGANICO',
            status: atendenteId ? 'EM_ATENDIMENTO' : 'AGUARDANDO',
            atendente_id: atendenteId || null,
            ultima_mensagem: mensagemTexto
          })
          .select()
          .single()
        
        if (insertError) throw insertError
        lead = novoLead
      } else {
        // Atualiza última mensagem do lead existente
        await supabase.from('leads').update({ 
          ultima_mensagem: mensagemTexto,
          atualizado_em: new Date().toISOString(),
          nome: lead.nome || nomeContato // Atualiza nome se estiver vazio
        }).eq('id', lead.id)
      }

      // 3. Salva Mensagem na Tabela
      await supabase.from('mensagens').insert({
        lead_id: lead.id,
        origem: 'LEAD',
        tipo: 'TEXTO',
        conteudo: mensagemTexto,
      })

      // 4. Notificações
      if (lead.atendente_id) {
        // Busca dados do atendente
        const { data: atendente } = await supabase
          .from('atendentes')
          .select('*')
          .eq('id', lead.atendente_id)
          .single()

        if (atendente) {
          console.log(`[Webhook] Notificando atendente: ${atendente.nome}`)
          
          // Link wa.me para o histórico/painel
          const linkWaMe = gerarLinkWhatsApp(telefone, nomeContato)

          // A) Registrar Nota de Sistema (Painel)
          await supabase.from('mensagens').insert({
            lead_id: lead.id,
            origem: 'SISTEMA',
            tipo: 'SISTEMA',
            conteudo: `🔔 Mensagem recebida de ${nomeContato || telefone}\n📌 Atendente: ${atendente.nome}\n🔗 Link: ${linkWaMe}`
          })

          // B) Enviar Notificação via WhatsApp para o Atendente
          if (atendente.telefone) {
            const msgAtendente = `📨 *Nova mensagem no SAC*\n👤 Cliente: ${nomeContato || telefone}\n💬: ${mensagemTexto}\n\nLink para responder:\n${linkWaMe}`
            await enviarMensagemEvolution(EVOLUTION_URL, sacApiKey, SAC_INSTANCE, atendente.telefone, msgAtendente)
          }
        }
      }

      // 5. Confirmação ao Cliente (Sempre envia no SAC)
      console.log(`[Webhook] Enviando confirmação ao cliente: ${telefone}`)
      const msgCliente = `Olá! Recebemos sua mensagem. Um de nossos atendentes já foi notificado e entrará em contato em breve. 😊`
      await enviarMensagemEvolution(EVOLUTION_URL, sacApiKey, SAC_INSTANCE, telefone, msgCliente)

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
