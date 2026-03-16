-- Board sharing: convites, roles reader/editor e RLS refinada
-- Esta migration supõe que as tabelas básicas já existem (ver 20250218120000_initial_schema.sql).

-- 1) Ajustar coluna role em board_members para suportar owner/editor/reader
ALTER TABLE public.board_members
  ALTER COLUMN role SET DEFAULT 'editor';

ALTER TABLE public.board_members
  ADD CONSTRAINT board_members_role_check
  CHECK (role IN ('owner', 'editor', 'reader'));

-- 2) Tabela de convites para boards
CREATE TABLE IF NOT EXISTS public.board_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  invitee_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'reader',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NULL
);

ALTER TABLE public.board_invitations ENABLE ROW LEVEL SECURITY;

-- Apenas o owner do board pode ver os convites desse board
CREATE POLICY "Board owner can view invitations"
  ON public.board_invitations FOR SELECT
  USING (
    auth.uid() = (SELECT owner_id FROM public.boards WHERE id = board_id)
  );

-- 3) Função: convidar membro por e-mail
CREATE OR REPLACE FUNCTION public.invite_board_member(p_board_id uuid, p_email text, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_owner_id uuid;
  v_profile_id uuid;
BEGIN
  -- Apenas owner do board pode convidar
  SELECT owner_id INTO v_owner_id FROM public.boards WHERE id = p_board_id;
  IF v_owner_id IS NULL OR v_owner_id <> auth.uid() THEN
    RAISE EXCEPTION 'Somente o owner do board pode convidar membros.' USING ERRCODE = '42501';
  END IF;

  -- Normalizar role
  IF p_role NOT IN ('editor', 'reader') THEN
    RAISE EXCEPTION 'Role inválido. Use editor ou reader.' USING ERRCODE = '22023';
  END IF;

  -- Descobrir se já existe profile com esse e-mail
  SELECT p.id
  INTO v_profile_id
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    -- Garante entrada em board_members
    INSERT INTO public.board_members (board_id, user_id, role)
    VALUES (p_board_id, v_profile_id, p_role)
    ON CONFLICT (board_id, user_id) DO UPDATE
      SET role = EXCLUDED.role;

    -- Registra convite como accepted (audit)
    INSERT INTO public.board_invitations (board_id, inviter_id, invitee_email, invitee_user_id, role, status)
    VALUES (p_board_id, v_owner_id, p_email, v_profile_id, p_role, 'accepted');
  ELSE
    -- Usuário ainda não existe: convite pendente
    INSERT INTO public.board_invitations (board_id, inviter_id, invitee_email, invitee_user_id, role, status)
    VALUES (p_board_id, v_owner_id, p_email, NULL, p_role, 'pending');
  END IF;
END;
$$;

-- 4) Função: aceitar convite
CREATE OR REPLACE FUNCTION public.accept_board_invitation(p_invite_id uuid)
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

  SELECT * INTO v_invite FROM public.board_invitations WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.' USING ERRCODE = '22023';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'Convite não está mais pendente.' USING ERRCODE = '22023';
  END IF;

  -- Confere se o convite é deste usuário (por user_id ou email)
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  IF v_invite.invitee_user_id IS NOT NULL AND v_invite.invitee_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Convite pertence a outro usuário.' USING ERRCODE = '42501';
  END IF;

  IF v_invite.invitee_user_id IS NULL AND lower(v_invite.invitee_email) <> lower(v_email) THEN
    RAISE EXCEPTION 'Convite pertence a outro e-mail.' USING ERRCODE = '42501';
  END IF;

  -- Garante profile_id
  IF v_invite.invitee_user_id IS NULL THEN
    UPDATE public.board_invitations
      SET invitee_user_id = v_user_id
    WHERE id = p_invite_id;
  END IF;

  -- Adiciona membro ao board
  INSERT INTO public.board_members (board_id, user_id, role)
  VALUES (v_invite.board_id, v_user_id, v_invite.role)
  ON CONFLICT (board_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

  UPDATE public.board_invitations
    SET status = 'accepted'
  WHERE id = p_invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_board_member(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_board_invitation(uuid) TO authenticated;

-- 5) RLS refinado para reader/editor

-- Boards: leitura para owner ou qualquer membro; escrita só owner/editor
DROP POLICY IF EXISTS "Users can do all on own boards" ON public.boards;
DROP POLICY IF EXISTS "Members can select and update shared boards" ON public.boards;

CREATE POLICY "Boards select owner or members"
  ON public.boards FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.board_members bm
      WHERE bm.board_id = boards.id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Boards write owner or editors"
  ON public.boards FOR ALL
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.board_members bm
      WHERE bm.board_id = boards.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','editor')
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.board_members bm
      WHERE bm.board_id = boards.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','editor')
    )
  );

-- Lists: seguem acesso de leitura do board, escrita só para owner/editor
DROP POLICY IF EXISTS "Lists follow board access" ON public.lists;

CREATE POLICY "Lists select follow board access"
  ON public.lists FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.boards b
      WHERE b.id = lists.board_id
        AND (
          b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.board_members bm
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Lists write owner or editors"
  ON public.lists FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.boards b
      WHERE b.id = lists.board_id
        AND (
          b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.board_members bm
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','editor')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.boards b
      WHERE b.id = lists.board_id
        AND (
          b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.board_members bm
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','editor')
          )
        )
    )
  );

-- Cards: seguem acesso de leitura do board, escrita só para owner/editor
DROP POLICY IF EXISTS "Cards follow list/board access" ON public.cards;

CREATE POLICY "Cards select follow board access"
  ON public.cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.lists l
      JOIN public.boards b ON b.id = l.board_id
      WHERE l.id = cards.list_id
        AND (
          b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.board_members bm
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Cards write owner or editors"
  ON public.cards FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.lists l
      JOIN public.boards b ON b.id = l.board_id
      WHERE l.id = cards.list_id
        AND (
          b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.board_members bm
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','editor')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.lists l
      JOIN public.boards b ON b.id = l.board_id
      WHERE l.id = cards.list_id
        AND (
          b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.board_members bm
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','editor')
          )
        )
    )
  );

-- Subtasks: seguem acesso de leitura do board, escrita só para owner/editor
DROP POLICY IF EXISTS "Subtasks follow card access" ON public.subtasks;

CREATE POLICY "Subtasks select follow board access"
  ON public.subtasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.cards c
      JOIN public.lists l ON l.id = c.list_id
      JOIN public.boards b ON b.id = l.board_id
      WHERE c.id = subtasks.card_id
        AND (
          b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.board_members bm
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "Subtasks write owner or editors"
  ON public.subtasks FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.cards c
      JOIN public.lists l ON l.id = c.list_id
      JOIN public.boards b ON b.id = l.board_id
      WHERE c.id = subtasks.card_id
        AND (
          b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.board_members bm
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','editor')
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.cards c
      JOIN public.lists l ON l.id = c.list_id
      JOIN public.boards b ON b.id = l.board_id
      WHERE c.id = subtasks.card_id
        AND (
          b.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.board_members bm
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','editor')
          )
        )
    )
  );

