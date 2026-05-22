-- Table for push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    device_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for push_subscriptions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'push_subscriptions' AND policyname = 'Users can manage their own subscriptions'
    ) THEN
        CREATE POLICY "Users can manage their own subscriptions"
        ON public.push_subscriptions
        FOR ALL
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Add notification settings to profiles if not exists
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
    "daily_summary": true,
    "daily_summary_time": "07:00",
    "lesson_reminder": true,
    "lesson_reminder_lead_time": "15"
}'::jsonb;

-- Trigger to update updated_at on push_subscriptions
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.push_subscriptions;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
