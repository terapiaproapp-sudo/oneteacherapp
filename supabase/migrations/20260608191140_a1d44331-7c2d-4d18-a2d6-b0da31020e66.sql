DROP POLICY IF EXISTS "Teachers can create their own recurrence logs" ON public.recurrence_logs;
DROP POLICY IF EXISTS "Teachers can view their own recurrence logs" ON public.recurrence_logs;

CREATE POLICY "Teachers can create their own recurrence logs"
ON public.recurrence_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can view their own recurrence logs"
ON public.recurrence_logs
FOR SELECT
TO authenticated
USING (auth.uid() = teacher_id);