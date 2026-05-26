-- Permite ao convidado limpar o histórico na UI sem apagar o registo do owner.

ALTER TABLE public.board_invitations
  ADD COLUMN IF NOT EXISTS history_dismissed_at timestamptz NULL;

ALTER TABLE public.space_invitations
  ADD COLUMN IF NOT EXISTS history_dismissed_at timestamptz NULL;

CREATE OR REPLACE FUNCTION public.clear_my_invitation_history()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
  v_count integer := 0;
  v_n integer;
BEGIN
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.board_invitations
  SET history_dismissed_at = now()
  WHERE history_dismissed_at IS NULL
    AND status IN ('accepted', 'declined')
    AND (
      invitee_user_id = auth.uid()
      OR (v_email <> '' AND lower(invitee_email) = v_email)
    );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  UPDATE public.space_invitations
  SET history_dismissed_at = now()
  WHERE history_dismissed_at IS NULL
    AND status IN ('accepted', 'declined')
    AND (
      invitee_user_id = auth.uid()
      OR (v_email <> '' AND lower(invitee_email) = v_email)
    );
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_my_invitation_history() TO authenticated;
