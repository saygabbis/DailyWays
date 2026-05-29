-- Segurança: enumeração login, dev resolve, task-attachments 100MB

-- Alinha bucket com limite da app (100 MB)
UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id = 'task-attachments';

-- Mitiga enumeração por timing (resposta com atraso mínimo constante)
CREATE OR REPLACE FUNCTION public.get_email_by_username(u text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  found text;
BEGIN
  SELECT au.email INTO found
  FROM auth.users au
  JOIN public.profiles p ON p.id = au.id
  WHERE lower(trim(p.username)) = lower(trim(u))
  LIMIT 1;
  PERFORM pg_sleep(0.08);
  RETURN found;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_username_available(u text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  taken boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(trim(p.username)) = lower(trim(u))
  ) INTO taken;
  PERFORM pg_sleep(0.08);
  RETURN NOT taken;
END;
$$;

-- Resolve conta extra DEV por e-mail ou @username (apenas owner DEV)
CREATE OR REPLACE FUNCTION public.resolve_account_id_for_dev(p_identifier text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  me_email text;
  ident text;
  found uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT lower(coalesce(email, '')) INTO me_email
  FROM auth.users WHERE id = auth.uid();

  IF me_email <> 'gaffonsoxx@gmail.com' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  ident := lower(trim(p_identifier));
  IF ident = '' THEN
    RETURN NULL;
  END IF;

  IF position('@' in ident) > 1 AND position('.' in ident) > position('@' in ident) THEN
    SELECT p.id INTO found
    FROM public.profiles p
    JOIN auth.users au ON au.id = p.id
    WHERE lower(au.email) = ident
    LIMIT 1;
  ELSE
    ident := regexp_replace(ident, '^@', '');
    SELECT p.id INTO found
    FROM public.profiles p
    WHERE lower(trim(p.username)) = ident
    LIMIT 1;
  END IF;

  RETURN found;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_account_id_for_dev(text) TO authenticated;
