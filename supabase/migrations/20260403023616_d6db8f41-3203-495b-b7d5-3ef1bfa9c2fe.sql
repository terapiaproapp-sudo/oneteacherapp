
-- Drop and recreate broken student RLS policies

-- LESSONS
DROP POLICY IF EXISTS "Students view own lessons" ON public.lessons;
CREATE POLICY "Students view own lessons" ON public.lessons
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.student_access sa
  WHERE sa.student_id = lessons.student_id
    AND sa.user_id = auth.uid()
    AND sa.is_active = true
));

-- PACKAGES
DROP POLICY IF EXISTS "Students view own packages" ON public.packages;
CREATE POLICY "Students view own packages" ON public.packages
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.student_access sa
  WHERE sa.student_id = packages.student_id
    AND sa.user_id = auth.uid()
    AND sa.is_active = true
));

-- PAYMENTS
DROP POLICY IF EXISTS "Students view own payments" ON public.payments;
CREATE POLICY "Students view own payments" ON public.payments
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.student_access sa
  WHERE sa.student_id = payments.student_id
    AND sa.user_id = auth.uid()
    AND sa.is_active = true
));

-- STUDENTS
DROP POLICY IF EXISTS "Students view own student record" ON public.students;
CREATE POLICY "Students view own student record" ON public.students
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.student_access sa
  WHERE sa.student_id = students.id
    AND sa.user_id = auth.uid()
    AND sa.is_active = true
));
