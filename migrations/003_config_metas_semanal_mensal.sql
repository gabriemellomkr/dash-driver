-- Adiciona metas semanal e mensal à tabela de configuração.
-- Rodar no SQL Editor do Supabase (ou psql).

ALTER TABLE dashdriver_config
  ADD COLUMN IF NOT EXISTS meta_semanal numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_mensal  numeric DEFAULT 0;
