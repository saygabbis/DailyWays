-- Vistoria 2026-10-24 — permissões das funções.
-- Antes: TODAS as funções (57 SECURITY DEFINER) eram executáveis por `anon` (sem login),
-- incluindo resolve_registered_invitee, que devolve id + e-mail de qualquer usuário.

-- 1) Ninguém sem login executa nada…
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- …exceto o fluxo de login/cadastro (rodam antes de existir sessão).
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon;

-- 2) Funções internas: só são chamadas por outras funções SECURITY DEFINER (rodam como owner),
--    nunca direto pelo app. Ninguém chama via /rpc.
REVOKE EXECUTE ON FUNCTION public.resolve_registered_invitee(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.are_mutual_contacts(uuid, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_or_create_dm_conversation(uuid) FROM authenticated;

-- 3) Funções novas também nascem fechadas para anon.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

-- 4) search_path fixo (advisor 0011).
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.storage_space_id_from_path(text) SET search_path = public;
ALTER FUNCTION public.storage_conversation_id_from_path(text) SET search_path = public;
ALTER FUNCTION public.profiles_reserved_username_guard() SET search_path = public;

-- 5) Checagens usadas DENTRO das políticas RLS continuam executáveis por anon: sem sessão elas
--    sempre respondem "não" (auth.uid() é NULL), e sem o EXECUTE uma consulta anônima daria erro
--    de permissão em vez de voltar vazia. (Aplicado logo após o item 1, na mesma janela.)
GRANT EXECUTE ON FUNCTION
  public.auth_user_is_board_member(uuid), public.board_member_target_is_board_owner(uuid, uuid),
  public.can_access_card(uuid), public.can_access_space(uuid, boolean), public.can_edit_card_content(uuid),
  public.can_moderate_card_comments(uuid), public.has_contact_request_with(uuid), public.is_board_admin(uuid),
  public.is_board_owner(uuid), public.is_contact(uuid), public.is_shared_board_member(uuid), public.is_space_owner(uuid),
  public.owns_board(uuid), public.storage_conversation_id_from_path(text), public.storage_space_id_from_path(text),
  public.can_send_conversation_message(uuid), public.is_conversation_participant(uuid)
TO anon;
