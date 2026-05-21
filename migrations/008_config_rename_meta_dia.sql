-- Renomeia meta_dia → meta_diaria para alinhar com o código.
-- Remove colunas antigas duplicadas (meta_semana, meta_mes foram
-- substituídas por meta_semanal e meta_mensal na migration 003).
-- Rodar no SQL Editor do Supabase.

ALTER TABLE public.dashdriver_config
  RENAME COLUMN meta_dia TO meta_diaria;

ALTER TABLE public.dashdriver_config
  DROP COLUMN IF EXISTS meta_semana,
  DROP COLUMN IF EXISTS meta_mes;
