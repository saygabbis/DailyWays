-- upsert_board_full v3 (base: 20260529120000_content_and_upload_limits)
--
-- 1) Desempenho ("engarrafamento"): cada save fazia ON CONFLICT DO UPDATE em TODAS as listas,
--    cards e subtasks, mesmo sem mudança. Cada linha tocada vira um evento no Realtime e cada
--    cliente refazia a carga dos boards. Agora só linhas que mudaram de fato são escritas
--    (WHERE ... IS DISTINCT FROM EXCLUDED ...), e updated_at só anda quando algo mudou.
-- 2) Compartilhamento: um editor que salvava sobrescrevia group_id/position do dono e o board
--    mudava de pasta na sidebar do dono. Para quem não é dono, group_id/position ficam como estão
--    (aqui e no trigger boards_guard_owner_fields, que cobre o UPDATE direto na tabela).
-- 3) IDOR: os ids de listas, cards e subtasks do payload não eram conferidos contra o board.
--    Um editor do board A podia mandar o id de um card do board B e roubá-lo (list_id), renomear
--    listas de B ou apagar subtasks de cards de B. Agora:
--      - lista de outro board: rejeitada (listas não mudam de board);
--      - card/subtask de outro board: só se o usuário também puder escrever naquele board
--        (mover entre dois boards em que ele é editor continua permitido).
-- 4) Diário: dayCategory/estimatedMinutes dos cards não eram gravados pela RPC (só no INSERT do
--    board novo), então a categoria da missão sumia ao recarregar. Agora vão junto (valor inválido
--    vira NULL em vez de derrubar o save inteiro pelo CHECK).

-- Helper interno: o usuário pode escrever no board? (dono ou owner/admin/editor em board_members)
CREATE OR REPLACE FUNCTION public.dw_can_write_board(p_board_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards b
    WHERE b.id = p_board_id
      AND (
        b.owner_id = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.board_members bm
          WHERE bm.board_id = b.id AND bm.user_id = p_user_id
            AND bm.role IN ('owner', 'admin', 'editor')
        )
      )
  );
$$;

