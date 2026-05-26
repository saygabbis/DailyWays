-- Chat v2: receipts, reactions, media, presence, message actions

-- Extensions on messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS attachment_url text,
  ADD COLUMN IF NOT EXISTS attachment_meta jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_message_type_check;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_type_check
  CHECK (message_type IN ('text', 'image', 'system'));

-- Contacts / privacy / participants
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS notify_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS muted_until timestamptz;

ALTER TABLE public.privacy_settings
  ADD COLUMN IF NOT EXISTS read_receipts_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_read_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

-- Presence heartbeat
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read presence" ON public.user_presence;
CREATE POLICY "Anyone authenticated can read presence"
  ON public.user_presence FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users upsert own presence" ON public.user_presence;
CREATE POLICY "Users upsert own presence"
  ON public.user_presence FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;

-- Per-user message visibility
CREATE TABLE IF NOT EXISTS public.message_user_state (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.message_user_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own message_user_state" ON public.message_user_state;
CREATE POLICY "Users manage own message_user_state"
  ON public.message_user_state FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_user_state TO authenticated;

-- Receipts
CREATE TABLE IF NOT EXISTS public.message_receipts (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delivered_at timestamptz,
  read_at timestamptz,
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.message_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read receipts" ON public.message_receipts;
CREATE POLICY "Participants read receipts"
  ON public.message_receipts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_receipts.message_id
        AND public.is_conversation_participant(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "Users update own receipts" ON public.message_receipts;
CREATE POLICY "Users update own receipts"
  ON public.message_receipts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.message_receipts TO authenticated;

-- Reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants read reactions" ON public.message_reactions;
CREATE POLICY "Participants read reactions"
  ON public.message_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_reactions.message_id
        AND public.is_conversation_participant(m.conversation_id)
    )
  );

DROP POLICY IF EXISTS "Users manage own reactions" ON public.message_reactions;
CREATE POLICY "Users manage own reactions"
  ON public.message_reactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;

-- Sender can update own messages
DROP POLICY IF EXISTS "Sender can update own messages" ON public.messages;
CREATE POLICY "Sender can update own messages"
  ON public.messages FOR UPDATE
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- List messages with hidden filter via RPC; extend SELECT for participants
-- (existing SELECT policy remains)

ALTER TABLE public.message_receipts REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_receipts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Heartbeat
CREATE OR REPLACE FUNCTION public.heartbeat_presence()
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  ts timestamptz := now();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.user_presence (user_id, last_seen_at)
  VALUES (me, ts)
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at;
  RETURN ts;
END;
$$;
GRANT EXECUTE ON FUNCTION public.heartbeat_presence() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_user_online(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_presence up
    JOIN public.privacy_settings ps ON ps.user_id = p_user_id
    WHERE up.user_id = p_user_id
      AND ps.show_online_status = true
      AND up.last_seen_at > now() - interval '45 seconds'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_user_online(uuid) TO authenticated;

-- Fetch conversation messages for UI
CREATE OR REPLACE FUNCTION public.list_chat_messages(p_conversation_id uuid, p_limit int DEFAULT 80)
RETURNS TABLE (
  id uuid,
  conversation_id uuid,
  sender_id uuid,
  body text,
  message_type text,
  attachment_url text,
  attachment_meta jsonb,
  created_at timestamptz,
  edited_at timestamptz,
  deleted_at timestamptz,
  reply_to_id uuid,
  peer_delivered_at timestamptz,
  peer_read_at timestamptz,
  reactions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_conversation_participant(p_conversation_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.conversation_id,
    m.sender_id,
    m.body,
    m.message_type,
    m.attachment_url,
    m.attachment_meta,
    m.created_at,
    m.edited_at,
    m.deleted_at,
    m.reply_to_id,
    CASE WHEN m.sender_id = me THEN r_peer.delivered_at ELSE NULL END AS peer_delivered_at,
    CASE WHEN m.sender_id = me THEN r_peer.read_at ELSE NULL END AS peer_read_at,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('emoji', mr.emoji, 'user_id', mr.user_id, 'count', 1))
        FROM public.message_reactions mr
        WHERE mr.message_id = m.id
      ),
      '[]'::jsonb
    ) AS reactions
  FROM public.messages m
  LEFT JOIN public.conversation_participants cp_other
    ON cp_other.conversation_id = m.conversation_id AND cp_other.user_id <> me
  LEFT JOIN public.message_receipts r_peer
    ON r_peer.message_id = m.id AND r_peer.user_id = cp_other.user_id
  LEFT JOIN public.message_user_state mus ON mus.message_id = m.id AND mus.user_id = me
  WHERE m.conversation_id = p_conversation_id
    AND mus.hidden_at IS NULL
  ORDER BY m.created_at ASC
  LIMIT COALESCE(p_limit, 80);
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_chat_messages(uuid, int) TO authenticated;

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
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.can_send_conversation_message(p_conversation_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.messages (
    conversation_id, sender_id, body, message_type, attachment_url, attachment_meta
  )
  VALUES (
    p_conversation_id,
    me,
    COALESCE(trim(p_body), ''),
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
GRANT EXECUTE ON FUNCTION public.send_chat_message(uuid, text, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_conversation_delivered(p_conversation_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  n int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_conversation_participant(p_conversation_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.message_receipts (message_id, user_id, delivered_at)
  SELECT m.id, me, now()
  FROM public.messages m
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> me
    AND m.deleted_at IS NULL
  ON CONFLICT (message_id, user_id)
  DO UPDATE SET delivered_at = COALESCE(message_receipts.delivered_at, EXCLUDED.delivered_at);

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_conversation_delivered(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_messages_read(
  p_conversation_id uuid,
  p_up_to_message_id uuid DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  allow_read boolean := true;
  n int := 0;
  up_to_ts timestamptz;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_conversation_participant(p_conversation_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT COALESCE(ps.read_receipts_enabled, true) INTO allow_read
  FROM public.privacy_settings ps WHERE ps.user_id = me;
  IF allow_read IS NULL THEN allow_read := true; END IF;

  IF p_up_to_message_id IS NOT NULL THEN
    SELECT created_at INTO up_to_ts FROM public.messages WHERE id = p_up_to_message_id;
  END IF;

  INSERT INTO public.message_receipts (message_id, user_id, delivered_at, read_at)
  SELECT m.id, me, COALESCE(r.delivered_at, now()), CASE WHEN allow_read THEN now() ELSE r.read_at END
  FROM public.messages m
  LEFT JOIN public.message_receipts r ON r.message_id = m.id AND r.user_id = me
  WHERE m.conversation_id = p_conversation_id
    AND m.sender_id <> me
    AND m.deleted_at IS NULL
    AND (up_to_ts IS NULL OR m.created_at <= up_to_ts)
  ON CONFLICT (message_id, user_id)
  DO UPDATE SET
    delivered_at = COALESCE(message_receipts.delivered_at, EXCLUDED.delivered_at),
    read_at = CASE WHEN allow_read THEN COALESCE(message_receipts.read_at, EXCLUDED.read_at) ELSE message_receipts.read_at END;

  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.conversation_participants
  SET last_read_at = now(), last_read_message_id = p_up_to_message_id
  WHERE conversation_id = p_conversation_id AND user_id = me;

  RETURN n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.edit_chat_message(p_message_id uuid, p_body text)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  msg public.messages;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF msg.sender_id <> me THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF msg.deleted_at IS NOT NULL THEN RAISE EXCEPTION 'deleted'; END IF;
  IF msg.created_at < now() - interval '15 minutes' THEN RAISE EXCEPTION 'edit_window_expired'; END IF;

  UPDATE public.messages
  SET body = trim(p_body), edited_at = now()
  WHERE id = p_message_id
  RETURNING * INTO msg;
  RETURN msg;
END;
$$;
GRANT EXECUTE ON FUNCTION public.edit_chat_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_chat_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  msg public.messages;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO msg FROM public.messages WHERE id = p_message_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found'; END IF;
  IF msg.sender_id <> me THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.messages SET deleted_at = now(), body = '' WHERE id = p_message_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_chat_message(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.hide_message_for_me(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO public.message_user_state (message_id, user_id, hidden_at)
  VALUES (p_message_id, me, now())
  ON CONFLICT (message_id, user_id) DO UPDATE SET hidden_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.hide_message_for_me(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_chat_history_for_me(p_conversation_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  n int;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_conversation_participant(p_conversation_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.message_user_state (message_id, user_id, hidden_at)
  SELECT m.id, me, now()
  FROM public.messages m
  WHERE m.conversation_id = p_conversation_id
  ON CONFLICT (message_id, user_id) DO UPDATE SET hidden_at = now();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;
GRANT EXECUTE ON FUNCTION public.clear_chat_history_for_me(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.toggle_message_reaction(p_message_id uuid, p_emoji text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  exists_flag boolean;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_emoji IS NULL OR trim(p_emoji) = '' THEN RAISE EXCEPTION 'invalid_emoji'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.message_reactions
    WHERE message_id = p_message_id AND user_id = me AND emoji = p_emoji
  ) THEN
    DELETE FROM public.message_reactions
    WHERE message_id = p_message_id AND user_id = me AND emoji = p_emoji;
    RETURN false;
  END IF;

  INSERT INTO public.message_reactions (message_id, user_id, emoji)
  VALUES (p_message_id, me, p_emoji);
  RETURN true;
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_message_reaction(uuid, text) TO authenticated;

-- Storage bucket (run manually if storage API differs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Expose notify_messages in mutual contacts list (return type changed — must drop first)
DROP FUNCTION IF EXISTS public.list_mutual_contacts();

CREATE OR REPLACE FUNCTION public.list_mutual_contacts()
RETURNS TABLE (
  contact_user_id uuid,
  nickname text,
  pinned boolean,
  notify_messages boolean,
  last_interaction_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.contact_user_id,
    c.nickname,
    c.pinned,
    c.notify_messages,
    c.last_interaction_at,
    c.created_at,
    c.updated_at
  FROM public.contacts c
  WHERE c.user_id = auth.uid()
    AND public.are_mutual_contacts(auth.uid(), c.contact_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.list_mutual_contacts() TO authenticated;
