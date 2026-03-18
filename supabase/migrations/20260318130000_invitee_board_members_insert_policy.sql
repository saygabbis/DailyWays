-- Permite que o invitee, ao aceitar, seja inserido em board_members
-- sem depender do owner (corrige o fluxo onde ACCEPT funcionava no RPC,
-- mas o board_members não aparecia para o usuário convidado por causa de RLS).

DROP POLICY IF EXISTS "Invitees can insert board_members from invitations" ON public.board_members;
DROP POLICY IF EXISTS "Invitees can update board_members from invitations" ON public.board_members;

-- INSERT: o invitee só pode criar sua linha em board_members se existir uma invitation pendente/aceita
CREATE POLICY "Invitees can insert board_members from invitations"
  ON public.board_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.board_invitations bi
      WHERE bi.board_id = board_members.board_id
        AND bi.invitee_user_id = auth.uid()
        AND bi.status IN ('pending', 'accepted')
    )
  );

-- UPDATE: cobre casos de upsert (ON CONFLICT) e ajuste de role após aceitar
CREATE POLICY "Invitees can update board_members from invitations"
  ON public.board_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.board_invitations bi
      WHERE bi.board_id = board_members.board_id
        AND bi.invitee_user_id = auth.uid()
        AND bi.status IN ('pending', 'accepted')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.board_invitations bi
      WHERE bi.board_id = board_members.board_id
        AND bi.invitee_user_id = auth.uid()
        AND bi.status IN ('pending', 'accepted')
    )
  );

