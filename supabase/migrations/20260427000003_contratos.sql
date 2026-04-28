CREATE TABLE IF NOT EXISTS public.contratos (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('NACIONAL', 'INTERNACIONAL')),
  status text NOT NULL DEFAULT 'GERADO'::text CHECK (status IN ('GERADO', 'ENVIADO', 'ASSINADO', 'FATURADO')),
  conteudo text NULL,
  valor numeric NULL DEFAULT 0,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT contratos_pkey PRIMARY KEY (id),
  CONSTRAINT contratos_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads (id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Add total_gasto to leads if it doesn't exist
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS total_gasto numeric DEFAULT 0;
