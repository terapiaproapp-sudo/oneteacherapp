
CREATE OR REPLACE FUNCTION public.upsert_service_role_secret(p_value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'service_role_key' LIMIT 1;
  IF v_id IS NULL THEN
    PERFORM vault.create_secret(p_value, 'service_role_key', 'Service role key for pg_cron');
  ELSE
    PERFORM vault.update_secret(v_id, p_value);
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_service_role_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_service_role_secret(text) TO service_role;
