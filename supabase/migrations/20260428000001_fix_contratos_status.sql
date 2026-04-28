-- Remove a constraint antiga
ALTER TABLE public.contratos DROP CONSTRAINT IF EXISTS contratos_status_check;

-- Adiciona a nova constraint com o status FATURADO
ALTER TABLE public.contratos ADD CONSTRAINT contratos_status_check CHECK (status IN ('GERADO', 'ENVIADO', 'ASSINADO', 'FATURADO'));

-- Adiciona as colunas que ficaram de fora na primeira versão
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS valor numeric NULL DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS total_gasto numeric DEFAULT 0;

-- Força o Supabase a recarregar o cache do schema (previne o erro "schema cache")
NOTIFY pgrst, 'reload schema';
