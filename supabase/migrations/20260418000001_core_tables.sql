-- =============================================================================
-- Migration: Tabelas principais do sistema TFA Connect
-- Criadas via SQL Editor no Supabase — replicadas aqui para controle de versão.
-- =============================================================================

-- ─── Tabela: atendentes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.atendentes (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome          TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  telefone      TEXT,
  papel         TEXT        NOT NULL DEFAULT 'ATENDENTE'
                            CHECK (papel IN ('ATENDENTE', 'GESTOR', 'ADMIN')),
  status        TEXT        NOT NULL DEFAULT 'OFFLINE'
                            CHECK (status IN ('ONLINE', 'OCUPADO', 'OFFLINE')),
  max_leads     INTEGER     NOT NULL DEFAULT 10,
  avatar_url    TEXT,
  instance_name TEXT,
  criado_em     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.atendentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Atendentes: leitura pública"  ON public.atendentes FOR SELECT USING (true);
CREATE POLICY "Atendentes: inserção pública" ON public.atendentes FOR INSERT WITH CHECK (true);
CREATE POLICY "Atendentes: atualização"      ON public.atendentes FOR UPDATE USING (true);
CREATE POLICY "Atendentes: exclusão"         ON public.atendentes FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_atendentes_status ON public.atendentes (status);
CREATE INDEX IF NOT EXISTS idx_atendentes_papel  ON public.atendentes (papel);

-- ─── Tabela: fila_config (singleton para controle do round-robin) ─────────────
CREATE TABLE IF NOT EXISTS public.fila_config (
  id            TEXT        NOT NULL DEFAULT 'singleton' PRIMARY KEY,
  ultimo_idx    INTEGER     NOT NULL DEFAULT 0,
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fila_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FilaConfig: leitura pública"  ON public.fila_config FOR SELECT USING (true);
CREATE POLICY "FilaConfig: inserção pública" ON public.fila_config FOR INSERT WITH CHECK (true);
CREATE POLICY "FilaConfig: atualização"      ON public.fila_config FOR UPDATE USING (true);

-- Garante que o registro singleton existe com idx inicial = 0
INSERT INTO public.fila_config (id, ultimo_idx)
VALUES ('singleton', 0)
ON CONFLICT (id) DO NOTHING;

-- ─── Tabela: leads ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
  id              UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome            TEXT,
  telefone        TEXT    NOT NULL,
  email           TEXT,
  status          TEXT    NOT NULL DEFAULT 'NOVO'
                          CHECK (status IN ('NOVO','QUALIFICANDO','AGUARDANDO','EM_ATENDIMENTO',
                                            'PROPOSTA_ENVIADA','FECHADO','PERDIDO','NURTURING')),
  score           TEXT    NOT NULL DEFAULT 'FRIO'
                          CHECK (score IN ('QUENTE','MORNO','FRIO')),
  canal_origem    TEXT    NOT NULL DEFAULT 'META_ADS'
                          CHECK (canal_origem IN ('META_ADS','GOOGLE_ADS','TIKTOK_ADS',
                                                   'ORGANICO','INDICACAO','OUTRO')),
  campanha_id     UUID,
  atendente_id    UUID    REFERENCES public.atendentes (id) ON DELETE SET NULL,
  destino         TEXT,
  data_partida    DATE,
  data_retorno    DATE,
  numero_pessoas  INTEGER,
  orcamento       NUMERIC,
  observacoes      TEXT,
  ultima_mensagem  TEXT,                  -- última mensagem recebida do lead (atualizada a cada nova msg)
  criado_em        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  atualizado_em   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leads: leitura pública"  ON public.leads FOR SELECT USING (true);
CREATE POLICY "Leads: inserção pública" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Leads: atualização"      ON public.leads FOR UPDATE USING (true);
CREATE POLICY "Leads: exclusão"         ON public.leads FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_leads_atendente ON public.leads (atendente_id);
CREATE INDEX IF NOT EXISTS idx_leads_status    ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_telefone  ON public.leads (telefone);

-- ─── Tabela: mensagens ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mensagens (
  id            UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id       UUID    NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  atendente_id  UUID    REFERENCES public.atendentes (id) ON DELETE SET NULL,
  tipo          TEXT    NOT NULL DEFAULT 'TEXTO'
                        CHECK (tipo IN ('TEXTO','IMAGEM','DOCUMENTO','AUDIO','NOTA_INTERNA','SISTEMA')),
  origem        TEXT    NOT NULL
                        CHECK (origem IN ('LEAD','ATENDENTE','BOT','SISTEMA')),
  conteudo      TEXT    NOT NULL,
  media_url     TEXT,
  lida          BOOLEAN NOT NULL DEFAULT false,
  criado_em     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mensagens: leitura pública"  ON public.mensagens FOR SELECT USING (true);
CREATE POLICY "Mensagens: inserção pública" ON public.mensagens FOR INSERT WITH CHECK (true);
CREATE POLICY "Mensagens: atualização"      ON public.mensagens FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_mensagens_lead      ON public.mensagens (lead_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_criado_em ON public.mensagens (criado_em);

-- ─── Tabela: notas_internas ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notas_internas (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id       UUID NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  atendente_id  UUID NOT NULL REFERENCES public.atendentes (id) ON DELETE CASCADE,
  conteudo      TEXT NOT NULL,
  criado_em     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notas_internas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "NotasInternas: leitura pública"  ON public.notas_internas FOR SELECT USING (true);
CREATE POLICY "NotasInternas: inserção pública" ON public.notas_internas FOR INSERT WITH CHECK (true);

-- ─── Tabela: campanhas ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campanhas (
  id           UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome         TEXT    NOT NULL,
  canal        TEXT    NOT NULL
               CHECK (canal IN ('META_ADS','GOOGLE_ADS','TIKTOK_ADS','ORGANICO','INDICACAO','OUTRO')),
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  ativa        BOOLEAN NOT NULL DEFAULT true,
  criado_em    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campanhas: leitura pública"  ON public.campanhas FOR SELECT USING (true);
CREATE POLICY "Campanhas: inserção pública" ON public.campanhas FOR INSERT WITH CHECK (true);
CREATE POLICY "Campanhas: atualização"      ON public.campanhas FOR UPDATE USING (true);
CREATE POLICY "Campanhas: exclusão"         ON public.campanhas FOR DELETE USING (true);
