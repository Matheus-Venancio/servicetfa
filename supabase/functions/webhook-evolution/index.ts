import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // service role para bypass de RLS
)

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const body = await req.json()
    const { event, data } = body

    // Só processa mensagens novas recebidas (não enviadas pelo SAC)
    if (event !== 'MESSAGES_UPSERT') {
      return new Response('OK', { status: 200 })
    }

    if (data?.key?.fromMe) {
      return new Response('OK', { status: 200 })
    }

    const telefone = data.key.remoteJid?.replace('@s.whatsapp.net', '')
    const conteudo =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      '[mídia]'

    if (!telefone) return new Response('OK', { status: 200 })

    // Verifica se lead já existe
    const { data: leadExistente } = await supabase
      .from('leads')
      .select('id, atendente_id, status')
      .eq('telefone', telefone)
      .maybeSingle()

    if (leadExistente) {
      // Lead já existe — só adiciona a mensagem
      await supabase.from('mensagens').insert({
        lead_id: leadExistente.id,
        origem: 'LEAD',
        tipo: 'TEXTO',
        conteudo,
      })
      return new Response('OK', { status: 200 })
    }

    // Lead novo — chama round-robin e cria tudo
    const { data: atendenteId } = await supabase.rpc('proxima_da_fila')

    const { data: novoLead } = await supabase
      .from('leads')
      .insert({
        telefone,
        canal_origem: 'META_ADS',
        status: atendenteId ? 'EM_ATENDIMENTO' : 'AGUARDANDO',
        score: 'FRIO',
        atendente_id: atendenteId ?? null,
      })
      .select()
      .single()

    if (!novoLead) throw new Error('Erro ao criar lead')

    // Mensagem do lead
    await supabase.from('mensagens').insert({
      lead_id: novoLead.id,
      origem: 'LEAD',
      tipo: 'TEXTO',
      conteudo,
    })

    // Mensagem de sistema
    await supabase.from('mensagens').insert({
      lead_id: novoLead.id,
      origem: 'SISTEMA',
      tipo: 'SISTEMA',
      conteudo: atendenteId
        ? `Lead distribuído automaticamente via fila round-robin.`
        : `Sem atendentes online. Lead em fila de espera.`,
    })

    return new Response(JSON.stringify({ ok: true, leadId: novoLead.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response('Internal error', { status: 500 })
  }
})
