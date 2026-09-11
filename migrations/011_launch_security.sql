-- Review on a database copy, then apply before the matching application deployment.
BEGIN;
ALTER TABLE public.dashdriver_plans ADD COLUMN IF NOT EXISTS lastlink_subscription_id text;
ALTER TABLE public.dashdriver_plans ADD COLUMN IF NOT EXISTS lastlink_event_at timestamptz;
ALTER TABLE public.dashdriver_plans ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE TABLE IF NOT EXISTS public.dashdriver_webhook_events (
 event_id text PRIMARY KEY,
 event_type text NOT NULL,
 event_at timestamptz NOT NULL,
 user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dashdriver_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dashdriver_webhook_events FROM anon, authenticated;
-- RLS is necessary even when only server-side code is intended to use a table.
ALTER TABLE public.dashdriver_password_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dashdriver_password_resets FROM anon, authenticated;
-- Billing is server-managed; users can only read their own plan via its RLS policy.
REVOKE INSERT, UPDATE, DELETE ON public.dashdriver_plans FROM anon, authenticated;
REVOKE ALL ON public.dashdriver_admins FROM anon, authenticated;
ALTER TABLE public.dashdriver_admins ENABLE ROW LEVEL SECURITY;
COMMIT;
