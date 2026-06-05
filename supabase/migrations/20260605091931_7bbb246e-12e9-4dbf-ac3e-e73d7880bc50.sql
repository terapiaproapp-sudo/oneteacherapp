
SELECT vault.create_secret(
  encode(gen_random_bytes(32), 'hex'),
  'cron_secret',
  'Shared secret used by pg_cron to authenticate to process-notifications'
);
