-- Tabela para tokens de redefinição de senha (flow próprio, sem depender do SMTP do Supabase)
CREATE TABLE IF NOT EXISTS public.dashdriver_password_resets (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pass_resets_token ON public.dashdriver_password_resets(token);
CREATE INDEX IF NOT EXISTS idx_pass_resets_user  ON public.dashdriver_password_resets(user_id);

-- Sem RLS: acesso somente pelo pool server-side (postgres superuser)
