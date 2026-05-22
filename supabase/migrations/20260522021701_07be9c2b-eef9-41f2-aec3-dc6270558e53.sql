-- Add recurrence support columns to lessons table
ALTER TABLE public.lessons 
ADD COLUMN IF NOT EXISTS recurrence_id UUID,
ADD COLUMN IF NOT EXISTS recurrence_config JSONB,
ADD COLUMN IF NOT EXISTS recurrence_index INTEGER;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_lessons_recurrence_id ON public.lessons (recurrence_id);

-- Create a log table for auditing bulk updates (optional but good for history requirement)
CREATE TABLE IF NOT EXISTS public.recurrence_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES auth.users(id),
    recurrence_id UUID NOT NULL,
    action_type TEXT NOT NULL, -- 'update_series', 'delete_series', etc.
    affected_count INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS for the new log table
ALTER TABLE public.recurrence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their own recurrence logs"
ON public.recurrence_logs FOR SELECT
USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can create their own recurrence logs"
ON public.recurrence_logs FOR INSERT
WITH CHECK (auth.uid() = teacher_id);