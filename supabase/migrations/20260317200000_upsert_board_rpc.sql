-- RPC: upsert_board_full
-- Salva um board completo (board + lists + cards + subtasks) em uma única transação.
-- SECURITY DEFINER: bypassa RLS (verifica acesso manualmente uma única vez).
-- Elimina múltiplos round-trips HTTP e overhead de RLS em cada query.

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
  -- 0. Auth + permission check (uma única vez)
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
      WHERE board_id = v_board_id AND user_id = v_user_id AND role IN ('owner','editor');
    END IF;
  ELSE
    -- Board novo: quem cria é o owner
    v_has_access := true;
    v_owner_id := v_user_id;
  END IF;

  IF NOT COALESCE(v_has_access, false) THEN
    RETURN '{"success":false,"error":"Sem permissão"}'::jsonb;
  END IF;

  -- 1. Coletar IDs do payload
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

  -- 2. Upsert board
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

  -- 3. Deletar órfãos (subtasks → cards → lists)
  DELETE FROM public.subtasks
  WHERE card_id = ANY(v_card_ids) AND id != ALL(v_subtask_ids);

  DELETE FROM public.cards
  WHERE list_id IN (SELECT id FROM public.lists WHERE board_id = v_board_id)
    AND id != ALL(v_card_ids);

  DELETE FROM public.lists
  WHERE board_id = v_board_id AND id != ALL(v_list_ids);

  -- 4. Upsert lists (set-based, sem loop)
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

  -- 5. Upsert cards (set-based, sem loop)
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

  -- 6. Upsert subtasks (set-based, sem loop)
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

GRANT EXECUTE ON FUNCTION public.upsert_board_full(jsonb) TO authenticated;
