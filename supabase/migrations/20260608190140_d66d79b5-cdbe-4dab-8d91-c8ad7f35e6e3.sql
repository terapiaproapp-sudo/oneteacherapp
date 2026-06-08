DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

DROP POLICY IF EXISTS "Teachers update student access" ON public.student_access;
CREATE POLICY "Teachers update student access"
  ON public.student_access
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

REVOKE ALL ON FUNCTION public.temp_trigger_daily_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.temp_trigger_daily_summary() FROM anon;
REVOKE ALL ON FUNCTION public.temp_trigger_daily_summary() FROM authenticated;

REVOKE ALL ON FUNCTION public.upsert_service_role_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_service_role_secret(text) FROM anon;
REVOKE ALL ON FUNCTION public.upsert_service_role_secret(text) FROM authenticated;