-- Só é usado dentro de funções SECURITY DEFINER; ninguém chama via /rpc.
REVOKE EXECUTE ON FUNCTION public.dw_can_write_board(uuid, uuid) FROM PUBLIC, anon, authenticated;

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
  v_is_owner boolean := false;
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

  v_is_owner := v_owner_id = v_user_id;
  IF NOT v_is_owner AND NOT public.dw_can_write_board(v_board_id, v_user_id) THEN
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

  -- ── IDOR: ids que já existem em outro board ──
  IF EXISTS (
    SELECT 1 FROM public.lists l
    WHERE l.id = ANY(v_list_ids) AND l.board_id <> v_board_id
  ) THEN
    RETURN '{"success":false,"error":"Lista pertence a outro board"}'::jsonb;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON l.id = c.list_id
    WHERE c.id = ANY(v_card_ids)
      AND l.board_id <> v_board_id
      AND NOT public.dw_can_write_board(l.board_id, v_user_id)
  ) THEN
    RETURN '{"success":false,"error":"Card pertence a outro board"}'::jsonb;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.subtasks s
    JOIN public.cards c ON c.id = s.card_id
    JOIN public.lists l ON l.id = c.list_id
    WHERE s.id = ANY(v_subtask_ids)
      AND l.board_id <> v_board_id
      AND NOT public.dw_can_write_board(l.board_id, v_user_id)
  ) THEN
    RETURN '{"success":false,"error":"Subtarefa pertence a outro board"}'::jsonb;
  END IF;

  -- ── Board: só escreve se algo mudou; group_id/position são do dono ──
  UPDATE public.boards b SET
    title = x.title,
    color = x.color,
    emoji = x.emoji,
    position = CASE WHEN v_is_owner THEN x.position ELSE b.position END,
    group_id = CASE WHEN v_is_owner THEN x.group_id ELSE b.group_id END,
    updated_at = now()
  FROM (
    SELECT
      left(COALESCE(p_board->>'title', 'Novo Board'), 120) AS title,
      p_board->>'color' AS color,
      COALESCE(p_board->>'emoji', '📋') AS emoji,
      COALESCE((p_board->>'position')::int, 0) AS position,
      (p_board->>'groupId')::uuid AS group_id
  ) x
  WHERE b.id = v_board_id
    AND (
      (b.title, b.color, b.emoji) IS DISTINCT FROM (x.title, x.color, x.emoji)
      OR (v_is_owner AND (b.position, b.group_id) IS DISTINCT FROM (x.position, x.group_id))
    );

  -- ── Remoções (o payload é o estado completo do board) ──
  DELETE FROM public.subtasks
  WHERE card_id = ANY(v_card_ids) AND id <> ALL(v_subtask_ids);

  DELETE FROM public.cards
  WHERE list_id IN (SELECT id FROM public.lists WHERE board_id = v_board_id)
    AND id <> ALL(v_card_ids);

  DELETE FROM public.lists
  WHERE board_id = v_board_id AND id <> ALL(v_list_ids);

  -- ── Listas ──
  INSERT INTO public.lists AS t (id, board_id, title, position, color, is_completion_list)
  SELECT
    (li->>'id')::uuid,
    v_board_id,
    left(COALESCE(li->>'title', 'Nova Lista'), 200),
    (li_ord - 1)::int,
    li->>'color',
    COALESCE((li->>'isCompletionList')::boolean, false)
  FROM jsonb_array_elements(COALESCE(p_board->'lists', '[]'::jsonb))
       WITH ORDINALITY AS l(li, li_ord)
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    position = EXCLUDED.position,
    color = EXCLUDED.color,
    is_completion_list = EXCLUDED.is_completion_list
  WHERE (t.title, t.position, t.color, t.is_completion_list)
        IS DISTINCT FROM
        (EXCLUDED.title, EXCLUDED.position, EXCLUDED.color, EXCLUDED.is_completion_list);

  -- ── Cards ──
  INSERT INTO public.cards AS t (
    id, list_id, title, description, priority, due_date, start_date,
    is_all_day, recurrence_rule, my_day, labels, color, cover_attachment_id,
    created_at, updated_at, completed, position, day_category, estimated_minutes
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
    (ci_ord - 1)::int,
    CASE WHEN ci->>'dayCategory' IN ('essential', 'creative', 'self') THEN ci->>'dayCategory' END,
    CASE WHEN (ci->>'estimatedMinutes') ~ '^[0-9]{1,6}$' THEN (ci->>'estimatedMinutes')::int END
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
    updated_at = GREATEST(EXCLUDED.updated_at, t.updated_at),
    completed = EXCLUDED.completed,
    position = EXCLUDED.position,
    day_category = EXCLUDED.day_category,
    estimated_minutes = EXCLUDED.estimated_minutes
  WHERE (t.list_id, t.title, t.description, t.priority, t.due_date, t.start_date,
         t.is_all_day, t.recurrence_rule, t.my_day, t.labels, t.color,
         t.cover_attachment_id, t.completed, t.position, t.day_category, t.estimated_minutes)
        IS DISTINCT FROM
        (EXCLUDED.list_id, EXCLUDED.title, EXCLUDED.description, EXCLUDED.priority,
         EXCLUDED.due_date, EXCLUDED.start_date, EXCLUDED.is_all_day,
         EXCLUDED.recurrence_rule, EXCLUDED.my_day, EXCLUDED.labels, EXCLUDED.color,
         EXCLUDED.cover_attachment_id, EXCLUDED.completed, EXCLUDED.position,
         EXCLUDED.day_category, EXCLUDED.estimated_minutes);

  -- ── Subtarefas ──
  INSERT INTO public.subtasks AS t (
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
    updated_at = GREATEST(EXCLUDED.updated_at, t.updated_at)
  WHERE (t.card_id, t.title, t.done, t.position, t.link_url, t.link_label)
        IS DISTINCT FROM
        (EXCLUDED.card_id, EXCLUDED.title, EXCLUDED.done, EXCLUDED.position,
         EXCLUDED.link_url, EXCLUDED.link_label);

  RETURN '{"success":true}'::jsonb;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.upsert_board_full(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_board_full(jsonb) TO authenticated, service_role;

-- UPDATE direto em boards (sidebar reordena com .update({position})): quem não é dono não mexe
-- na pasta/posição do dono, e ninguém troca o dono por UPDATE.
CREATE OR REPLACE FUNCTION public.boards_guard_owner_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Sem sessão = service role / jobs internos: sem restrição.
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'owner_id não pode ser alterado' USING ERRCODE = '42501';
  END IF;
  IF v_uid <> OLD.owner_id THEN
    NEW.group_id := OLD.group_id;
    NEW.position := OLD.position;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS boards_guard_owner_fields ON public.boards;
CREATE TRIGGER boards_guard_owner_fields
  BEFORE UPDATE ON public.boards
  FOR EACH ROW EXECUTE FUNCTION public.boards_guard_owner_fields();
