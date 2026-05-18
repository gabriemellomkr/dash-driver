-- Tabela de promoções dos apps de corrida.
-- Rodar no SQL Editor do Supabase (ou psql).

CREATE TABLE IF NOT EXISTS dashdriver_promos (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  plataforma    text        NOT NULL,
  descricao     text        NOT NULL,
  data_inicio   date        NOT NULL,
  data_fim      date        NOT NULL,
  meta_corridas integer     DEFAULT NULL,
  bonus_valor   numeric     DEFAULT NULL,
  ativa         boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promos_user_id ON dashdriver_promos(user_id);
CREATE INDEX IF NOT EXISTS idx_promos_ativa   ON dashdriver_promos(user_id, ativa, data_fim);

ALTER TABLE dashdriver_promos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own promos" ON dashdriver_promos
  FOR ALL USING (auth.uid() = user_id);
