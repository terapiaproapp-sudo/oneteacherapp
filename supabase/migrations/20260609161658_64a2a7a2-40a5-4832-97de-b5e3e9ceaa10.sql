
-- students
DROP POLICY IF EXISTS "Teachers can delete own students" ON public.students;
DROP POLICY IF EXISTS "Teachers can insert own students" ON public.students;
DROP POLICY IF EXISTS "Teachers can update own students" ON public.students;
DROP POLICY IF EXISTS "Teachers can view own students" ON public.students;
CREATE POLICY "Teachers can view own students" ON public.students FOR SELECT TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own students" ON public.students FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own students" ON public.students FOR UPDATE TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own students" ON public.students FOR DELETE TO authenticated USING (auth.uid() = teacher_id);

-- lessons
DROP POLICY IF EXISTS "Teachers can delete own lessons" ON public.lessons;
DROP POLICY IF EXISTS "Teachers can insert own lessons" ON public.lessons;
DROP POLICY IF EXISTS "Teachers can update own lessons" ON public.lessons;
DROP POLICY IF EXISTS "Teachers can view own lessons" ON public.lessons;
CREATE POLICY "Teachers can view own lessons" ON public.lessons FOR SELECT TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own lessons" ON public.lessons FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own lessons" ON public.lessons FOR UPDATE TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own lessons" ON public.lessons FOR DELETE TO authenticated USING (auth.uid() = teacher_id);

-- packages
DROP POLICY IF EXISTS "Teachers can delete own packages" ON public.packages;
DROP POLICY IF EXISTS "Teachers can insert own packages" ON public.packages;
DROP POLICY IF EXISTS "Teachers can update own packages" ON public.packages;
DROP POLICY IF EXISTS "Teachers can view own packages" ON public.packages;
CREATE POLICY "Teachers can view own packages" ON public.packages FOR SELECT TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own packages" ON public.packages FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own packages" ON public.packages FOR UPDATE TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own packages" ON public.packages FOR DELETE TO authenticated USING (auth.uid() = teacher_id);

-- payments
DROP POLICY IF EXISTS "Teachers can delete own payments" ON public.payments;
DROP POLICY IF EXISTS "Teachers can insert own payments" ON public.payments;
DROP POLICY IF EXISTS "Teachers can update own payments" ON public.payments;
DROP POLICY IF EXISTS "Teachers can view own payments" ON public.payments;
CREATE POLICY "Teachers can view own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own payments" ON public.payments FOR UPDATE TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own payments" ON public.payments FOR DELETE TO authenticated USING (auth.uid() = teacher_id);

-- push_subscriptions
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their own subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- student_access: prevent a student account from inserting another access row for itself
DROP POLICY IF EXISTS "Teachers insert student access" ON public.student_access;
CREATE POLICY "Teachers insert student access" ON public.student_access
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = teacher_id
    AND NOT EXISTS (
      SELECT 1 FROM public.student_access sa
      WHERE sa.user_id = auth.uid() AND sa.is_active = true
    )
  );

-- Revoke EXECUTE from anon/public on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.temp_trigger_daily_summary() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_service_role_secret(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) TO authenticated, service_role;
