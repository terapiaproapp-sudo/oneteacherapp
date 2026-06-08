ALTER TABLE public.profiles ALTER COLUMN plan SET DEFAULT NULL;
ALTER TABLE public.profiles ALTER COLUMN status SET DEFAULT 'pendente';

-- Garantir que perfis existentes sem plano fiquem como pendentes se necessário
-- UPDATE public.profiles SET status = 'pendente' WHERE plan IS NULL AND status = 'ativo';
