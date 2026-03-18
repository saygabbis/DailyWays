-- Board sharing: invite deve SEMPRE criar convite pendente.
-- Antes: se o invitee já existia (profile encontrado), a função inseria em board_members e marcava invitation como accepted.
-- Agora: nunca coloca em board_members até o invitee aceitar.

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
  -- Owner-only: quem convida precisa ser owner do board
  SELECT owner_id INTO v_owner_id FROM public.boards WHERE id = p_board_id;
  IF v_owner_id IS NULL OR v_owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o owner do board pode convidar membros.' USING ERRCODE = '42501';
  END IF;

  -- Role normalization
  IF p_role NOT IN ('editor', 'reader') THEN
    RAISE EXCEPTION 'Role inválido. Use editor ou reader.' USING ERRCODE = '22023';
  END IF;
  v_role := p_role;

  -- Descobrir se já existe profile com esse e-mail
  SELECT p.id
    INTO v_profile_id
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE lower(u.email) = lower(p_email)
    LIMIT 1;

  -- Evita spam: se já existe convite PENDENTE igual, não criar outro
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

  -- Cria convite pendente (invitee_user_id pode existir ou ficar NULL)
  INSERT INTO public.board_invitations (board_id, inviter_id, invitee_email, invitee_user_id, role, status)
  VALUES (p_board_id, v_owner_id, p_email, v_profile_id, v_role, 'pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_board_member(uuid, text, text) TO authenticated;

