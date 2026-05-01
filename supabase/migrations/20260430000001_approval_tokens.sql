-- Adiciona token de segurança para aprovação via e-mail
ALTER TABLE public.solicitacoes_acesso 
ADD COLUMN IF NOT EXISTS approval_token UUID NOT NULL DEFAULT gen_random_uuid();

-- Ajusta as permissões de leitura para garantir que a função de notificação possa ler o token
GRANT SELECT ON public.solicitacoes_acesso TO service_role;
