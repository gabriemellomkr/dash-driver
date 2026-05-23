-- Corrige o DEFAULT do campo id em dashdriver_config.
-- O campo estava com DEFAULT 1 (literal) em vez de uma sequência,
-- causando "duplicate key value violates unique constraint dashdriver_config_pkey"
-- toda vez que mais de um usuário era criado via admin ou trigger.

-- 1. Cria a sequência (idempotente)
CREATE SEQUENCE IF NOT EXISTS public.dashdriver_config_id_seq;

-- 2. Aponta a sequência para o valor maior que o id atual + 1
SELECT setval(
  'public.dashdriver_config_id_seq',
  COALESCE((SELECT MAX(id) FROM public.dashdriver_config), 0) + 1,
  false
);

-- 3. Faz o campo id usar a sequência como default
ALTER TABLE public.dashdriver_config
  ALTER COLUMN id SET DEFAULT nextval('public.dashdriver_config_id_seq');

-- 4. Vincula a sequência à coluna (DROP TABLE derruba a sequência junto)
ALTER SEQUENCE public.dashdriver_config_id_seq
  OWNED BY public.dashdriver_config.id;
