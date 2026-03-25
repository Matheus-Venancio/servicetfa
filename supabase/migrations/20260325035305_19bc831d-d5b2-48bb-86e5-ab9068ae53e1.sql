
-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- WhatsApp channels (each attendant's connected number)
CREATE TABLE public.whatsapp_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_name TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  atendente_id TEXT NOT NULL,
  atendente_nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting')),
  evolution_api_url TEXT,
  api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read channels" ON public.whatsapp_channels FOR SELECT USING (true);
CREATE POLICY "Anyone can insert channels" ON public.whatsapp_channels FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update channels" ON public.whatsapp_channels FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete channels" ON public.whatsapp_channels FOR DELETE USING (true);

CREATE TRIGGER update_whatsapp_channels_updated_at
  BEFORE UPDATE ON public.whatsapp_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Conversations (real WhatsApp conversations)
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID REFERENCES public.whatsapp_channels(id) ON DELETE CASCADE,
  remote_jid TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT NOT NULL,
  contact_avatar_url TEXT,
  atendente_id TEXT,
  atendente_nome TEXT,
  status TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA', 'FECHADA', 'PENDENTE')),
  unread_count INTEGER NOT NULL DEFAULT 0,
  last_message TEXT,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read conversations" ON public.conversations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert conversations" ON public.conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update conversations" ON public.conversations FOR UPDATE USING (true);

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_conversations_channel ON public.conversations(channel_id);
CREATE INDEX idx_conversations_atendente ON public.conversations(atendente_id);
CREATE INDEX idx_conversations_remote_jid ON public.conversations(remote_jid);

-- Messages
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('LEAD', 'ATENDENTE', 'BOT', 'NOTA_INTERNA', 'SISTEMA')),
  content TEXT NOT NULL,
  media_type TEXT,
  media_url TEXT,
  sender_name TEXT,
  sender_phone TEXT,
  whatsapp_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Anyone can insert messages" ON public.messages FOR INSERT WITH CHECK (true);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at);
