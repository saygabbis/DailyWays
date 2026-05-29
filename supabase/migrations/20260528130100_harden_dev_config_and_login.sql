-- Restringe leitura de dev_tool_config; login por username case-insensitive; usernames reservados

DROP POLICY IF EXISTS "dev_tool_config_select_authenticated" ON public.dev_tool_config;
CREATE POLICY "dev_tool_config_select_primary_dev"
  ON public.dev_tool_config
  FOR SELECT
  TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'gaffonsoxx@gmail.com');

-- Login: comparação case-insensitive (evita bypass por casing)
CREATE OR REPLACE FUNCTION public.get_email_by_username(u text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT au.email
  FROM auth.users au
  JOIN public.profiles p ON p.id = au.id
  WHERE lower(trim(p.username)) = lower(trim(u))
  LIMIT 1;
$$;

-- Impede assumir usernames reservados para ferramentas DEV
CREATE OR REPLACE FUNCTION public.profiles_reserved_username_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  u text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  u := lower(trim(NEW.username));
  IF u IN ('gabbis', 'gaffonsoxx') THEN
    RAISE EXCEPTION 'username reservado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_reserved_username ON public.profiles;
CREATE TRIGGER profiles_reserved_username
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_reserved_username_guard();
