-- Ajustar a função para ser segura e não acessível via API
ALTER FUNCTION public.has_role(UUID, text) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, text) FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, text) TO service_role;
