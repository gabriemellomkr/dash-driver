-- Admin users
CREATE TABLE IF NOT EXISTS dashdriver_admins (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  nome       text,
  created_at timestamptz DEFAULT now()
);

-- User plans
CREATE TABLE IF NOT EXISTS dashdriver_plans (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plano                 text NOT NULL DEFAULT 'trial',  -- trial | basic | premium | expired
  trial_ends_at         timestamptz,
  stripe_customer_id    text,
  stripe_subscription_id text,
  stripe_status         text,
  obs                   text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plans_user_id ON dashdriver_plans(user_id);
ALTER TABLE dashdriver_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own plan" ON dashdriver_plans FOR SELECT USING (auth.uid() = user_id);

-- Support tickets
CREATE TABLE IF NOT EXISTS dashdriver_support (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo     text NOT NULL,
  mensagem   text NOT NULL,
  status     text NOT NULL DEFAULT 'open',  -- open | in_progress | resolved
  resposta   text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_user_id ON dashdriver_support(user_id);
ALTER TABLE dashdriver_support ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tickets" ON dashdriver_support FOR ALL USING (auth.uid() = user_id);

-- Token usage tracking (OCR and future AI features)
CREATE TABLE IF NOT EXISTS dashdriver_token_usage (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  feature    text NOT NULL,  -- 'ocr_corrida'
  tokens_in  integer DEFAULT 0,
  tokens_out integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON dashdriver_token_usage(user_id);
ALTER TABLE dashdriver_token_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own usage" ON dashdriver_token_usage FOR SELECT USING (auth.uid() = user_id);
