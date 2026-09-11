-- DashDriver: diagnóstico somente leitura. Não retorna registros pessoais.
-- Execute tudo no SQL Editor e copie o resultado JSON.
SELECT jsonb_build_object(
 'tables', (SELECT jsonb_agg(jsonb_build_object('name',c.relname,'rls',c.relrowsecurity,
   'anon_select',has_table_privilege('anon',c.oid,'SELECT'),
   'authenticated_select',has_table_privilege('authenticated',c.oid,'SELECT'),
   'authenticated_insert',has_table_privilege('authenticated',c.oid,'INSERT'),
   'authenticated_update',has_table_privilege('authenticated',c.oid,'UPDATE')) ORDER BY c.relname)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r' AND c.relname LIKE 'dashdriver_%'),
 'policies', (SELECT jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'roles',roles,'command',cmd,'using',qual,'check',with_check))
   FROM pg_policies WHERE schemaname='public' AND tablename LIKE 'dashdriver_%'),
 'columns', (SELECT jsonb_agg(jsonb_build_object('table',table_name,'column',column_name,'type',data_type,'nullable',is_nullable))
   FROM information_schema.columns WHERE table_schema='public' AND table_name IN
   ('dashdriver_plans','dashdriver_support','dashdriver_support_messages','dashdriver_push_subscriptions','dashdriver_config','dashdriver_password_resets')),
 'auth_triggers', (SELECT jsonb_agg(jsonb_build_object('trigger',tgname,'definition',pg_get_triggerdef(t.oid)))
   FROM pg_trigger t WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal)
) AS diagnostico;
