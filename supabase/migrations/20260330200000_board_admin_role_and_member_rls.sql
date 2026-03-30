-- Papel "admin" em board_members + RLS para admins gerirem membros (exceto dono).
-- Inclui "admin" nas políticas de escrita de boards/lists/cards/subtasks (como editor).

-- 1) Role admin
ALTER TABLE public.board_members DROP CONSTRAINT IF EXISTS board_members_role_check;
ALTER TABLE public.board_members
  ADD CONSTRAINT board_members_role_check
  CHECK (role IN ('owner', 'admin', 'editor', 'reader'));

-- 2) Helpers SECURITY DEFINER (sem recursão em RLS)
CREATE OR REPLACE FUNCTION public.is_board_admin(p_board_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members
    WHERE board_id = p_board_id AND user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.board_member_target_is_board_owner(p_board_id uuid, p_member_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards
    WHERE id = p_board_id AND owner_id = p_member_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_board_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.board_member_target_is_board_owner(uuid, uuid) TO authenticated;

-- 3) board_members: admins podem UPDATE/DELETE linhas de não-donos; só editor/reader no WITH CHECK (admins não promovem a admin)
DROP POLICY IF EXISTS "Board admins update non-owner members" ON public.board_members;
CREATE POLICY "Board admins update non-owner members"
  ON public.board_members FOR UPDATE
  USING (
    public.is_board_admin(board_id)
    AND NOT public.board_member_target_is_board_owner(board_id, user_id)
  )
  WITH CHECK (
    public.is_board_admin(board_id)
    AND NOT public.board_member_target_is_board_owner(board_id, user_id)
    AND role IN ('editor', 'reader')
  );

DROP POLICY IF EXISTS "Board admins remove non-owner members" ON public.board_members;
CREATE POLICY "Board admins remove non-owner members"
  ON public.board_members FOR DELETE
  USING (
    public.is_board_admin(board_id)
    AND NOT public.board_member_target_is_board_owner(board_id, user_id)
  );

-- 4) Conteúdo: admin equivalente a editor
DROP POLICY IF EXISTS "Boards write owner or editors" ON public.boards;
CREATE POLICY "Boards write owner or editors"
  ON public.boards FOR ALL
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.board_members bm
      WHERE bm.board_id = boards.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','admin','editor')
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.board_members bm
      WHERE bm.board_id = boards.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','admin','editor')
    )
  );

DROP POLICY IF EXISTS "Lists write owner or editors" ON public.lists;
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
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','admin','editor')
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
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','admin','editor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Cards write owner or editors" ON public.cards;
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
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','admin','editor')
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
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','admin','editor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Subtasks write owner or editors" ON public.subtasks;
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
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','admin','editor')
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
            WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner','admin','editor')
          )
        )
    )
  );

