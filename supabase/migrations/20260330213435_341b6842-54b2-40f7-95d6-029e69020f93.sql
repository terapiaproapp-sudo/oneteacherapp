
-- Create timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Students table
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  guardian_name TEXT DEFAULT '',
  guardian_phone TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  lesson_content TEXT DEFAULT '',
  modality TEXT DEFAULT 'online',
  hourly_rate NUMERIC DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'ativo',
  hours_contracted NUMERIC DEFAULT 0,
  hours_remaining NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own students" ON public.students FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own students" ON public.students FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own students" ON public.students FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own students" ON public.students FOR DELETE USING (auth.uid() = teacher_id);

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lessons table
CREATE TABLE public.lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  time TEXT NOT NULL DEFAULT '08:00',
  duration NUMERIC NOT NULL DEFAULT 1,
  subject TEXT DEFAULT '',
  status TEXT DEFAULT 'agendada',
  notes TEXT DEFAULT '',
  modality TEXT DEFAULT 'online',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own lessons" ON public.lessons FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own lessons" ON public.lessons FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own lessons" ON public.lessons FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own lessons" ON public.lessons FOR DELETE USING (auth.uid() = teacher_id);

CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON public.lessons FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date TEXT NOT NULL,
  paid_date TEXT,
  status TEXT DEFAULT 'pendente',
  payment_method TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own payments" ON public.payments FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own payments" ON public.payments FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own payments" ON public.payments FOR DELETE USING (auth.uid() = teacher_id);

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
