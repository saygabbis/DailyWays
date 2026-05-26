-- Amizade mútua: lista só mostra quem também te tem; remover apaga os dois lados.

CREATE OR REPLACE FUNCTION public.list_mutual_contacts()
RETURNS TABLE (
  contact_user_id uuid,
  nickname text,
  pinned boolean,
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
    c.last_interaction_at,
    c.created_at,
    c.updated_at
  FROM public.contacts c
  WHERE c.user_id = auth.uid()
    AND public.are_mutual_contacts(auth.uid(), c.contact_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.list_mutual_contacts() TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_contact_mutual(p_contact_user_id uuid)
RETURNS void
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
  IF p_contact_user_id IS NULL OR p_contact_user_id = me THEN
    RAISE EXCEPTION 'invalid_contact';
  END IF;

  DELETE FROM public.contacts
  WHERE (user_id = me AND contact_user_id = p_contact_user_id)
     OR (user_id = p_contact_user_id AND contact_user_id = me);
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_contact_mutual(uuid) TO authenticated;

-- Quando alguém remove da lista dele, remove também a linha que aponta para ele no outro usuário.
CREATE OR REPLACE FUNCTION public.sync_contact_delete_reciprocal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.contacts
  WHERE user_id = OLD.contact_user_id
    AND contact_user_id = OLD.user_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_delete_reciprocal ON public.contacts;
CREATE TRIGGER trg_contact_delete_reciprocal
  AFTER DELETE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_contact_delete_reciprocal();
