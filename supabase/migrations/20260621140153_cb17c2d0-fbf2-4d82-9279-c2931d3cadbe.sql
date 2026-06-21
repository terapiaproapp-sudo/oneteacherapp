ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS reconciliation_status text,
  ADD COLUMN IF NOT EXISTS reconciliation_note text,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciled_by uuid;

CREATE INDEX IF NOT EXISTS idx_lessons_reconciliation_status
  ON public.lessons (student_id, reconciliation_status)
  WHERE package_id IS NULL;