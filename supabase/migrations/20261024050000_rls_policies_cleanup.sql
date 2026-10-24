-- Vistoria 2026-10-24 — políticas RLS (mesma regra de acesso, menos trabalho por linha).
-- Backup das 116 políticas anteriores: entregue à parte (rollback_policies_2026-10-24.sql).

-- 1) Políticas redundantes (subconjunto exato de outra já existente; owns_board ≡ is_board_owner)
DROP POLICY IF EXISTS "Board owner manages members" ON public.board_members;   -- ⊂ "Owner manages members" (ALL)
DROP POLICY IF EXISTS "Board owner deletes members" ON public.board_members;   -- ⊂ "Owner manages members"
DROP POLICY IF EXISTS "Board owner updates members" ON public.board_members;   -- ⊂ "Owner manages members"
DROP POLICY IF EXISTS "Members see own memberships" ON public.board_members;   -- ⊂ "Board members select"
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;         -- ⊂ "Profiles select by contacts"
DROP POLICY IF EXISTS "Profiles select by shared board membership" ON public.profiles; -- ⊂ idem
DROP POLICY IF EXISTS "Users can read own privacy_settings" ON public.privacy_settings; -- ⊂ política ALL igual
DROP POLICY IF EXISTS dev_tool_config_select_primary_dev ON public.dev_tool_config;     -- ⊂ política ALL igual

-- 2) "write" FOR ALL também valia para SELECT (2 políticas avaliadas em toda leitura).
--    Vira INSERT/UPDATE/DELETE com a MESMA expressão; leitura fica só com a política de SELECT.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'ALL'
      AND (tablename, policyname) IN (
        ('boards', 'Boards write owner or editors'),
        ('lists', 'Lists write owner or editors'),
        ('cards', 'Cards write owner or editors'),
        ('subtasks', 'Subtasks write owner or editors')
      )
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
      t.policyname || ' (insert)', t.tablename, coalesce(t.with_check, t.qual));
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
      t.policyname || ' (update)', t.tablename, t.qual, coalesce(t.with_check, t.qual));
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)',
      t.policyname || ' (delete)', t.tablename, t.qual);
    EXECUTE format('DROP POLICY %I ON public.%I', t.policyname, t.tablename);
  END LOOP;
END $$;

-- 3) auth.uid()/auth.jwt() → (select …): calculado 1x por consulta, não 1x por linha (advisor 0003).
--    E TO authenticated: sem sessão nenhuma dessas regras pode ser verdadeira, então anon nem avalia.
DO $$
DECLARE
  p record;
  new_qual text;
  new_check text;
  stmt text;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND NOT (schemaname = 'storage' AND policyname = 'Avatar public read')
      AND (schemaname = 'public' OR tablename = 'objects')
  LOOP
    new_qual := regexp_replace(p.qual, '(?<!SELECT )auth\.(uid|jwt)\(\)', '(select auth.\1())', 'g');
    new_check := regexp_replace(p.with_check, '(?<!SELECT )auth\.(uid|jwt)\(\)', '(select auth.\1())', 'g');
    stmt := format('ALTER POLICY %I ON %I.%I TO authenticated', p.policyname, p.schemaname, p.tablename);
    IF new_qual IS NOT NULL THEN stmt := stmt || ' USING (' || new_qual || ')'; END IF;
    IF new_check IS NOT NULL THEN stmt := stmt || ' WITH CHECK (' || new_check || ')'; END IF;
    BEGIN
      EXECUTE stmt;
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'sem permissão para alterar %.% / %', p.schemaname, p.tablename, p.policyname;
    END;
  END LOOP;
END $$;

-- 4) Funções de gatilho não são RPC: ninguém precisa de EXECUTE nelas (gatilhos rodam mesmo assim).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_email_confirmed_create_profile() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.on_contact_request_accepted() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_contact_delete_reciprocal() FROM authenticated;
