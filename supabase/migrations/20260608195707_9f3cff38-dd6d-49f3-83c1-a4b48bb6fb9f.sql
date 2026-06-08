REVOKE ALL ON FUNCTION public.has_role(UUID, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, text) TO postgres;
