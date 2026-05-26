-- ================================================================
-- DailyWays: Contatos + Chat (DM) + Privacidade
-- ================================================================

-- 1) Privacy settings (por usuário)
CREATE TABLE IF NOT EXISTS public.privacy_settings (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  allow_contact_requests text NOT NULL DEFAULT 'everyone', -- everyone | contacts_only | no_one
  discoverable_by_email boolean NOT NULL DEFAULT true,
  discoverable_by_username boolean NOT NULL DEFAULT true,
  allow_dm_from text NOT NULL DEFAULT 'everyone', -- everyone | contacts_only
  show_online_status boolean NOT NULL DEFAULT true,
  read_receipts boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.privacy_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own privacy_settings" ON public.privacy_settings;
CREATE POLICY "Users can read own privacy_settings"
  ON public.privacy_settings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own privacy_settings" ON public.privacy_settings;
CREATE POLICY "Users can upsert own privacy_settings"
  ON public.privacy_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ensure privacy_settings row exists for any existing profile
INSERT INTO public.privacy_settings (user_id)
SELECT p.id
FROM public.profiles p
LEFT JOIN public.privacy_settings ps ON ps.user_id = p.id
WHERE ps.user_id IS NULL;

-- Extend handle_new_user to also create privacy_settings row (idempotente)
CREATE OR REPLACE FUNCTION public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := lower(trim(split_part(coalesce(new.email, ''), '@', 1)));
  if base_username = '' or length(base_username) < 2 then
    base_username := 'user_' || left(new.id::text, 8);
  end if;
  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || '_' || suffix;
  end loop;
  insert into public.profiles (id, username, name, avatar, updated_at)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'user'), '@', 1)),
    left(coalesce(new.raw_user_meta_data->>'name', 'U'), 1),
    now()
  )
  on conflict (id) do nothing;

  insert into public.privacy_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
exception
  when unique_violation then
    return new;
end;
$$;


-- 2) Bloqueios (para privacidade e chat)
CREATE TABLE IF NOT EXISTS public.blocked_users (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, blocked_user_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own blocks" ON public.blocked_users;
CREATE POLICY "Users can manage own blocks"
  ON public.blocked_users FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 3) Contatos + solicitações
CREATE TABLE IF NOT EXISTS public.contacts (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nickname text,
  pinned boolean NOT NULL DEFAULT false,
  last_interaction_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, contact_user_id)
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own contacts" ON public.contacts;
CREATE POLICY "Users can manage own contacts"
  ON public.contacts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.contact_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | declined | blocked
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (from_user_id, to_user_id)
);

ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Ver requests: remetente ou destinatário
DROP POLICY IF EXISTS "Users can read own contact_requests" ON public.contact_requests;
CREATE POLICY "Users can read own contact_requests"
  ON public.contact_requests FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

-- Criar request: from = auth.uid(), to respeita privacidade e não está bloqueado
DROP POLICY IF EXISTS "Users can create contact_requests with privacy check" ON public.contact_requests;
CREATE POLICY "Users can create contact_requests with privacy check"
  ON public.contact_requests FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id
    AND from_user_id <> to_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users bu
      WHERE (bu.user_id = to_user_id AND bu.blocked_user_id = auth.uid())
         OR (bu.user_id = auth.uid() AND bu.blocked_user_id = to_user_id)
    )
    AND EXISTS (
      SELECT 1 FROM public.privacy_settings ps
      WHERE ps.user_id = to_user_id
        AND ps.allow_contact_requests <> 'no_one'
    )
  );

-- Atualizar request: apenas destinatário pode aceitar/recusar/bloquear
DROP POLICY IF EXISTS "To user can update contact_request status" ON public.contact_requests;
CREATE POLICY "To user can update contact_request status"
  ON public.contact_requests FOR UPDATE
  USING (auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = to_user_id);


-- Ao aceitar request: cria contato para os dois lados (idempotente)
CREATE OR REPLACE FUNCTION public.on_contact_request_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted') THEN
    INSERT INTO public.contacts (user_id, contact_user_id, created_at, updated_at)
    VALUES
      (NEW.from_user_id, NEW.to_user_id, now(), now()),
      (NEW.to_user_id, NEW.from_user_id, now(), now())
    ON CONFLICT (user_id, contact_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_request_accepted ON public.contact_requests;
CREATE TRIGGER trg_contact_request_accepted
  AFTER UPDATE OF status ON public.contact_requests
  FOR EACH ROW
  EXECUTE PROCEDURE public.on_contact_request_accepted();


-- 4) Conversas (DM) + mensagens
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'dm',
  created_at timestamptz DEFAULT now(),
  last_message_at timestamptz
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz DEFAULT now(),
  edited_at timestamptz
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Participants can select conversation + participants + messages
DROP POLICY IF EXISTS "Participants can read conversations" ON public.conversations;
CREATE POLICY "Participants can read conversations"
  ON public.conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversations.id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can read conversation_participants" ON public.conversation_participants;
