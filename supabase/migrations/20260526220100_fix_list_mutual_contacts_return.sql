-- Cole no SQL Editor do Supabase (passo 1: colunas + função de contatos)
-- Se o chat ainda der erro de RPC, rode o arquivo inteiro 20260526220000_chat_messaging_v2.sql

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS notify_messages boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS muted_until timestamptz;

ALTER TABLE public.privacy_settings
  ADD COLUMN IF NOT EXISTS read_receipts_enabled boolean NOT NULL DEFAULT true;

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
