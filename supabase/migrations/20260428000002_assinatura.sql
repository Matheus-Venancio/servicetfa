-- Adicionando colunas de rastreio de assinatura na tabela contratos
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS token_assinatura uuid DEFAULT gen_random_uuid();
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS ip_assinatura text;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS user_agent_assinatura text;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS data_assinatura timestamp with time zone;

-- Recarregar schema
NOTIFY pgrst, 'reload schema';
