
DROP POLICY IF EXISTS "Teachers insert student access" ON public.student_access;
-- INSERT em student_access agora só é feito pela edge function create-student-access
-- usando o service_role, que ignora RLS. Nenhuma policy de INSERT para authenticated.
