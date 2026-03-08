-- Profile só é criado após confirmação de e-mail (ou no OAuth, que já vem confirmado).
-- Remove criação de profile no INSERT (signup) e cria no UPDATE quando email_confirmed_at é setado,
-- ou no INSERT quando o usuário já vem com email confirmado (ex.: OAuth).

-- Função compartilhada: insere profile para new (usada no INSERT e no UPDATE)
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
  -- Só criar se já existir profile (evitar duplicar) — chamada pode vir do INSERT ou UPDATE
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
    RETURN new;
  END IF;

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

-- Remove trigger que criava profile em todo INSERT
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- INSERT: criar profile apenas se o usuário já vem com e-mail confirmado (ex.: OAuth)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (new.email_confirmed_at IS NOT NULL)
  EXECUTE PROCEDURE public.handle_new_user();

-- UPDATE: criar profile quando o e-mail é confirmado (ex.: após verifyOtp no signup)
CREATE OR REPLACE FUNCTION public.handle_email_confirmed_create_profile()
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
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
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
  END IF;
  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (
    old.email_confirmed_at IS DISTINCT FROM new.email_confirmed_at
    AND new.email_confirmed_at IS NOT NULL
  )
  EXECUTE PROCEDURE public.handle_email_confirmed_create_profile();
