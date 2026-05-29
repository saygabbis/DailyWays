-- Impede criar board novo via upsert_board_full (IDOR); criação só via INSERT RLS em boards

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
  IF v_owner_id IS NULL THEN
    RETURN '{"success":false,"error":"Board not found"}'::jsonb;
  END IF;

  IF v_owner_id = v_user_id THEN
    v_has_access := true;
  ELSE
    SELECT true INTO v_has_access
    FROM public.board_members
    WHERE board_id = v_board_id AND user_id = v_user_id AND role IN ('owner','admin','editor');
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

  INSERT INTO public.cards (
    id, list_id, title, description, priority, due_date, start_date,
    is_all_day, recurrence_rule, my_day, labels, color, cover_attachment_id,
    created_at, updated_at, completed, position
  )
  SELECT
    (ci->>'id')::uuid,
    (li->>'id')::uuid,
    COALESCE(ci->>'title', 'Nova Tarefa'),
    COALESCE(ci->>'description', ''),
    COALESCE(ci->>'priority', 'none'),
    (ci->>'dueDate')::timestamptz,
    (ci->>'startDate')::timestamptz,
    COALESCE((ci->>'isAllDay')::boolean, true),
    ci->>'recurrenceRule',
    COALESCE((ci->>'myDay')::boolean, false),
    COALESCE(ci->'labels', '[]'::jsonb),
    ci->>'color',
    (ci->>'coverAttachmentId')::uuid,
    COALESCE((ci->>'createdAt')::timestamptz, now()),
    COALESCE((ci->>'updatedAt')::timestamptz, now()),
    COALESCE((ci->>'completed')::boolean, false),
    (ci_ord - 1)::int
  FROM jsonb_array_elements(COALESCE(p_board->'lists', '[]'::jsonb)) AS li,
       LATERAL jsonb_array_elements(COALESCE(li->'cards', '[]'::jsonb))
              WITH ORDINALITY AS c(ci, ci_ord)
  ON CONFLICT (id) DO UPDATE SET
    list_id = EXCLUDED.list_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    priority = EXCLUDED.priority,
    due_date = EXCLUDED.due_date,
    start_date = EXCLUDED.start_date,
    is_all_day = EXCLUDED.is_all_day,
    recurrence_rule = EXCLUDED.recurrence_rule,
    my_day = EXCLUDED.my_day,
    labels = EXCLUDED.labels,
    color = EXCLUDED.color,
    cover_attachment_id = EXCLUDED.cover_attachment_id,
    updated_at = EXCLUDED.updated_at,
    completed = EXCLUDED.completed,
    position = EXCLUDED.position;

  INSERT INTO public.subtasks (
    id, card_id, title, done, position, link_url, link_label, created_at, updated_at
  )
  SELECT
    (si->>'id')::uuid,
    (ci->>'id')::uuid,
    COALESCE(si->>'title', ''),
    COALESCE((si->>'done')::boolean, false),
    COALESCE((si->>'position')::int, (si_ord - 1)::int),
    si->>'linkUrl',
    si->>'linkLabel',
    COALESCE((si->>'createdAt')::timestamptz, now()),
    COALESCE((si->>'updatedAt')::timestamptz, now())
  FROM jsonb_array_elements(COALESCE(p_board->'lists', '[]'::jsonb)) AS li,
       LATERAL jsonb_array_elements(COALESCE(li->'cards', '[]'::jsonb)) AS ci,
       LATERAL jsonb_array_elements(COALESCE(ci->'subtasks', '[]'::jsonb)) WITH ORDINALITY AS s(si, si_ord)
  ON CONFLICT (id) DO UPDATE SET
    card_id = EXCLUDED.card_id,
    title = EXCLUDED.title,
    done = EXCLUDED.done,
    position = EXCLUDED.position,
    link_url = EXCLUDED.link_url,
    link_label = EXCLUDED.link_label,
    updated_at = EXCLUDED.updated_at;

  RETURN '{"success":true}'::jsonb;
END;
$$;