CREATE POLICY "Participants can read conversation_participants"
  ON public.conversation_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants me
      WHERE me.conversation_id = conversation_participants.conversation_id AND me.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants can read messages" ON public.messages;
CREATE POLICY "Participants can read messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
  );

-- Sender can insert messages if is participant and not blocked
DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id AND cp.user_id = auth.uid()
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.conversation_participants otherp
      JOIN public.blocked_users bu
        ON bu.user_id = otherp.user_id AND bu.blocked_user_id = auth.uid()
      WHERE otherp.conversation_id = messages.conversation_id
        AND otherp.user_id <> auth.uid()
    )
  );

-- 5) RPC: buscar targets para autocomplete (email ou @username), respeitando privacidade
CREATE OR REPLACE FUNCTION public.search_contact_targets(q text, lim int DEFAULT 8)
RETURNS TABLE (
  id uuid,
  username text,
  name text,
  avatar text,
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

  -- Email exato: só retorna se discoverable_by_email
  IF position('@' in normalized) > 1 THEN
    RETURN QUERY
      SELECT p.id, p.username, p.name, p.avatar, au.email
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

  -- Username prefix: só retorna se discoverable_by_username
  RETURN QUERY
    SELECT p.id, p.username, p.name, p.avatar, NULL::text
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

-- 6) RPC: criar ou obter conversa DM com participantes (atômico) + check privacidade/bloqueio
CREATE OR REPLACE FUNCTION public.get_or_create_dm_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  existing uuid;
  allow_dm text;
  allowed boolean := false;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF other_user_id IS NULL OR other_user_id = me THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = other_user_id) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  -- Bloqueio em qualquer direção impede DM
  IF EXISTS (
    SELECT 1 FROM public.blocked_users bu
    WHERE (bu.user_id = me AND bu.blocked_user_id = other_user_id)
       OR (bu.user_id = other_user_id AND bu.blocked_user_id = me)
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  SELECT ps.allow_dm_from INTO allow_dm
  FROM public.privacy_settings ps
  WHERE ps.user_id = other_user_id;

  IF allow_dm IS NULL THEN
    allow_dm := 'everyone';
  END IF;

  IF allow_dm = 'everyone' THEN
    allowed := true;
  ELSE
    -- contacts_only: precisa existir contato aceito (qualquer direção; accept cria 2 linhas)
    allowed := EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE (c.user_id = me AND c.contact_user_id = other_user_id)
         OR (c.user_id = other_user_id AND c.contact_user_id = me)
    );
  END IF;

  IF NOT allowed THEN
    RAISE EXCEPTION 'dm_not_allowed';
  END IF;

  -- Tenta achar conversa DM existente com exatamente esses 2 participantes
  SELECT c.id INTO existing
  FROM public.conversations c
  WHERE c.type = 'dm'
    AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = me)
    AND EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = other_user_id)
  ORDER BY c.created_at ASC
  LIMIT 1;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO public.conversations (type, created_at) VALUES ('dm', now())
  RETURNING id INTO existing;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES
    (existing, me),
    (existing, other_user_id)
  ON CONFLICT DO NOTHING;

  RETURN existing;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_dm_conversation(uuid) TO authenticated;

-- 6.1) Permitir ler perfis básicos de contatos (para UI de Contatos/Chat)
CREATE OR REPLACE FUNCTION public.is_contact(p_other_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.user_id = auth.uid()
      AND c.contact_user_id = p_other_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_contact(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Profiles select by contacts'
  ) THEN
    CREATE POLICY "Profiles select by contacts"
      ON public.profiles
      FOR SELECT
      USING (
        auth.uid() = id
        OR public.is_shared_board_member(id)
        OR public.is_contact(id)
      );
  END IF;
END $$;


-- 7) Realtime publication: conversa e mensagens
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.conversations already in supabase_realtime publication.';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.conversation_participants already in supabase_realtime publication.';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.messages already in supabase_realtime publication.';
END $$;

