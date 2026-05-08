-- Migration para a tabela de viagens e exclusão da antiga tabela de contratos

CREATE TABLE IF NOT EXISTS public.viagens (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    lead_id uuid NOT NULL,
    atendente_id uuid NOT NULL,
    destino text NOT NULL,
    data_partida date NOT NULL,
    data_retorno date NOT NULL,
    valor_investimento numeric DEFAULT 0,
    status text NOT NULL DEFAULT 'AGENDADA'::text CHECK (status IN ('AGENDADA', 'CONCLUIDA', 'CANCELADA')),
    criado_em timestamp with time zone NOT NULL DEFAULT now(),
    atualizado_em timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT viagens_pkey PRIMARY KEY (id),
    CONSTRAINT viagens_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE,
    CONSTRAINT viagens_atendente_id_fkey FOREIGN KEY (atendente_id) REFERENCES public.atendentes(id) ON DELETE RESTRICT
) TABLESPACE pg_default;

-- Se desejar podemos dropar a tabela de contratos antiga caso ela não tenha mais utilidade real
-- DROP TABLE se o cliente confirmar a perda do historico
-- DROP TABLE IF EXISTS public.contratos CASCADE;
