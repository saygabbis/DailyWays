-- Corrige recursão infinita nas policies de conversation_participants:
-- a policy SELECT consultava a mesma tabela, disparando RLS em loop.

CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id
      AND cp.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO authenticated;

DROP POLICY IF EXISTS "Participants can read conversations" ON public.conversations;
CREATE POLICY "Participants can read conversations"
  ON public.conversations FOR SELECT
  USING (public.is_conversation_participant(id));

DROP POLICY IF EXISTS "Participants can read conversation_participants" ON public.conversation_participants;
CREATE POLICY "Participants can read conversation_participants"
  ON public.conversation_participants FOR SELECT
  USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "Participants can read messages" ON public.messages;
CREATE POLICY "Participants can read messages"
  ON public.messages FOR SELECT
  USING (public.is_conversation_participant(conversation_id));

DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.is_conversation_participant(conversation_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.conversation_participants otherp
      JOIN public.blocked_users bu
        ON bu.user_id = otherp.user_id AND bu.blocked_user_id = auth.uid()
      WHERE otherp.conversation_id = messages.conversation_id
        AND otherp.user_id <> auth.uid()
    )
  );
