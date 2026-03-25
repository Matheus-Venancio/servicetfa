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

    const { conversationId, content, senderName } = await req.json()

    if (!conversationId || !content) {
      return new Response(JSON.stringify({ error: 'Missing conversationId or content' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Get conversation and channel info
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, whatsapp_channels(*)')
      .eq('id', conversationId)
      .single()

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), { 
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const channel = conversation.whatsapp_channels
    if (!channel || !channel.evolution_api_url || !channel.api_key) {
      // No Evolution API configured — just save message to DB (mock mode)
      const { data: msg, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          origin: 'ATENDENTE',
          content,
          sender_name: senderName || 'Atendente',
        })
        .select()
        .single()

      if (msgError) {
        return new Response(JSON.stringify({ error: msgError.message }), { 
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Update conversation
      await supabase
        .from('conversations')
        .update({ last_message: content, last_message_at: new Date().toISOString() })
        .eq('id', conversationId)

      return new Response(JSON.stringify({ ok: true, message: msg, sent_via: 'database_only' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Send via Evolution API
    const evolutionUrl = `${channel.evolution_api_url}/message/sendText/${channel.instance_name}`
    const response = await fetch(evolutionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': channel.api_key,
      },
      body: JSON.stringify({
        number: conversation.remote_jid.replace('@s.whatsapp.net', ''),
        text: content,
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('Evolution API error:', result)
      return new Response(JSON.stringify({ error: 'Failed to send message via WhatsApp', details: result }), { 
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Save message to DB
    const { data: msg } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        origin: 'ATENDENTE',
        content,
        sender_name: senderName || 'Atendente',
        whatsapp_message_id: result.key?.id,
      })
      .select()
      .single()

    // Update conversation
    await supabase
      .from('conversations')
      .update({ last_message: content, last_message_at: new Date().toISOString() })
      .eq('id', conversationId)

    return new Response(JSON.stringify({ ok: true, message: msg, sent_via: 'whatsapp' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error('Send error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
