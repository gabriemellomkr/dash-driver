-- Fix RLS policies and UNIQUE constraint on dashdriver_config.
-- The upsert in settings.js requires:
--   1. A UNIQUE constraint on user_id (for onConflict to work)
--   2. INSERT + UPDATE policies (not just SELECT)
-- Rodar no SQL Editor do Supabase.

-- 1. Garante constraint UNIQUE em user_id (necessário para upsert onConflict)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dashdriver_config_user_id_key'
      AND conrelid = 'public.dashdriver_config'::regclass
  ) THEN
    ALTER TABLE public.dashdriver_config
      ADD CONSTRAINT dashdriver_config_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 2. Habilita RLS (idempotente)
ALTER TABLE public.dashdriver_config ENABLE ROW LEVEL SECURITY;

-- 3. Remove políticas antigas (podem estar incompletas)
DROP POLICY IF EXISTS "Users manage own config"   ON public.dashdriver_config;
DROP POLICY IF EXISTS "Users read own config"     ON public.dashdriver_config;
DROP POLICY IF EXISTS "Users update own config"   ON public.dashdriver_config;
DROP POLICY IF EXISTS "Users insert own config"   ON public.dashdriver_config;
DROP POLICY IF EXISTS "Enable all for own config" ON public.dashdriver_config;

-- 4. Cria política ALL cobrindo SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "Users manage own config" ON public.dashdriver_config
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK(auth.uid() = user_id);

-- 5. Também corrige token_usage: só tem SELECT policy, INSERT vem do server (postgres user)
--    Mas adiciona política de INSERT para o próprio usuário também (caminho alternativo)
DROP POLICY IF EXISTS "Users insert own usage" ON public.dashdriver_token_usage;
CREATE POLICY "Users insert own usage" ON public.dashdriver_token_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);
