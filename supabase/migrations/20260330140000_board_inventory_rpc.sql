-- Inventário real de boards (bypass RLS) para o cliente detetar quando fetchBoards
-- veio vazio por política RLS errada — evita recriar "Meu Primeiro Board" em loop.

CREATE OR REPLACE FUNCTION public.board_inventory_for_current_user()
RETURNS TABLE (owned_boards bigint, membership_rows bigint)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::bigint FROM public.boards WHERE owner_id = auth.uid()),
    (SELECT count(*)::bigint FROM public.board_members WHERE user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.board_inventory_for_current_user() TO authenticated;
