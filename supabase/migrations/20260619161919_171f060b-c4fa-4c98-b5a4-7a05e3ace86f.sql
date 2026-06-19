
DROP POLICY IF EXISTS "Teachers insert student access" ON public.student_access;
CREATE POLICY "Teachers insert student access"
ON public.student_access
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = teacher_id
  AND auth.uid() <> user_id
  AND NOT EXISTS (
    SELECT 1 FROM public.student_access sa
    WHERE sa.user_id = auth.uid()
  )
);

CREATE POLICY "Users can read own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
