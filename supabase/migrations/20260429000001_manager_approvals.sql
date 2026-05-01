-- =============================================================================
-- Migration: Gestão de Acessos e Aprovação de Gerentes
-- =============================================================================

-- 1. Adiciona campos de aprovação na tabela de atendentes
ALTER TABLE public.atendentes 
ADD COLUMN IF NOT EXISTS aprovado BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS data_aprovacao TIMESTAMP WITH TIME ZONE;

-- 2. Cria função para criar perfil automaticamente no SignUp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.atendentes (id, nome, email, papel, status, aprovado)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome', 'Novo Gerente'),
    new.email,
    'GESTOR', -- Por padrão registra como Gestor
    'OFFLINE',
    false -- Começa desativado até aprovação
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger para o Auth do Supabase
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Ajusta RLS para permitir que o usuário veja seu próprio status de aprovação
-- (Assumindo que o ID do atendente é o mesmo do Auth UID)
CREATE POLICY "Atendentes: ver próprio perfil" ON public.atendentes
FOR SELECT USING (auth.uid() = id);

-- 5. Política para Gestores aprovarem outros
CREATE POLICY "Gestores: atualizar outros atendentes" ON public.atendentes
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.atendentes 
    WHERE id = auth.uid() AND papel = 'GESTOR' AND aprovado = true
  )
);
