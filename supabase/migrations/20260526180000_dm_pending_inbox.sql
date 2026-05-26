-- DM para amigos (contatos mútuos); não-amigos → caixa de entrada pendente.

CREATE OR REPLACE FUNCTION public.are_mutual_contacts(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    user_a IS NOT NULL
    AND user_b IS NOT NULL
    AND user_a <> user_b
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.user_id = user_a AND c.contact_user_id = user_b
    )
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.user_id = user_b AND c.contact_user_id = user_a
    );
$$;

GRANT EXECUTE ON FUNCTION public.are_mutual_contacts(uuid, uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.dm_message_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS dm_message_requests_one_pending_pair
  ON public.dm_message_requests (sender_id, recipient_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.dm_request_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.dm_message_requests(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(trim(body)) > 0)
);

ALTER TABLE public.dm_message_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_request_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dm_requests_select_parties" ON public.dm_message_requests;
CREATE POLICY "dm_requests_select_parties"
  ON public.dm_message_requests FOR SELECT
  USING (auth.uid() IN (sender_id, recipient_id));

DROP POLICY IF EXISTS "dm_request_messages_select_parties" ON public.dm_request_messages;
CREATE POLICY "dm_request_messages_select_parties"
  ON public.dm_request_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_message_requests r
      WHERE r.id = dm_request_messages.request_id
        AND auth.uid() IN (r.sender_id, r.recipient_id)
    )
  );

GRANT SELECT ON TABLE public.dm_message_requests TO authenticated;
GRANT SELECT ON TABLE public.dm_request_messages TO authenticated;

