-- 1) Não-donos podem apagar a própria linha em board_members (sair do board).
-- Antes só o dono podia DELETE em membros → convidados não conseguiam sair.

DROP POLICY IF EXISTS "Board members can leave (delete own row if not owner)" ON public.board_members;

CREATE POLICY "Board members can leave (delete own row if not owner)"
  ON public.board_members FOR DELETE
  USING (
    user_id = auth.uid()
    AND NOT public.is_board_owner(board_id)
  );

-- 2) Convite: não criar convite se o utilizador já for membro (por id de perfil).

CREATE OR REPLACE FUNCTION public.invite_board_member(p_board_id uuid, p_email text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_owner_id uuid;
  v_profile_id uuid;
  v_invitation_exists boolean;
  v_role text;
BEGIN
  SELECT owner_id INTO v_owner_id FROM public.boards WHERE id = p_board_id;
  IF v_owner_id IS NULL OR v_owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o owner do board pode convidar membros.' USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('editor', 'reader') THEN
    RAISE EXCEPTION 'Role inválido. Use editor ou reader.' USING ERRCODE = '22023';
  END IF;
  v_role := p_role;

  SELECT p.id
    INTO v_profile_id
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE lower(u.email) = lower(p_email)
    LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.board_members
      WHERE board_id = p_board_id AND user_id = v_profile_id
    ) THEN
      RAISE EXCEPTION 'Este utilizador já é membro deste board.' USING ERRCODE = '23505';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.board_invitations
    WHERE board_id = p_board_id
      AND inviter_id = v_owner_id
      AND lower(invitee_email) = lower(p_email)
      AND status = 'pending'
  ) INTO v_invitation_exists;

  IF v_invitation_exists THEN
    RETURN;
  END IF;

  INSERT INTO public.board_invitations (board_id, inviter_id, invitee_email, invitee_user_id, role, status)
  VALUES (p_board_id, v_owner_id, p_email, v_profile_id, v_role, 'pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_board_member(uuid, text, text) TO authenticated;
