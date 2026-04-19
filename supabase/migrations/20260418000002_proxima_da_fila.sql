-- =============================================================================
-- Migration: Função proxima_da_fila() — Round-Robin de distribuição de leads
--
-- Algoritmo: seleciona o próximo atendente ONLINE na fila circular (round-robin),
-- incrementando atomicamente o índice na tabela fila_config (singleton).
--
-- Segurança de concorrência: o SELECT ... FOR UPDATE na fila_config garante que
-- duas requisições simultâneas nunca selecionem o mesmo atendente.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.proxima_da_fila()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  atendentes_ids uuid[];
  proximo_idx    int;
  atual_idx      int;
  total          int;
BEGIN
  -- 1. Coleta todos os atendentes ONLINE em ordem alfabética
  SELECT ARRAY(
    SELECT id FROM atendentes
    WHERE status = 'ONLINE' AND papel = 'ATENDENTE'
    ORDER BY nome ASC
  ) INTO atendentes_ids;

  total := array_length(atendentes_ids, 1);

  -- 2. Se não há ninguém online, retorna NULL imediatamente
  IF total IS NULL OR total = 0 THEN
    RETURN NULL;
  END IF;

  -- 3. Lê o índice atual da fila de forma atômica (bloqueia a linha)
  SELECT ultimo_idx INTO atual_idx
  FROM fila_config
  WHERE id = 'singleton'
  FOR UPDATE;

  -- 4. Calcula o próximo índice (1-based, pois arrays em PL/pgSQL começam em 1)
  proximo_idx := (atual_idx % total) + 1;

  -- 5. Persiste o novo índice (avança o ponteiro da fila)
  UPDATE fila_config
  SET ultimo_idx = proximo_idx,
      atualizado_em = now()
  WHERE id = 'singleton';

  -- 6. Retorna o UUID do atendente selecionado
  RETURN atendentes_ids[proximo_idx];
END;
$$;

-- Garante que apenas o service_role pode executar a função diretamente
-- (os Edge Functions usam SUPABASE_SERVICE_ROLE_KEY, então têm acesso)
REVOKE EXECUTE ON FUNCTION public.proxima_da_fila() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.proxima_da_fila() TO service_role;
