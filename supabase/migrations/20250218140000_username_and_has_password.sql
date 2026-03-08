-- Coluna para saber se o usuário já definiu senha (login por e-mail)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_password boolean NOT NULL DEFAULT false;

-- Atualiza username de usuários existentes a partir de auth.users (metadata do signup)
UPDATE public.profiles p
SET username = lower(trim(au.raw_user_meta_data->>'username'))
FROM auth.users au
WHERE p.id = au.id
  AND au.raw_user_meta_data->>'username' IS NOT NULL
  AND length(trim(au.raw_user_meta_data->>'username')) >= 2
  AND lower(trim(au.raw_user_meta_data->>'username')) <> p.username
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p2
    WHERE p2.username = lower(trim(au.raw_user_meta_data->>'username'))
      AND p2.id <> p.id
  );

-- Trigger: preferir username dos metadados do signup (ex.: saygabbis em vez da parte do email)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  final_username text;
  suffix int := 0;
BEGIN
  base_username := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
  IF base_username = '' OR length(base_username) < 2 THEN
    base_username := lower(trim(split_part(coalesce(new.email, ''), '@', 1)));
  END IF;
  IF base_username = '' OR length(base_username) < 2 THEN
    base_username := 'user_' || replace(left(new.id::text, 8), '-', '');
  END IF;
  final_username := base_username;
  WHILE exists (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := suffix + 1;
    final_username := base_username || '_' || suffix;
  END LOOP;
  INSERT INTO public.profiles (id, username, name, avatar, updated_at)
  VALUES (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'user'), '@', 1)),
    left(coalesce(new.raw_user_meta_data->>'name', 'U'), 1),
    now()
  );
  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    RETURN new;
END;
$$;

-- Login por username: busca case-insensitive
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
