-- Membros não-dono só viam a própria linha em board_members (policy antiga:
-- user_id = auth.uid() OR is_board_owner). Quem foi convidado não via o dono
-- nem outros membros → toolbar e lista "Membros" vazias.
--
-- Solução: qualquer utilizador que pertença ao board pode ler todas as linhas
-- desse board (via função SECURITY DEFINER para evitar recursão em RLS).

CREATE OR REPLACE FUNCTION public.auth_user_is_board_member(p_board_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.auth_user_is_board_member(uuid) TO authenticated;

DROP POLICY IF EXISTS "Board members select" ON public.board_members;

CREATE POLICY "Board members select"
  ON public.board_members FOR SELECT
  USING (
    public.is_board_owner(board_id)
    OR public.auth_user_is_board_member(board_id)
  );
