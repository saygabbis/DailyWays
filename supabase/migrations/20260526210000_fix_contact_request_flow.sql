-- Corrige: re-pedido após desfazer amizade, pedidos cruzados e notificação.

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

  -- Libera novo pedido depois de desfazer amizade
  UPDATE public.contact_requests
  SET status = 'declined', updated_at = now()
  WHERE status IN ('pending', 'accepted')
    AND (
      (from_user_id = me AND to_user_id = p_contact_user_id)
      OR (from_user_id = p_contact_user_id AND to_user_id = me)
    );
END;
$$;

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

    -- Se os dois mandaram pedido, aceita o reverso pendente também
    UPDATE public.contact_requests
    SET status = 'accepted', updated_at = now()
    WHERE status = 'pending'
      AND id IS DISTINCT FROM NEW.id
      AND (
        (from_user_id = NEW.from_user_id AND to_user_id = NEW.to_user_id)
        OR (from_user_id = NEW.to_user_id AND to_user_id = NEW.from_user_id)
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_contact_request(p_to_user_id uuid)
RETURNS public.contact_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  result public.contact_requests;
  reverse_id uuid;
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

  IF public.are_mutual_contacts(me, p_to_user_id) THEN
    RAISE EXCEPTION 'already_contacts';
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

  -- Ele já te mandou pedido pendente → aceita na hora (os dois querem)
  SELECT cr.id INTO reverse_id
  FROM public.contact_requests cr
  WHERE cr.from_user_id = p_to_user_id
    AND cr.to_user_id = me
    AND cr.status = 'pending'
  LIMIT 1;

  IF reverse_id IS NOT NULL THEN
    UPDATE public.contact_requests
    SET status = 'accepted', updated_at = now()
    WHERE id = reverse_id
    RETURNING * INTO result;
    RETURN result;
  END IF;

  INSERT INTO public.contact_requests (from_user_id, to_user_id, status)
  VALUES (me, p_to_user_id, 'pending')
  ON CONFLICT (from_user_id, to_user_id)
  DO UPDATE SET
    status = CASE
      WHEN contact_requests.status IN ('declined', 'accepted') THEN 'pending'
      ELSE contact_requests.status
    END,
    updated_at = now()
  RETURNING * INTO result;

  RETURN result;
END;
$$;
