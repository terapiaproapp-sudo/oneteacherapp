-- Primeiro recriamos a função para evitar quebras enquanto alteramos as políticas, 
-- mas desta vez ela será apenas um wrapper interno que não causa o loop de 401 se chamada corretamente via RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role text)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id 
    AND role::text = _role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar as políticas para usar a função de forma estável ou consulta direta
-- Vamos focar em garantir que a função exista mas não seja exposta ao PostgREST para evitar o loop 401 via RPC

-- Remover acesso público à função RPC (evita loop 401 via PostgREST)
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, text) TO service_role;

-- Agora a função só pode ser usada internamente pelo PostgreSQL (como em políticas de RLS) 
-- e não via API `/rpc/has_role`
