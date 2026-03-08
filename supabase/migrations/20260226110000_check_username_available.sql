-- RPC para checar se um username está disponível (usado na tela de cadastro, anon).
-- Retorna true se disponível, false se já registrado.
CREATE OR REPLACE FUNCTION public.check_username_available(u text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE lower(trim(username)) = lower(trim(u)) LIMIT 1
  );
$$;

GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO authenticated;
