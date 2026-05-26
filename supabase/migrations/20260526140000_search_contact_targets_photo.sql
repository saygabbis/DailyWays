-- Inclui photo_url no autocomplete de contatos

DROP FUNCTION IF EXISTS public.search_contact_targets(text, int);

CREATE OR REPLACE FUNCTION public.search_contact_targets(q text, lim int DEFAULT 8)
RETURNS TABLE (
  id uuid,
  username text,
  name text,
  avatar text,
  photo_url text,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized text;
BEGIN
  normalized := lower(trim(q));

  IF normalized IS NULL OR normalized = '' THEN
    RETURN;
  END IF;

  IF position('@' in normalized) > 1 THEN
    RETURN QUERY
      SELECT p.id, p.username, p.name, p.avatar, p.photo_url, au.email
      FROM auth.users au
      JOIN public.profiles p ON p.id = au.id
      JOIN public.privacy_settings ps ON ps.user_id = p.id
      WHERE au.email = normalized
        AND p.id <> auth.uid()
        AND ps.discoverable_by_email = true
        AND ps.allow_contact_requests <> 'no_one'
      LIMIT 1;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.id, p.username, p.name, p.avatar, p.photo_url, NULL::text
    FROM public.profiles p
    JOIN public.privacy_settings ps ON ps.user_id = p.id
    WHERE p.username ILIKE normalized || '%'
      AND p.id <> auth.uid()
      AND ps.discoverable_by_username = true
      AND ps.allow_contact_requests <> 'no_one'
    ORDER BY p.username
    LIMIT COALESCE(lim, 8);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_contact_targets(text, int) TO authenticated;
