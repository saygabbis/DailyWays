-- Cursor-based pagination for chat timeline (latest-first page internally, UI receives ASC)
CREATE OR REPLACE FUNCTION public.list_chat_messages(
  p_conversation_id uuid,
  p_limit int DEFAULT 80,
  p_before_created_at timestamptz DEFAULT NULL
)
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
  WITH page AS (
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
      AND (
        p_before_created_at IS NULL
        OR m.created_at < p_before_created_at
      )
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT COALESCE(p_limit, 80)
  )
  SELECT * FROM page
  ORDER BY created_at ASC, id ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_chat_messages(uuid, int, timestamptz) TO authenticated;
