-- Fix: grants + from_user_id default + RPC para enviar solicitação de contato

-- Grants explícitos (evita 403 no PostgREST quando a tabela é nova)
GRANT SELECT, INSERT, UPDATE ON TABLE public.contact_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.blocked_users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.privacy_settings TO authenticated;
GRANT SELECT ON TABLE public.conversations TO authenticated;
GRANT SELECT ON TABLE public.conversation_participants TO authenticated;
GRANT SELECT, INSERT ON TABLE public.messages TO authenticated;

ALTER TABLE public.contact_requests
  ALTER COLUMN from_user_id SET DEFAULT auth.uid();

-- RPC atômico: define from_user_id = auth.uid() e respeita privacidade/bloqueio
CREATE OR REPLACE FUNCTION public.send_contact_request(p_to_user_id uuid)
RETURNS public.contact_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  result public.contact_requests;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF p_to_user_id IS NULL OR p_to_user_id = me THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_to_user_id) THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocked_users bu
    WHERE (bu.user_id = p_to_user_id AND bu.blocked_user_id = me)
       OR (bu.user_id = me AND bu.blocked_user_id = p_to_user_id)
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.privacy_settings ps
    WHERE ps.user_id = p_to_user_id
      AND ps.allow_contact_requests <> 'no_one'
  ) THEN
    RAISE EXCEPTION 'contact_requests_disabled';
  END IF;

  INSERT INTO public.contact_requests (from_user_id, to_user_id, status)
  VALUES (me, p_to_user_id, 'pending')
  ON CONFLICT (from_user_id, to_user_id)
  DO UPDATE SET
    status = CASE
      WHEN contact_requests.status IN ('declined') THEN 'pending'
      ELSE contact_requests.status
    END,
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_contact_request(uuid) TO authenticated;

-- Ler perfil de quem tem solicitação pendente/aceita com você (para exibir nomes na UI)
CREATE OR REPLACE FUNCTION public.has_contact_request_with(p_other_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contact_requests cr
    WHERE (
      (cr.from_user_id = auth.uid() AND cr.to_user_id = p_other_user_id)
      OR (cr.from_user_id = p_other_user_id AND cr.to_user_id = auth.uid())
    )
    AND cr.status IN ('pending', 'accepted')
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_contact_request_with(uuid) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
      AND policyname = 'Profiles select by contact_requests'
  ) THEN
    CREATE POLICY "Profiles select by contact_requests"
      ON public.profiles
      FOR SELECT
      USING (public.has_contact_request_with(id));
  END IF;
END $$;
