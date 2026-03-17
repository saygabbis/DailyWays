-- CORREÇÃO DEFINITIVA: quebra dependência circular de RLS
-- boards → board_members → boards = loop infinito → erro 500
--
-- Solução: função SECURITY DEFINER para verificar owner sem passar por RLS

-- 1. Função helper: verifica se o usuário é owner do board (bypassa RLS)
CREATE OR REPLACE FUNCTION public.is_board_owner(p_board_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards WHERE id = p_board_id AND owner_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_board_owner(uuid) TO authenticated;

-- 2. Recriar TODAS as policies de board_members (sem referência direta a boards)
DROP POLICY IF EXISTS "Board members can be read by board owner or members" ON public.board_members;
DROP POLICY IF EXISTS "Board members readable by owner or self" ON public.board_members;
DROP POLICY IF EXISTS "Board members select" ON public.board_members;
DROP POLICY IF EXISTS "Board owner can insert/update/delete members" ON public.board_members;
DROP POLICY IF EXISTS "Board owner manages members" ON public.board_members;

-- SELECT: membro vê sua própria row OU owner do board vê todos
CREATE POLICY "Board members select"
  ON public.board_members FOR SELECT
  USING (user_id = auth.uid() OR is_board_owner(board_id));

-- INSERT/UPDATE/DELETE: apenas owner do board
CREATE POLICY "Board owner manages members"
  ON public.board_members FOR INSERT
  WITH CHECK (is_board_owner(board_id));

CREATE POLICY "Board owner updates members"
  ON public.board_members FOR UPDATE
  USING (is_board_owner(board_id))
  WITH CHECK (is_board_owner(board_id));

CREATE POLICY "Board owner deletes members"
  ON public.board_members FOR DELETE
  USING (is_board_owner(board_id));

-- 3. Policies de board_invitations (corrigidas com auth.jwt())
DROP POLICY IF EXISTS "Invitees can view own invitations" ON public.board_invitations;
DROP POLICY IF EXISTS "Invitees can update own invitations" ON public.board_invitations;

CREATE POLICY "Invitees can view own invitations"
  ON public.board_invitations FOR SELECT
  USING (
    invitee_user_id = auth.uid()
    OR lower(invitee_email) = lower(auth.jwt() ->> 'email')
  );

CREATE POLICY "Invitees can update own invitations"
  ON public.board_invitations FOR UPDATE
  USING (
    invitee_user_id = auth.uid()
    OR lower(invitee_email) = lower(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    invitee_user_id = auth.uid()
    OR lower(invitee_email) = lower(auth.jwt() ->> 'email')
  );
