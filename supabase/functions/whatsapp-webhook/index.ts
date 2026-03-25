import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const body = await req.json()
    console.log('Webhook received:', JSON.stringify(body))

    // Evolution API webhook format
    const event = body.event
    const instance = body.instance
    const data = body.data

    if (event === 'messages.upsert') {
      const message = data
      const remoteJid = message.key?.remoteJid
      const fromMe = message.key?.fromMe || false
      const messageContent = message.message?.conversation 
        || message.message?.extendedTextMessage?.text
        || message.message?.imageMessage?.caption
        || '[Mídia]'
      const pushName = message.pushName || ''
      const messageId = message.key?.id

      if (!remoteJid || remoteJid === 'status@broadcast') {
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Find the channel for this instance
      const { data: channel } = await supabase
        .from('whatsapp_channels')
        .select('*')
        .eq('instance_name', instance)
        .single()

      if (!channel) {
        console.error('Channel not found for instance:', instance)
        return new Response(JSON.stringify({ error: 'Channel not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Find or create conversation
      let { data: conversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('channel_id', channel.id)
        .eq('remote_jid', remoteJid)
        .single()

      const contactPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '')

      if (!conversation) {
        const { data: newConv, error } = await supabase
          .from('conversations')
          .insert({
            channel_id: channel.id,
            remote_jid: remoteJid,
            contact_name: pushName || contactPhone,
            contact_phone: contactPhone,
            atendente_id: channel.atendente_id,
            atendente_nome: channel.atendente_nome,
            status: 'ABERTA',
            unread_count: fromMe ? 0 : 1,
            last_message: messageContent,
            last_message_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (error) {
          console.error('Error creating conversation:', error)
          return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        conversation = newConv
      } else {
        // Update conversation
        await supabase
          .from('conversations')
          .update({
            last_message: messageContent,
            last_message_at: new Date().toISOString(),
            contact_name: pushName || conversation.contact_name,
            unread_count: fromMe ? conversation.unread_count : conversation.unread_count + 1,
          })
          .eq('id', conversation.id)
      }

      // Insert message
      await supabase
        .from('messages')
        .insert({
          conversation_id: conversation!.id,
          origin: fromMe ? 'ATENDENTE' : 'LEAD',
          content: messageContent,
          sender_name: fromMe ? channel.atendente_nome : (pushName || contactPhone),
          sender_phone: contactPhone,
          whatsapp_message_id: messageId,
        })

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Connection status update
    if (event === 'connection.update') {
      const state = data?.state
      if (state && instance) {
        const status = state === 'open' ? 'connected' : state === 'close' ? 'disconnected' : 'connecting'
        await supabase
          .from('whatsapp_channels')
          .update({ status })
          .eq('instance_name', instance)
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
