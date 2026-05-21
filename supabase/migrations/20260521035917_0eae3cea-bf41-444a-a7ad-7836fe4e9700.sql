-- Add columns to students table if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'students' AND column_name = 'enrollment_type') THEN
        ALTER TABLE public.students ADD COLUMN enrollment_type TEXT DEFAULT 'pacote';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'students' AND column_name = 'hourly_rate') THEN
        ALTER TABLE public.students ADD COLUMN hourly_rate NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Update existing records to have a default enrollment_type
UPDATE public.students SET enrollment_type = 'pacote' WHERE enrollment_type IS NULL;
