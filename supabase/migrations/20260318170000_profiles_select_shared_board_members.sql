-- Permite que qualquer membro de um board leia os perfis (name/username/photo_url)
-- dos outros membros daquele mesmo board.
--
-- Isso resolve o bug onde um usuário via `fetchBoardMembers()` recebia `?`/vazio
-- por causa da policy atual de `public.profiles` que só permite ler o próprio perfil.

CREATE OR REPLACE FUNCTION public.is_shared_board_member(p_other_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.board_members bm1
    JOIN public.board_members bm2
      ON bm1.board_id = bm2.board_id
    WHERE bm1.user_id = p_other_user_id
      AND bm2.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_shared_board_member(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Profiles select by shared board membership'
  ) THEN
    CREATE POLICY "Profiles select by shared board membership"
      ON public.profiles
      FOR SELECT
      USING (
        auth.uid() = id
        OR public.is_shared_board_member(id)
      );
  END IF;
END $$;

