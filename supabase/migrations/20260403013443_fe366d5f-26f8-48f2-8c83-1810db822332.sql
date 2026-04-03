
CREATE TABLE public.student_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  user_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  permissions JSONB NOT NULL DEFAULT '{"view_hours":true,"view_schedule":true,"view_history":true,"view_absences":true,"view_financial":false,"view_payments":false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id),
  UNIQUE(user_id)
);

ALTER TABLE public.student_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers select student access" ON public.student_access FOR SELECT TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers insert student access" ON public.student_access FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers update student access" ON public.student_access FOR UPDATE TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers delete student access" ON public.student_access FOR DELETE TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Students view own access" ON public.student_access FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Students view own student record" ON public.students FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_access sa WHERE sa.student_id = id AND sa.user_id = auth.uid() AND sa.is_active = true));

CREATE POLICY "Students view own lessons" ON public.lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_access sa WHERE sa.student_id = student_id AND sa.user_id = auth.uid() AND sa.is_active = true));

CREATE POLICY "Students view own packages" ON public.packages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_access sa WHERE sa.student_id = student_id AND sa.user_id = auth.uid() AND sa.is_active = true));

CREATE POLICY "Students view own payments" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.student_access sa WHERE sa.student_id = student_id AND sa.user_id = auth.uid() AND sa.is_active = true));

CREATE TRIGGER update_student_access_updated_at
  BEFORE UPDATE ON public.student_access
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
