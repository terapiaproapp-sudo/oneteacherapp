
-- Store service role key in Vault (idempotent)
DO $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  IF v_key IS NULL THEN
    PERFORM vault.create_secret(
      current_setting('app.settings.service_role_key', true),
      'service_role_key',
      'Service role key for internal cron calls'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- ignore; we'll set it below if needed
  NULL;
END $$;

-- Unschedule broken jobs
SELECT cron.unschedule('process-daily-summaries');
SELECT cron.unschedule('process-lesson-reminders');

-- Reschedule using hardcoded project URL + vault-stored service role key
SELECT cron.schedule(
  'process-daily-summaries',
  '*/5 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://vazqhruppvzaytenqdtt.supabase.co/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := jsonb_build_object('type', 'daily-summary')
  ) AS request_id;
  $cmd$
);

SELECT cron.schedule(
  'process-lesson-reminders',
  '*/5 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://vazqhruppvzaytenqdtt.supabase.co/functions/v1/process-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1)
    ),
    body := jsonb_build_object('type', 'lesson-reminders')
  ) AS request_id;
  $cmd$
);
