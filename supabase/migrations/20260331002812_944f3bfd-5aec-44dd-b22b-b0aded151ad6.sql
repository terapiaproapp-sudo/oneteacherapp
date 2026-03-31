
-- Create packages table
CREATE TABLE public.packages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  hours_total NUMERIC NOT NULL DEFAULT 0,
  hours_used NUMERIC NOT NULL DEFAULT 0,
  total_value NUMERIC NOT NULL DEFAULT 0,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add package_id to lessons
ALTER TABLE public.lessons ADD COLUMN package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL;

-- Add installment columns to payments
ALTER TABLE public.payments ADD COLUMN package_id UUID REFERENCES public.packages(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN installment_number INTEGER DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN total_installments INTEGER DEFAULT NULL;

-- Enable RLS on packages
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own packages" ON public.packages FOR SELECT USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can insert own packages" ON public.packages FOR INSERT WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own packages" ON public.packages FOR UPDATE USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own packages" ON public.packages FOR DELETE USING (auth.uid() = teacher_id);

-- Add updated_at trigger to packages
CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON public.packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
