
-- 1. Tighten receipts storage policies to enforce ownership via path prefix
DROP POLICY IF EXISTS "Authenticated users can view receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update receipts" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete receipts" ON storage.objects;

CREATE POLICY "Owners can view their receipts"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners can upload their receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners can update their receipts"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners can delete their receipts"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Enforce student_access permission flags for payments & packages
DROP POLICY IF EXISTS "Students view own payments" ON public.payments;
CREATE POLICY "Students view own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_access sa
    WHERE sa.student_id = payments.student_id
      AND sa.user_id = auth.uid()
      AND sa.is_active = true
      AND (
        COALESCE((sa.permissions->>'view_payments')::boolean, false) = true
        OR COALESCE((sa.permissions->>'view_financial')::boolean, false) = true
      )
  ));

DROP POLICY IF EXISTS "Students view own packages" ON public.packages;
CREATE POLICY "Students view own packages"
  ON public.packages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.student_access sa
    WHERE sa.student_id = packages.student_id
      AND sa.user_id = auth.uid()
      AND sa.is_active = true
      AND (
        COALESCE((sa.permissions->>'view_hours')::boolean, false) = true
        OR COALESCE((sa.permissions->>'view_financial')::boolean, false) = true
      )
  ));

-- 3. Fix mutable search_path on handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- 4. Allow users to view their own activity logs
CREATE POLICY "Users can view own logs"
  ON public.activity_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());
