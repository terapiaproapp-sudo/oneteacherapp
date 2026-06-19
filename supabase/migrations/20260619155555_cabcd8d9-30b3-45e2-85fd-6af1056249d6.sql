-- Idempotency table for Newexy webhook events
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'newexy',
  event_id text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'processed',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  plan text,
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webhook_events_provider_event_id_unique UNIQUE (provider, event_id)
);

GRANT ALL ON public.webhook_events TO service_role;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: only service_role (edge function) may access.
-- Admins can read via service-role or admin tooling if needed in the future.
CREATE POLICY "Admins can view webhook events"
ON public.webhook_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON public.webhook_events (event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id ON public.webhook_events (user_id);