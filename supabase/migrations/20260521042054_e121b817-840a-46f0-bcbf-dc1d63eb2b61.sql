-- Add columns to lessons table to support separate billing for individual lessons
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'lessons' AND column_name = 'lesson_type') THEN
        ALTER TABLE public.lessons ADD COLUMN lesson_type TEXT DEFAULT 'pacote';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'lessons' AND column_name = 'amount') THEN
        ALTER TABLE public.lessons ADD COLUMN amount NUMERIC DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'lessons' AND column_name = 'payment_status') THEN
        ALTER TABLE public.lessons ADD COLUMN payment_status TEXT DEFAULT 'pendente';
    END IF;
    
    -- Ensure receipt_url is available (if not already added by other tools/features)
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = 'lessons' AND column_name = 'receipt_url') THEN
        ALTER TABLE public.lessons ADD COLUMN receipt_url TEXT;
    END IF;
END $$;

-- Update existing records to have a default lesson_type
UPDATE public.lessons SET lesson_type = 'pacote' WHERE lesson_type IS NULL;