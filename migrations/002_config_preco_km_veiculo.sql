-- Adiciona colunas que faltam na tabela de configuração do motorista.
-- Rodar no SQL Editor do Supabase (ou psql).

ALTER TABLE dashdriver_config
  ADD COLUMN IF NOT EXISTS preco_km   numeric      DEFAULT 0,
  ADD COLUMN IF NOT EXISTS veiculo    jsonb        DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS timezone   text         DEFAULT 'America/Sao_Paulo';
