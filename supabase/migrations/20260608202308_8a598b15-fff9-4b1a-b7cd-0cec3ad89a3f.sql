-- Função para excluir usuário e perfil pelo Admin
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- Permite rodar com privilégios elevados para deletar em auth.users
SET search_path = public
AS $$
BEGIN
    -- Verificar se o usuário que está chamando a função é um admin
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Acesso negado. Apenas administradores podem excluir usuários.';
    END IF;

    -- 1. Remover perfil primeiro (FKs devem estar com ON DELETE CASCADE para o resto)
    DELETE FROM public.profiles WHERE id = target_user_id;

    -- 2. Remover o usuário da tabela de autenticação
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Garantir acesso de execução apenas para usuários autenticados (a verificação interna garante ser admin)
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(UUID) TO service_role;
