
-- 1. Cria o trigger faltante em auth.users para chamar handle_new_user a cada novo cadastro.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Recupera o profile faltante apenas do usuário de teste. Sem ativar plano.
INSERT INTO public.profiles (id, email, full_name, status)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name',''), 'pendente'
FROM auth.users u
WHERE u.id = '96ca6577-4b0a-498b-b34a-20cf74c39904'
ON CONFLICT (id) DO NOTHING;

-- 3. Garante o papel padrão (handle_new_user também faz isso para novos usuários).
INSERT INTO public.user_roles (user_id, role)
VALUES ('96ca6577-4b0a-498b-b34a-20cf74c39904', 'user')
ON CONFLICT (user_id, role) DO NOTHING;
