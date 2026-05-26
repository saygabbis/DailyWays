-- INSERT em messages falhava: sender_id não era enviado e a policy exige auth.uid() = sender_id.

ALTER TABLE public.messages
  ALTER COLUMN sender_id SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.can_send_conversation_message(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_conversation_participant(p_conversation_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.conversation_participants otherp
      JOIN public.blocked_users bu
        ON bu.user_id = otherp.user_id AND bu.blocked_user_id = auth.uid()
      WHERE otherp.conversation_id = p_conversation_id
        AND otherp.user_id <> auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_send_conversation_message(uuid) TO authenticated;

DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND public.can_send_conversation_message(conversation_id)
  );