-- Abre canal DM: direto (amigos) ou pendente.
CREATE OR REPLACE FUNCTION public.open_dm_channel(p_other_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  conv_id uuid;
  req_id uuid;
  req_status text;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_other_user_id IS NULL OR p_other_user_id = me THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocked_users bu
    WHERE (bu.user_id = me AND bu.blocked_user_id = p_other_user_id)
       OR (bu.user_id = p_other_user_id AND bu.blocked_user_id = me)
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  IF public.are_mutual_contacts(me, p_other_user_id) THEN
    conv_id := public.get_or_create_dm_conversation(p_other_user_id);
    RETURN jsonb_build_object(
      'mode', 'direct',
      'conversation_id', conv_id,
      'is_mutual_contact', true
    );
  END IF;

  SELECT r.id, r.status INTO req_id, req_status
  FROM public.dm_message_requests r
  WHERE r.status = 'pending'
    AND (
      (r.sender_id = me AND r.recipient_id = p_other_user_id)
      OR (r.sender_id = p_other_user_id AND r.recipient_id = me)
    )
  ORDER BY r.updated_at DESC
  LIMIT 1;

  IF req_id IS NOT NULL AND req_status = 'pending' THEN
    RETURN jsonb_build_object(
      'mode', 'pending',
      'request_id', req_id,
      'is_sender', (SELECT sender_id = me FROM public.dm_message_requests WHERE id = req_id),
      'is_mutual_contact', false
    );
  END IF;

  RETURN jsonb_build_object(
    'mode', 'pending_new',
    'request_id', NULL,
    'is_sender', true,
    'is_mutual_contact', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_dm_channel(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.send_dm_message(p_recipient_id uuid, p_body text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  trimmed text;
  conv_id uuid;
  msg_id uuid;
  req_id uuid;
  req_msg_id uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  trimmed := trim(p_body);
  IF p_recipient_id IS NULL OR p_recipient_id = me THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;
  IF trimmed IS NULL OR trimmed = '' THEN
    RAISE EXCEPTION 'empty_message';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocked_users bu
    WHERE (bu.user_id = me AND bu.blocked_user_id = p_recipient_id)
       OR (bu.user_id = p_recipient_id AND bu.blocked_user_id = me)
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  IF public.are_mutual_contacts(me, p_recipient_id) THEN
    conv_id := public.get_or_create_dm_conversation(p_recipient_id);
    INSERT INTO public.messages (conversation_id, sender_id, body)
    VALUES (conv_id, me, trimmed)
    RETURNING id INTO msg_id;

    UPDATE public.conversations
    SET last_message_at = now()
    WHERE id = conv_id;

    RETURN jsonb_build_object(
      'mode', 'direct',
      'conversation_id', conv_id,
      'message_id', msg_id
    );
  END IF;

  SELECT r.id INTO req_id
  FROM public.dm_message_requests r
  WHERE r.sender_id = me
    AND r.recipient_id = p_recipient_id
    AND r.status = 'pending'
  LIMIT 1;

  IF req_id IS NULL THEN
    INSERT INTO public.dm_message_requests (sender_id, recipient_id, status)
    VALUES (me, p_recipient_id, 'pending')
    RETURNING id INTO req_id;
  ELSE
    UPDATE public.dm_message_requests
    SET updated_at = now()
    WHERE id = req_id;
  END IF;

  INSERT INTO public.dm_request_messages (request_id, sender_id, body)
  VALUES (req_id, me, trimmed)
  RETURNING id INTO req_msg_id;

  RETURN jsonb_build_object(
    'mode', 'pending',
    'request_id', req_id,
    'message_id', req_msg_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_dm_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_dm_request_messages(p_request_id uuid)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  body text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.dm_message_requests r
    WHERE r.id = p_request_id
      AND me IN (r.sender_id, r.recipient_id)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT m.id, m.sender_id, m.body, m.created_at
  FROM public.dm_request_messages m
  WHERE m.request_id = p_request_id
  ORDER BY m.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_dm_request_messages(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_dm_inbox()
RETURNS TABLE (
  request_id uuid,
  sender_id uuid,
  message_count bigint,
  preview text,
  last_message_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  RETURN QUERY
  SELECT
    r.id AS request_id,
    r.sender_id,
    COUNT(m.id) AS message_count,
    (
      SELECT m2.body
      FROM public.dm_request_messages m2
      WHERE m2.request_id = r.id
      ORDER BY m2.created_at DESC
      LIMIT 1
    ) AS preview,
    COALESCE(MAX(m.created_at), r.updated_at) AS last_message_at,
    r.created_at
  FROM public.dm_message_requests r
  LEFT JOIN public.dm_request_messages m ON m.request_id = r.id
  WHERE r.recipient_id = me
    AND r.status = 'pending'
  GROUP BY r.id, r.sender_id, r.created_at, r.updated_at
  ORDER BY last_message_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_dm_inbox() TO authenticated;

CREATE OR REPLACE FUNCTION public.accept_dm_message_request(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  req public.dm_message_requests%ROWTYPE;
  conv_id uuid;
  copied int := 0;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO req
  FROM public.dm_message_requests r
  WHERE r.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF req.recipient_id <> me THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'not_pending';
  END IF;

  conv_id := public.get_or_create_dm_conversation(req.sender_id);

  INSERT INTO public.messages (conversation_id, sender_id, body, created_at)
  SELECT conv_id, m.sender_id, m.body, m.created_at
  FROM public.dm_request_messages m
  WHERE m.request_id = req.id
  ORDER BY m.created_at ASC;

  GET DIAGNOSTICS copied = ROW_COUNT;

  UPDATE public.conversations
  SET last_message_at = now()
  WHERE id = conv_id;

  INSERT INTO public.contacts (user_id, contact_user_id, created_at, updated_at)
  VALUES
    (req.sender_id, req.recipient_id, now(), now()),
    (req.recipient_id, req.sender_id, now(), now())
  ON CONFLICT (user_id, contact_user_id) DO NOTHING;

  UPDATE public.dm_message_requests
  SET status = 'accepted', updated_at = now()
  WHERE id = req.id;

  DELETE FROM public.dm_request_messages WHERE request_id = req.id;

  RETURN jsonb_build_object(
    'conversation_id', conv_id,
    'messages_copied', copied
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_dm_message_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decline_dm_message_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  req public.dm_message_requests%ROWTYPE;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO req
  FROM public.dm_message_requests r
  WHERE r.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'not_found';
  END IF;
  IF req.recipient_id <> me THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'not_pending';
  END IF;

  DELETE FROM public.dm_message_requests WHERE id = req.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_dm_message_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.count_dm_inbox()
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.dm_message_requests r
  WHERE r.recipient_id = auth.uid()
    AND r.status = 'pending';
$$;

GRANT EXECUTE ON FUNCTION public.count_dm_inbox() TO authenticated;

-- Realtime
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_message_requests;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.dm_message_requests already in supabase_realtime publication.';
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_request_messages;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.dm_request_messages already in supabase_realtime publication.';
END $$;
