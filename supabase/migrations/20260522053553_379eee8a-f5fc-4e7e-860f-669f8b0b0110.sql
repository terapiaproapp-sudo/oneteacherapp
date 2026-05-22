-- Add generated endpoint column and unique constraint for upsert on (user_id, endpoint)
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS endpoint text
  GENERATED ALWAYS AS ((subscription->>'endpoint')) STORED;

-- Remove possible duplicates keeping the most recent per (user_id, endpoint)
DELETE FROM public.push_subscriptions a
USING public.push_subscriptions b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.endpoint IS NOT DISTINCT FROM b.endpoint;

CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_user_endpoint_key
  ON public.push_subscriptions (user_id, endpoint);