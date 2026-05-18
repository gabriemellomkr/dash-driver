-- Adiciona telefone do motorista para notificações WhatsApp (Layer 3).
-- Rodar no SQL Editor do Supabase (ou psql).

ALTER TABLE dashdriver_config
  ADD COLUMN IF NOT EXISTS telefone text DEFAULT '';
