
-- Add phone column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text DEFAULT '';

-- Allow students to read their teacher's profile (name, phone) via student_access
CREATE POLICY "Students can view teacher profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.student_access sa
    WHERE sa.teacher_id = profiles.id
      AND sa.user_id = auth.uid()
      AND sa.is_active = true
  )
);
