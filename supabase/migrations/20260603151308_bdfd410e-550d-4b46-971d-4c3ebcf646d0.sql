
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS start_date text NULL,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'avista';

-- Garante no máximo 1 pacote ativo por aluno
CREATE UNIQUE INDEX IF NOT EXISTS packages_one_active_per_student
  ON public.packages (student_id)
  WHERE status = 'ativo';

CREATE INDEX IF NOT EXISTS packages_student_status_idx
  ON public.packages (student_id, status);
