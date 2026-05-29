-- Limites de conteúdo (texto, contagens, payload). Valores alinhados com packages/limits.

-- ── Normalizar dados existentes ──
UPDATE public.cards SET title = left(title, 200) WHERE char_length(title) > 200;
UPDATE public.cards SET description = left(description, 16000) WHERE char_length(description) > 16000;
UPDATE public.lists SET title = left(title, 200) WHERE char_length(title) > 200;
UPDATE public.boards SET title = left(title, 120) WHERE char_length(title) > 120;
UPDATE public.card_comments SET body = left(body, 4000) WHERE char_length(body) > 4000;
UPDATE public.messages SET body = left(body, 4000) WHERE char_length(body) > 4000;
UPDATE public.profiles SET name = left(name, 80) WHERE char_length(name) > 80;
UPDATE public.profiles SET bio = left(bio, 500) WHERE bio IS NOT NULL AND char_length(bio) > 500;
UPDATE public.profiles SET username = left(username, 32) WHERE char_length(username) > 32;

-- ── CHECK constraints ──
ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_title_len;
ALTER TABLE public.cards ADD CONSTRAINT cards_title_len CHECK (char_length(title) <= 200);

ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_description_len;
ALTER TABLE public.cards ADD CONSTRAINT cards_description_len CHECK (char_length(COALESCE(description, '')) <= 16000);

ALTER TABLE public.cards DROP CONSTRAINT IF EXISTS cards_labels_count;
ALTER TABLE public.cards ADD CONSTRAINT cards_labels_count CHECK (jsonb_array_length(COALESCE(labels, '[]'::jsonb)) <= 15);

ALTER TABLE public.lists DROP CONSTRAINT IF EXISTS lists_title_len;
ALTER TABLE public.lists ADD CONSTRAINT lists_title_len CHECK (char_length(title) <= 200);

ALTER TABLE public.boards DROP CONSTRAINT IF EXISTS boards_title_len;
ALTER TABLE public.boards ADD CONSTRAINT boards_title_len CHECK (char_length(title) <= 120);

ALTER TABLE public.card_comments DROP CONSTRAINT IF EXISTS card_comments_body_len;
ALTER TABLE public.card_comments ADD CONSTRAINT card_comments_body_len CHECK (char_length(body) <= 4000);

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_body_len;
ALTER TABLE public.messages ADD CONSTRAINT messages_body_len CHECK (char_length(body) <= 4000);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_name_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_name_len CHECK (char_length(COALESCE(name, '')) <= 80);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_bio_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 500);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_len CHECK (char_length(username) >= 2 AND char_length(username) <= 32);

-- ── RPC: chat ──
CREATE OR REPLACE FUNCTION public.send_chat_message(
  p_conversation_id uuid,
  p_body text,
  p_message_type text DEFAULT 'text',
  p_attachment_url text DEFAULT NULL,
  p_attachment_meta jsonb DEFAULT NULL
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  msg public.messages;
  other_id uuid;
  trimmed text := COALESCE(trim(p_body), '');
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF char_length(trimmed) > 4000 THEN RAISE EXCEPTION 'message_too_long'; END IF;
  IF NOT public.can_send_conversation_message(p_conversation_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.messages (
    conversation_id, sender_id, body, message_type, attachment_url, attachment_meta
  )
  VALUES (
    p_conversation_id,
    me,
    trimmed,
    COALESCE(p_message_type, 'text'),
    p_attachment_url,
    p_attachment_meta
  )
  RETURNING * INTO msg;

  UPDATE public.conversations SET last_message_at = now() WHERE id = p_conversation_id;

  SELECT cp.user_id INTO other_id
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = p_conversation_id AND cp.user_id <> me
  LIMIT 1;

  IF other_id IS NOT NULL THEN
    INSERT INTO public.message_receipts (message_id, user_id, delivered_at)
    VALUES (msg.id, other_id, CASE WHEN public.is_user_online(other_id) THEN now() ELSE NULL END)
    ON CONFLICT (message_id, user_id) DO NOTHING;
  END IF;

  RETURN msg;
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_chat_message(p_message_id uuid, p_body text)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  msg public.messages;
  trimmed text := trim(p_body);
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF char_length(trimmed) > 4000 THEN RAISE EXCEPTION 'message_too_long'; END IF;
  IF char_length(trimmed) = 0 THEN RAISE EXCEPTION 'empty_message'; END IF;
  SELECT * INTO msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF msg.sender_id <> me THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF msg.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'deleted'; END IF;
  IF msg.created_at < now() - interval '15 minutes' THEN RAISE EXCEPTION 'edit_window_expired'; END IF;

  UPDATE public.messages
  SET body = trimmed, edited_at = now()
  WHERE id = p_message_id
  RETURNING * INTO msg;
  RETURN msg;
END;
$$;

-- ── upsert_board_full: tamanho e contagens (base: 20260528140200) ──
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
  v_list_count int;
  v_card_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN '{"success":false,"error":"Não autenticado"}'::jsonb;
  END IF;

  IF octet_length(p_board::text) > 524288 THEN
    RETURN '{"success":false,"error":"Board payload too large"}'::jsonb;
  END IF;

  IF char_length(COALESCE(p_board->>'title', '')) > 120 THEN
    RETURN '{"success":false,"error":"Board title too long"}'::jsonb;
  END IF;

  v_list_count := jsonb_array_length(COALESCE(p_board->'lists', '[]'::jsonb));
  IF v_list_count > 40 THEN
    RETURN '{"success":false,"error":"Too many lists"}'::jsonb;
  END IF;

  SELECT count(*) INTO v_card_count
  FROM jsonb_array_elements(COALESCE(p_board->'lists', '[]'::jsonb)) AS li,
       LATERAL jsonb_array_elements(COALESCE(li->'cards', '[]'::jsonb)) AS ci;
  IF v_card_count > 12000 THEN
    RETURN '{"success":false,"error":"Too many cards"}'::jsonb;
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
    left(COALESCE(p_board->>'title', 'Novo Board'), 120),
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
    left(COALESCE(li->>'title', 'Nova Lista'), 200),
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
    left(COALESCE(ci->>'title', 'Nova Tarefa'), 200),
    left(COALESCE(ci->>'description', ''), 16000),
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
    left(COALESCE(si->>'title', ''), 200),
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
