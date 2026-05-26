-- Convite por @username ou e-mail (apenas utilizadores registados)
-- Partilha de spaces (membros + convites), espelhando boards

-- ── Resolver email/username → utilizador registado ─────────────────
CREATE OR REPLACE FUNCTION public.resolve_registered_invitee(p_identifier text)
RETURNS TABLE (user_id uuid, email text, username text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_raw text;
  v_key text;
  v_is_email boolean;
BEGIN
  v_raw := trim(coalesce(p_identifier, ''));
  IF v_raw = '' THEN
    RETURN;
  END IF;

  IF v_raw LIKE '@%' THEN
    v_key := lower(trim(substring(v_raw FROM 2)));
    v_is_email := false;
  ELSIF position('@' IN v_raw) > 1 AND v_raw ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    v_key := lower(v_raw);
    v_is_email := true;
  ELSE
    v_key := lower(v_raw);
    v_is_email := false;
  END IF;

  IF v_is_email THEN
    RETURN QUERY
    SELECT p.id, au.email::text, p.username::text
    FROM auth.users au
    JOIN public.profiles p ON p.id = au.id
    WHERE lower(au.email) = v_key
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT p.id, au.email::text, p.username::text
    FROM public.profiles p
    JOIN auth.users au ON au.id = p.id
    WHERE lower(trim(p.username)) = v_key
    LIMIT 1;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_registered_invitee(text) TO authenticated;

-- ── Board: convite só para utilizadores cadastrados ───────────────
CREATE OR REPLACE FUNCTION public.invite_board_member(p_board_id uuid, p_email text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_owner_id uuid;
  v_profile_id uuid;
  v_invitee_email text;
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

  SELECT r.user_id, r.email
    INTO v_profile_id, v_invitee_email
  FROM public.resolve_registered_invitee(p_email) r
  LIMIT 1;

  IF v_profile_id IS NULL OR v_invitee_email IS NULL THEN
    RAISE EXCEPTION 'Este utilizador não está cadastrado no DailyWays.' USING ERRCODE = '22023';
  END IF;

  IF v_profile_id = auth.uid() THEN
    RAISE EXCEPTION 'Não podes convidar-te a ti mesmo.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND user_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'Este utilizador já é membro deste board.' USING ERRCODE = '23505';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.board_invitations
    WHERE board_id = p_board_id
      AND inviter_id = v_owner_id
      AND lower(invitee_email) = lower(v_invitee_email)
      AND status = 'pending'
  ) INTO v_invitation_exists;

  IF v_invitation_exists THEN
    RETURN;
  END IF;

  INSERT INTO public.board_invitations (board_id, inviter_id, invitee_email, invitee_user_id, role, status)
  VALUES (p_board_id, v_owner_id, v_invitee_email, v_profile_id, v_role, 'pending');
END;
$$;

-- ── Spaces: membros e convites ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.space_members (
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor',
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (space_id, user_id),
  CONSTRAINT space_members_role_check CHECK (role IN ('editor', 'reader'))
);

ALTER TABLE public.space_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_space_owner(p_space_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spaces WHERE id = p_space_id AND owner_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_space_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_space(p_space_id uuid, p_need_write boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.spaces s
    WHERE s.id = p_space_id
      AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.space_members sm
          WHERE sm.space_id = s.id
            AND sm.user_id = auth.uid()
            AND (
              NOT p_need_write
              OR sm.role = 'editor'
            )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_space(uuid, boolean) TO authenticated;

DROP POLICY IF EXISTS "Space members select" ON public.space_members;
CREATE POLICY "Space members select"
  ON public.space_members FOR SELECT
  USING (user_id = auth.uid() OR is_space_owner(space_id));

DROP POLICY IF EXISTS "Space owner manages members" ON public.space_members;
CREATE POLICY "Space owner manages members"
  ON public.space_members FOR INSERT
  WITH CHECK (is_space_owner(space_id));

DROP POLICY IF EXISTS "Space owner updates members" ON public.space_members;
CREATE POLICY "Space owner updates members"
  ON public.space_members FOR UPDATE
  USING (is_space_owner(space_id))
  WITH CHECK (is_space_owner(space_id));

DROP POLICY IF EXISTS "Space owner deletes members" ON public.space_members;
CREATE POLICY "Space owner deletes members"
  ON public.space_members FOR DELETE
  USING (is_space_owner(space_id));

DROP POLICY IF EXISTS "Space members can leave" ON public.space_members;
CREATE POLICY "Space members can leave"
  ON public.space_members FOR DELETE
  USING (
    user_id = auth.uid()
    AND NOT is_space_owner(space_id)
  );

CREATE TABLE IF NOT EXISTS public.space_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  invitee_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'reader',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NULL,
  CONSTRAINT space_invitations_role_check CHECK (role IN ('editor', 'reader'))
);

ALTER TABLE public.space_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Space owner can view invitations" ON public.space_invitations;
CREATE POLICY "Space owner can view invitations"
  ON public.space_invitations FOR SELECT
  USING (is_space_owner(space_id));

DROP POLICY IF EXISTS "Space invitees can view own invitations" ON public.space_invitations;
CREATE POLICY "Space invitees can view own invitations"
  ON public.space_invitations FOR SELECT
  USING (
    invitee_user_id = auth.uid()
    OR lower(invitee_email) = lower(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "Space invitees can update own invitations" ON public.space_invitations;
CREATE POLICY "Space invitees can update own invitations"
  ON public.space_invitations FOR UPDATE
  USING (
    invitee_user_id = auth.uid()
    OR lower(invitee_email) = lower(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    invitee_user_id = auth.uid()
    OR lower(invitee_email) = lower(auth.jwt() ->> 'email')
  );

CREATE OR REPLACE FUNCTION public.invite_space_member(p_space_id uuid, p_identifier text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_owner_id uuid;
  v_profile_id uuid;
  v_invitee_email text;
  v_invitation_exists boolean;
  v_role text;
BEGIN
  SELECT owner_id INTO v_owner_id FROM public.spaces WHERE id = p_space_id;
  IF v_owner_id IS NULL OR v_owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o owner do space pode convidar membros.' USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('editor', 'reader') THEN
    RAISE EXCEPTION 'Role inválido. Use editor ou reader.' USING ERRCODE = '22023';
  END IF;
  v_role := p_role;

  SELECT r.user_id, r.email
    INTO v_profile_id, v_invitee_email
  FROM public.resolve_registered_invitee(p_identifier) r
  LIMIT 1;

  IF v_profile_id IS NULL OR v_invitee_email IS NULL THEN
    RAISE EXCEPTION 'Este utilizador não está cadastrado no DailyWays.' USING ERRCODE = '22023';
  END IF;

  IF v_profile_id = auth.uid() THEN
    RAISE EXCEPTION 'Não podes convidar-te a ti mesmo.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.space_members
    WHERE space_id = p_space_id AND user_id = v_profile_id
  ) THEN
    RAISE EXCEPTION 'Este utilizador já é membro deste space.' USING ERRCODE = '23505';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.space_invitations
    WHERE space_id = p_space_id
      AND inviter_id = v_owner_id
      AND lower(invitee_email) = lower(v_invitee_email)
      AND status = 'pending'
  ) INTO v_invitation_exists;

  IF v_invitation_exists THEN
    RETURN;
  END IF;

  INSERT INTO public.space_invitations (space_id, inviter_id, invitee_email, invitee_user_id, role, status)
  VALUES (p_space_id, v_owner_id, v_invitee_email, v_profile_id, v_role, 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_space_invitation(p_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invite record;
  v_user_id uuid;
  v_email text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invite FROM public.space_invitations WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.' USING ERRCODE = '22023';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'Convite não está mais pendente.' USING ERRCODE = '22023';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  IF v_invite.invitee_user_id IS NOT NULL AND v_invite.invitee_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Convite pertence a outro usuário.' USING ERRCODE = '42501';
  END IF;

  IF v_invite.invitee_user_id IS NULL AND lower(v_invite.invitee_email) <> lower(v_email) THEN
    RAISE EXCEPTION 'Convite pertence a outro e-mail.' USING ERRCODE = '42501';
  END IF;

  IF v_invite.invitee_user_id IS NULL THEN
    UPDATE public.space_invitations SET invitee_user_id = v_user_id WHERE id = p_invite_id;
  END IF;

  INSERT INTO public.space_members (space_id, user_id, role)
  VALUES (v_invite.space_id, v_user_id, v_invite.role)
  ON CONFLICT (space_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.space_invitations SET status = 'accepted' WHERE id = p_invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_space_member(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_space_invitation(uuid) TO authenticated;

-- Spaces: leitura para owner/membros; escrita para owner/editores
DROP POLICY IF EXISTS "Users can manage their own spaces" ON public.spaces;

DROP POLICY IF EXISTS "Spaces select owner or members" ON public.spaces;
CREATE POLICY "Spaces select owner or members"
  ON public.spaces FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.space_members sm
      WHERE sm.space_id = spaces.id AND sm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Spaces write owner or editors" ON public.spaces;
CREATE POLICY "Spaces write owner or editors"
  ON public.spaces FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.space_members sm
      WHERE sm.space_id = spaces.id AND sm.user_id = auth.uid() AND sm.role = 'editor'
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.space_members sm
      WHERE sm.space_id = spaces.id AND sm.user_id = auth.uid() AND sm.role = 'editor'
    )
  );

DROP POLICY IF EXISTS "Spaces insert own" ON public.spaces;
CREATE POLICY "Spaces insert own"
  ON public.spaces FOR INSERT
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Spaces delete own" ON public.spaces;
CREATE POLICY "Spaces delete own"
  ON public.spaces FOR DELETE
  USING (owner_id = auth.uid());

-- Whiteboard: acesso por membro do space
DROP POLICY IF EXISTS "Users can manage space_nodes of own spaces" ON public.space_nodes;
CREATE POLICY "Space nodes select members"
  ON public.space_nodes FOR SELECT
  USING (can_access_space(space_id, false));

DROP POLICY IF EXISTS "Space nodes write editors" ON public.space_nodes;
CREATE POLICY "Space nodes write editors"
  ON public.space_nodes FOR INSERT
  WITH CHECK (can_access_space(space_id, true));

DROP POLICY IF EXISTS "Space nodes update editors" ON public.space_nodes;
CREATE POLICY "Space nodes update editors"
  ON public.space_nodes FOR UPDATE
  USING (can_access_space(space_id, true))
  WITH CHECK (can_access_space(space_id, true));

DROP POLICY IF EXISTS "Space nodes delete editors" ON public.space_nodes;
CREATE POLICY "Space nodes delete editors"
  ON public.space_nodes FOR DELETE
  USING (can_access_space(space_id, true));

DROP POLICY IF EXISTS "Users can manage space_connectors of own spaces" ON public.space_connectors;
CREATE POLICY "Space connectors select members"
  ON public.space_connectors FOR SELECT
  USING (can_access_space(space_id, false));

DROP POLICY IF EXISTS "Space connectors insert editors" ON public.space_connectors;
CREATE POLICY "Space connectors insert editors"
  ON public.space_connectors FOR INSERT
  WITH CHECK (can_access_space(space_id, true));

DROP POLICY IF EXISTS "Space connectors update editors" ON public.space_connectors;
CREATE POLICY "Space connectors update editors"
  ON public.space_connectors FOR UPDATE
  USING (can_access_space(space_id, true))
  WITH CHECK (can_access_space(space_id, true));

DROP POLICY IF EXISTS "Space connectors delete editors" ON public.space_connectors;
CREATE POLICY "Space connectors delete editors"
  ON public.space_connectors FOR DELETE
  USING (can_access_space(space_id, true));

DROP POLICY IF EXISTS "Users can manage space_comments of own spaces" ON public.space_comments;
CREATE POLICY "Space comments access members"
  ON public.space_comments FOR ALL
  USING (can_access_space(space_id, false))
  WITH CHECK (can_access_space(space_id, true));

DROP POLICY IF EXISTS "Users can manage space_assets of own spaces" ON public.space_assets;
CREATE POLICY "Space assets access members"
  ON public.space_assets FOR ALL
  USING (can_access_space(space_id, false))
  WITH CHECK (can_access_space(space_id, true));

-- Realtime (idempotente)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.space_members;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'space_members already in realtime';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.space_invitations;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'space_invitations already in realtime';
END $$;
