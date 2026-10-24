-- Teste da upsert_board_full v3 (20261024190000). Rode DEPOIS da migration, no SQL Editor.
-- Não grava nada: o bloco termina com RAISE EXCEPTION, que desfaz toda a transação, e a
-- mensagem do erro traz o resultado de cada caso (ok=true esperado em todos).
-- Usa dois usuários existentes só como donos dos boards de teste (criados e desfeitos aqui).
DO $test$
DECLARE
  u1 uuid := (SELECT id FROM public.profiles ORDER BY id LIMIT 1);
  u2 uuid := (SELECT id FROM public.profiles WHERE id <> u1 ORDER BY id LIMIT 1);
  ba uuid := gen_random_uuid(); bb uuid := gen_random_uuid(); bc uuid := gen_random_uuid();
  la uuid := gen_random_uuid(); lb uuid := gen_random_uuid(); lc uuid := gen_random_uuid();
  ca uuid := gen_random_uuid(); cb uuid := gen_random_uuid();
  sa uuid := gen_random_uuid();
  g uuid;
  r jsonb; res jsonb := '[]'::jsonb; ctid_before tid; ctid_after tid; v_pos int; v_group uuid;
  ok boolean;
BEGIN
  INSERT INTO public.groups (owner_id, title, type) VALUES (u1, 'tst', 'board') RETURNING id INTO g;
  INSERT INTO public.boards (id, owner_id, title, position, group_id) VALUES
    (ba, u1, 'A', 1, NULL), (bb, u1, 'B', 7, g), (bc, u2, 'C', 0, NULL);
  INSERT INTO public.board_members (board_id, user_id, role) VALUES (bb, u2, 'editor');
  INSERT INTO public.lists (id, board_id, title, position) VALUES (la, ba, 'LA', 0), (lb, bb, 'LB', 0), (lc, bc, 'LC', 0);
  INSERT INTO public.cards (id, list_id, title, position) VALUES (ca, la, 'CA', 0), (cb, lb, 'CB', 0);
  INSERT INTO public.subtasks (id, card_id, title, position) VALUES (sa, ca, 'SA', 0);

  -- 1) u2 (dono de C) tenta puxar o card CA do board A para C
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true);
  r := public.upsert_board_full(jsonb_build_object('id', bc, 'title', 'C', 'lists', jsonb_build_array(
    jsonb_build_object('id', lc, 'title', 'LC', 'cards', jsonb_build_array(jsonb_build_object('id', ca, 'title', 'roubado'))))));
  ok := (r->>'success')::boolean IS FALSE AND (SELECT list_id FROM public.cards WHERE id = ca) = la;
  res := res || jsonb_build_object('caso', '1 roubar card de outro board', 'ok', ok, 'r', r);

  -- 2) u2 tenta renomear a lista LA (de A) via board C
  r := public.upsert_board_full(jsonb_build_object('id', bc, 'title', 'C', 'lists', jsonb_build_array(
    jsonb_build_object('id', la, 'title', 'hack'))));
  ok := (r->>'success')::boolean IS FALSE AND (SELECT title FROM public.lists WHERE id = la) = 'LA';
  res := res || jsonb_build_object('caso', '2 renomear lista de outro board', 'ok', ok, 'r', r);

  -- 3) u2 tenta apagar subtarefas de CA mandando CA sem subtasks
  r := public.upsert_board_full(jsonb_build_object('id', bc, 'title', 'C', 'lists', jsonb_build_array(
    jsonb_build_object('id', lc, 'title', 'LC', 'cards', jsonb_build_array(jsonb_build_object('id', ca, 'subtasks', '[]'::jsonb))))));
  ok := (r->>'success')::boolean IS FALSE AND EXISTS (SELECT 1 FROM public.subtasks WHERE id = sa);
  res := res || jsonb_build_object('caso', '3 apagar subtarefa de outro board', 'ok', ok, 'r', r);

  -- 4) u2 (editor de B) salva B com outra posição/pasta: pasta e posição do dono ficam
  r := public.upsert_board_full(jsonb_build_object('id', bb, 'title', 'B2', 'position', 99, 'groupId', NULL,
    'lists', jsonb_build_array(jsonb_build_object('id', lb, 'title', 'LB', 'cards', jsonb_build_array(jsonb_build_object('id', cb, 'title', 'CB'))))));
  SELECT position, group_id INTO v_pos, v_group FROM public.boards WHERE id = bb;
  ok := (r->>'success')::boolean AND v_pos = 7 AND v_group = g AND (SELECT title FROM public.boards WHERE id = bb) = 'B2';
  res := res || jsonb_build_object('caso', '4 editor não muda pasta/posição do dono', 'ok', ok, 'r', r);

  -- 5) editor tenta virar dono por UPDATE direto
  BEGIN
    UPDATE public.boards SET owner_id = u2 WHERE id = bb;
    ok := false;
  EXCEPTION WHEN insufficient_privilege THEN ok := true;
  END;
  res := res || jsonb_build_object('caso', '5 trocar owner_id por UPDATE', 'ok', ok);

  -- 6) u2 sem acesso a A
  r := public.upsert_board_full(jsonb_build_object('id', ba, 'title', 'A', 'lists', '[]'::jsonb));
  ok := (r->>'success')::boolean IS FALSE AND EXISTS (SELECT 1 FROM public.lists WHERE id = la);
  res := res || jsonb_build_object('caso', '6 sem acesso ao board', 'ok', ok, 'r', r);

  -- 7) dono salva A sem mudar nada: nenhuma linha reescrita (ctid igual)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  SELECT ctid INTO ctid_before FROM public.cards WHERE id = ca;
  r := public.upsert_board_full(jsonb_build_object('id', ba, 'title', 'A', 'position', 1, 'emoji', '📋',
    'lists', jsonb_build_array(jsonb_build_object('id', la, 'title', 'LA', 'cards', jsonb_build_array(
      jsonb_build_object('id', ca, 'title', 'CA', 'subtasks', jsonb_build_array(jsonb_build_object('id', sa, 'title', 'SA', 'position', 0))))))));
  SELECT ctid INTO ctid_after FROM public.cards WHERE id = ca;
  ok := (r->>'success')::boolean AND ctid_before = ctid_after;
  res := res || jsonb_build_object('caso', '7 save sem mudança não reescreve', 'ok', ok, 'r', r);

  -- 8) dono muda o título do card: grava
  r := public.upsert_board_full(jsonb_build_object('id', ba, 'title', 'A', 'position', 1, 'emoji', '📋',
    'lists', jsonb_build_array(jsonb_build_object('id', la, 'title', 'LA', 'cards', jsonb_build_array(
      jsonb_build_object('id', ca, 'title', 'CA novo', 'subtasks', jsonb_build_array(jsonb_build_object('id', sa, 'title', 'SA', 'position', 0))))))));
  ok := (r->>'success')::boolean AND (SELECT title FROM public.cards WHERE id = ca) = 'CA novo';
  res := res || jsonb_build_object('caso', '8 mudança grava', 'ok', ok, 'r', r);

  -- 9) dono move CB de B para A (escreve nos dois): permitido
  r := public.upsert_board_full(jsonb_build_object('id', ba, 'title', 'A', 'position', 1, 'emoji', '📋',
    'lists', jsonb_build_array(jsonb_build_object('id', la, 'title', 'LA', 'cards', jsonb_build_array(
      jsonb_build_object('id', ca, 'title', 'CA novo', 'subtasks', jsonb_build_array(jsonb_build_object('id', sa, 'title', 'SA', 'position', 0))),
      jsonb_build_object('id', cb, 'title', 'CB'))))));
  ok := (r->>'success')::boolean AND (SELECT list_id FROM public.cards WHERE id = cb) = la;
  res := res || jsonb_build_object('caso', '9 mover card entre boards com escrita nos dois', 'ok', ok, 'r', r);

  -- 10) dono reordena B por UPDATE direto: vale
  UPDATE public.boards SET position = 3 WHERE id = bb;
  ok := (SELECT position FROM public.boards WHERE id = bb) = 3;
  res := res || jsonb_build_object('caso', '10 dono muda posição', 'ok', ok);

  RAISE EXCEPTION 'RESULTADO (rollback): todos_ok=% %',
    NOT EXISTS (SELECT 1 FROM jsonb_array_elements(res) e WHERE (e->>'ok')::boolean IS NOT TRUE), res;
END
$test$;