-- 5) RPC upsert_board_full: admin pode gravar
CREATE OR REPLACE FUNCTION public.upsert_board_full(p_board jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_board_id uuid := (p_board->>'id')::uuid;
  v_owner_id uuid;
  v_has_access boolean := false;
  v_list_ids uuid[];
  v_card_ids uuid[];
  v_subtask_ids uuid[];
BEGIN
  IF v_user_id IS NULL THEN
    RETURN '{"success":false,"error":"Não autenticado"}'::jsonb;
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.boards WHERE id = v_board_id;
  IF v_owner_id IS NOT NULL THEN
    IF v_owner_id = v_user_id THEN
      v_has_access := true;
    ELSE
      SELECT true INTO v_has_access
      FROM public.board_members
      WHERE board_id = v_board_id AND user_id = v_user_id AND role IN ('owner','admin','editor');
    END IF;
  ELSE
    v_has_access := true;
    v_owner_id := v_user_id;
  END IF;

  IF NOT COALESCE(v_has_access, false) THEN
    RETURN '{"success":false,"error":"Sem permissão"}'::jsonb;
  END IF;

  v_list_ids := ARRAY(
    SELECT (li->>'id')::uuid
    FROM jsonb_array_elements(COALESCE(p_board->'lists', '[]'::jsonb)) AS li
  );

  v_card_ids := ARRAY(
    SELECT (ci->>'id')::uuid
    FROM jsonb_array_elements(COALESCE(p_board->'lists', '[]'::jsonb)) AS li,
         LATERAL jsonb_array_elements(COALESCE(li->'cards', '[]'::jsonb)) AS ci
  );

  v_subtask_ids := ARRAY(
    SELECT (si->>'id')::uuid
    FROM jsonb_array_elements(COALESCE(p_board->'lists', '[]'::jsonb)) AS li,
         LATERAL jsonb_array_elements(COALESCE(li->'cards', '[]'::jsonb)) AS ci,
         LATERAL jsonb_array_elements(COALESCE(ci->'subtasks', '[]'::jsonb)) AS si
  );

  INSERT INTO public.boards (id, owner_id, title, color, emoji, position, group_id, updated_at)
  VALUES (
    v_board_id, v_owner_id,
    COALESCE(p_board->>'title', 'Novo Board'),
    p_board->>'color',
    COALESCE(p_board->>'emoji', '📋'),
    COALESCE((p_board->>'position')::int, 0),
    (p_board->>'groupId')::uuid,
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title, color = EXCLUDED.color, emoji = EXCLUDED.emoji,
    position = EXCLUDED.position, group_id = EXCLUDED.group_id, updated_at = EXCLUDED.updated_at;

  DELETE FROM public.subtasks
  WHERE card_id = ANY(v_card_ids) AND id != ALL(v_subtask_ids);

  DELETE FROM public.cards
  WHERE list_id IN (SELECT id FROM public.lists WHERE board_id = v_board_id)
    AND id != ALL(v_card_ids);

  DELETE FROM public.lists
  WHERE board_id = v_board_id AND id != ALL(v_list_ids);

  INSERT INTO public.lists (id, board_id, title, position, color, is_completion_list)
  SELECT
    (li->>'id')::uuid,
    v_board_id,
    COALESCE(li->>'title', 'Nova Lista'),
    (li_ord - 1)::int,
    li->>'color',
    COALESCE((li->>'isCompletionList')::boolean, false)
  FROM jsonb_array_elements(COALESCE(p_board->'lists', '[]'::jsonb))
       WITH ORDINALITY AS t(li, li_ord)
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title, position = EXCLUDED.position,
    color = EXCLUDED.color, is_completion_list = EXCLUDED.is_completion_list;

  INSERT INTO public.cards (id, list_id, title, description, priority, due_date, my_day, labels, color, created_at, completed, position)
  SELECT
    (ci->>'id')::uuid,
    (li->>'id')::uuid,
    COALESCE(ci->>'title', 'Nova Tarefa'),
    COALESCE(ci->>'description', ''),
    COALESCE(ci->>'priority', 'none'),
    (ci->>'dueDate')::timestamptz,
    COALESCE((ci->>'myDay')::boolean, false),
    COALESCE(ci->'labels', '[]'::jsonb),
    ci->>'color',
    COALESCE((ci->>'createdAt')::timestamptz, now()),
    COALESCE((ci->>'completed')::boolean, false),
    (ci_ord - 1)::int
  FROM jsonb_array_elements(COALESCE(p_board->'lists', '[]'::jsonb)) AS li,
       LATERAL jsonb_array_elements(COALESCE(li->'cards', '[]'::jsonb))
              WITH ORDINALITY AS c(ci, ci_ord)
  ON CONFLICT (id) DO UPDATE SET
    list_id = EXCLUDED.list_id, title = EXCLUDED.title,
    description = EXCLUDED.description, priority = EXCLUDED.priority,
    due_date = EXCLUDED.due_date, my_day = EXCLUDED.my_day,
    labels = EXCLUDED.labels, color = EXCLUDED.color,
    completed = EXCLUDED.completed, position = EXCLUDED.position;

  INSERT INTO public.subtasks (id, card_id, title, done)
  SELECT
    (si->>'id')::uuid,
    (ci->>'id')::uuid,
    COALESCE(si->>'title', ''),
    COALESCE((si->>'done')::boolean, false)
  FROM jsonb_array_elements(COALESCE(p_board->'lists', '[]'::jsonb)) AS li,
       LATERAL jsonb_array_elements(COALESCE(li->'cards', '[]'::jsonb)) AS ci,
       LATERAL jsonb_array_elements(COALESCE(ci->'subtasks', '[]'::jsonb)) AS si
  ON CONFLICT (id) DO UPDATE SET
    card_id = EXCLUDED.card_id, title = EXCLUDED.title, done = EXCLUDED.done;

  RETURN '{"success":true}'::jsonb;
END;
$$;
