-- Espelho de SEGURANÇA de produção (2026-10-24, consultas só de leitura): funções de checagem,
-- RLS ligada e as políticas como estavam ANTES da migration 20261024210000. Roda depois de
-- e2e/schema.sql. Usado por supabase/tests/security.test.js (PGlite). Não é migration.

CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT COALESCE(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, encrypted_password text);
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, public boolean, file_size_limit bigint, allowed_mime_types text[]);
INSERT INTO storage.buckets VALUES ('space-assets', false, NULL, NULL), ('chat-attachments', false, NULL, NULL);
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated;

-- ── funções de checagem (cópia de produção) ──
CREATE OR REPLACE FUNCTION public.auth_user_is_board_member(p_board_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.board_members WHERE board_id = p_board_id AND user_id = auth.uid()); $$;
CREATE OR REPLACE FUNCTION public.board_member_target_is_board_owner(p_board_id uuid, p_member_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.boards WHERE id = p_board_id AND owner_id = p_member_user_id); $$;
CREATE OR REPLACE FUNCTION public.can_access_card(p_card_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.cards c JOIN public.lists l ON l.id = c.list_id JOIN public.boards b ON b.id = l.board_id
    WHERE c.id = p_card_id AND (b.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.board_members bm WHERE bm.board_id = b.id AND bm.user_id = auth.uid()))); $$;
CREATE OR REPLACE FUNCTION public.can_access_space(p_space_id uuid, p_need_write boolean DEFAULT false) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = p_space_id AND (s.owner_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.space_members sm WHERE sm.space_id = s.id AND sm.user_id = auth.uid() AND (NOT p_need_write OR sm.role = 'editor')))); $$;
CREATE OR REPLACE FUNCTION public.can_edit_card_content(p_card_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.cards c JOIN public.lists l ON l.id = c.list_id JOIN public.boards b ON b.id = l.board_id
    WHERE c.id = p_card_id AND (b.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.board_members bm WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner', 'admin', 'editor')))); $$;
CREATE OR REPLACE FUNCTION public.can_moderate_card_comments(p_card_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.cards c JOIN public.lists l ON l.id = c.list_id JOIN public.boards b ON b.id = l.board_id
    WHERE c.id = p_card_id AND (b.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.board_members bm WHERE bm.board_id = b.id AND bm.user_id = auth.uid() AND bm.role IN ('owner', 'admin')))); $$;
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants cp WHERE cp.conversation_id = p_conversation_id AND cp.user_id = auth.uid()); $$;
CREATE OR REPLACE FUNCTION public.can_send_conversation_message(p_conversation_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_conversation_participant(p_conversation_id) AND NOT EXISTS (SELECT 1 FROM public.conversation_participants otherp
    JOIN public.blocked_users bu ON bu.user_id = otherp.user_id AND bu.blocked_user_id = auth.uid()
    WHERE otherp.conversation_id = p_conversation_id AND otherp.user_id <> auth.uid()); $$;
CREATE OR REPLACE FUNCTION public.has_contact_request_with(p_other_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.contact_requests cr WHERE ((cr.from_user_id = auth.uid() AND cr.to_user_id = p_other_user_id)
    OR (cr.from_user_id = p_other_user_id AND cr.to_user_id = auth.uid())) AND cr.status IN ('pending', 'accepted')); $$;
CREATE OR REPLACE FUNCTION public.is_board_admin(p_board_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.board_members WHERE board_id = p_board_id AND user_id = auth.uid() AND role = 'admin'); $$;
CREATE OR REPLACE FUNCTION public.is_board_owner(p_board_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.boards WHERE id = p_board_id AND owner_id = auth.uid()); $$;
CREATE OR REPLACE FUNCTION public.owns_board(board_uuid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.boards WHERE id = board_uuid AND owner_id = auth.uid()); $$;
CREATE OR REPLACE FUNCTION public.is_contact(p_other_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.contacts c WHERE c.user_id = auth.uid() AND c.contact_user_id = p_other_user_id); $$;
CREATE OR REPLACE FUNCTION public.is_shared_board_member(p_other_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.board_members bm1 JOIN public.board_members bm2 ON bm1.board_id = bm2.board_id
    WHERE bm1.user_id = p_other_user_id AND bm2.user_id = auth.uid()); $$;
CREATE OR REPLACE FUNCTION public.is_space_owner(p_space_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.spaces WHERE id = p_space_id AND owner_id = auth.uid()); $$;
CREATE OR REPLACE FUNCTION public.on_contact_request_accepted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF (NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted') THEN
    INSERT INTO public.contacts (user_id, contact_user_id, created_at, updated_at)
    VALUES (NEW.from_user_id, NEW.to_user_id, now(), now()), (NEW.to_user_id, NEW.from_user_id, now(), now())
    ON CONFLICT (user_id, contact_user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_contact_request_accepted AFTER UPDATE ON public.contact_requests FOR EACH ROW EXECUTE FUNCTION public.on_contact_request_accepted();

-- accept_board_invitation e get_email_by_username como em produção (versão anterior)
CREATE OR REPLACE FUNCTION public.accept_board_invitation(p_invite_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth' AS $$
DECLARE v_invite record; v_user_id uuid; v_email text;
BEGIN
  v_user_id := auth.uid();
  SELECT * INTO v_invite FROM public.board_invitations WHERE id = p_invite_id;
  IF v_invite.status <> 'pending' THEN RAISE EXCEPTION 'Convite não está mais pendente.'; END IF;
  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
  IF v_invite.invitee_user_id IS NOT NULL AND v_invite.invitee_user_id <> v_user_id THEN RAISE EXCEPTION 'Convite pertence a outro usuário.'; END IF;
  INSERT INTO public.board_members (board_id, user_id, role) VALUES (v_invite.board_id, v_user_id, v_invite.role)
  ON CONFLICT (board_id, user_id) DO UPDATE SET role = EXCLUDED.role;
  UPDATE public.board_invitations SET status = 'accepted' WHERE id = p_invite_id;
END; $$;
CREATE OR REPLACE FUNCTION public.get_email_by_username(u text) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth' AS $$
DECLARE found text;
BEGIN
  SELECT au.email INTO found FROM auth.users au JOIN public.profiles p ON p.id = au.id WHERE lower(trim(p.username)) = lower(trim(u)) LIMIT 1;
  RETURN found;
END; $$;
CREATE OR REPLACE FUNCTION public.search_contact_targets(q text, lim integer DEFAULT 8) RETURNS TABLE(id uuid, username text, name text, avatar text, photo_url text, email text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth' AS $$
DECLARE normalized text;
BEGIN
  normalized := lower(trim(q));
  IF normalized IS NULL OR normalized = '' THEN RETURN; END IF;
  RETURN QUERY SELECT p.id, p.username, p.name, p.avatar, p.photo_url, NULL::text FROM public.profiles p JOIN public.privacy_settings ps ON ps.user_id = p.id
    WHERE p.username ILIKE normalized || '%' AND p.id <> auth.uid() AND ps.discoverable_by_username = true AND ps.allow_contact_requests <> 'no_one'
    ORDER BY p.username LIMIT COALESCE(lim, 8);
END; $$;
CREATE OR REPLACE FUNCTION public.toggle_message_reaction(p_message_id uuid, p_emoji text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE me uuid := auth.uid();
BEGIN
  INSERT INTO public.message_reactions (message_id, user_id, emoji) VALUES (p_message_id, me, p_emoji);
  RETURN true;
END; $$;

-- ── RLS e políticas (como em produção antes do pentest) ──
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE POLICY "Board owner can view invitations" ON public.board_invitations FOR SELECT TO authenticated USING (((SELECT auth.uid()) = (SELECT boards.owner_id FROM boards WHERE boards.id = board_invitations.board_id)));
CREATE POLICY "Invitees can update own invitations" ON public.board_invitations FOR UPDATE TO authenticated USING (((invitee_user_id = (SELECT auth.uid())) OR (lower(invitee_email) = lower(((SELECT auth.jwt()) ->> 'email'))))) WITH CHECK (((invitee_user_id = (SELECT auth.uid())) OR (lower(invitee_email) = lower(((SELECT auth.jwt()) ->> 'email')))));
CREATE POLICY "Invitees can view own invitations" ON public.board_invitations FOR SELECT TO authenticated USING (((invitee_user_id = (SELECT auth.uid())) OR (lower(invitee_email) = lower(((SELECT auth.jwt()) ->> 'email')))));
CREATE POLICY "Board admins remove non-owner members" ON public.board_members FOR DELETE TO authenticated USING ((is_board_admin(board_id) AND (NOT board_member_target_is_board_owner(board_id, user_id))));
CREATE POLICY "Board admins update non-owner members" ON public.board_members FOR UPDATE TO authenticated USING ((is_board_admin(board_id) AND (NOT board_member_target_is_board_owner(board_id, user_id)))) WITH CHECK ((is_board_admin(board_id) AND (NOT board_member_target_is_board_owner(board_id, user_id)) AND (role = ANY (ARRAY['editor', 'reader']))));
CREATE POLICY "Board members can leave (delete own row if not owner)" ON public.board_members FOR DELETE TO authenticated USING (((user_id = (SELECT auth.uid())) AND (NOT is_board_owner(board_id))));
CREATE POLICY "Board members select" ON public.board_members FOR SELECT TO authenticated USING ((is_board_owner(board_id) OR auth_user_is_board_member(board_id)));
CREATE POLICY "Invitees can insert board_members from invitations" ON public.board_members FOR INSERT TO authenticated WITH CHECK ((EXISTS (SELECT 1 FROM board_invitations bi WHERE ((bi.board_id = board_members.board_id) AND (bi.invitee_user_id = (SELECT auth.uid())) AND (bi.status = ANY (ARRAY['pending', 'accepted']))))));
CREATE POLICY "Invitees can update board_members from invitations" ON public.board_members FOR UPDATE TO authenticated USING ((EXISTS (SELECT 1 FROM board_invitations bi WHERE ((bi.board_id = board_members.board_id) AND (bi.invitee_user_id = (SELECT auth.uid())) AND (bi.status = ANY (ARRAY['pending', 'accepted'])))))) WITH CHECK ((EXISTS (SELECT 1 FROM board_invitations bi WHERE ((bi.board_id = board_members.board_id) AND (bi.invitee_user_id = (SELECT auth.uid())) AND (bi.status = ANY (ARRAY['pending', 'accepted']))))));
CREATE POLICY "Owner manages members" ON public.board_members FOR ALL TO authenticated USING (owns_board(board_id)) WITH CHECK (owns_board(board_id));
CREATE POLICY "Boards select owner or members" ON public.boards FOR SELECT TO authenticated USING (((owner_id = (SELECT auth.uid())) OR (EXISTS (SELECT 1 FROM board_members bm WHERE ((bm.board_id = boards.id) AND (bm.user_id = (SELECT auth.uid())))))));
CREATE POLICY "Boards write owner or editors (delete)" ON public.boards FOR DELETE TO authenticated USING (((owner_id = (SELECT auth.uid())) OR (EXISTS (SELECT 1 FROM board_members bm WHERE ((bm.board_id = boards.id) AND (bm.user_id = (SELECT auth.uid())) AND (bm.role = ANY (ARRAY['owner', 'admin', 'editor'])))))));
CREATE POLICY "Boards write owner or editors (insert)" ON public.boards FOR INSERT TO authenticated WITH CHECK (((owner_id = (SELECT auth.uid())) OR (EXISTS (SELECT 1 FROM board_members bm WHERE ((bm.board_id = boards.id) AND (bm.user_id = (SELECT auth.uid())) AND (bm.role = ANY (ARRAY['owner', 'admin', 'editor'])))))));
CREATE POLICY "Boards write owner or editors (update)" ON public.boards FOR UPDATE TO authenticated USING (((owner_id = (SELECT auth.uid())) OR (EXISTS (SELECT 1 FROM board_members bm WHERE ((bm.board_id = boards.id) AND (bm.user_id = (SELECT auth.uid())) AND (bm.role = ANY (ARRAY['owner', 'admin', 'editor']))))))) WITH CHECK (((owner_id = (SELECT auth.uid())) OR (EXISTS (SELECT 1 FROM board_members bm WHERE ((bm.board_id = boards.id) AND (bm.user_id = (SELECT auth.uid())) AND (bm.role = ANY (ARRAY['owner', 'admin', 'editor'])))))));
CREATE POLICY "Lists select follow board access" ON public.lists FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM boards b WHERE b.id = lists.board_id AND (b.owner_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.user_id = (SELECT auth.uid())))));
CREATE POLICY "Cards select follow board access" ON public.cards FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM lists l JOIN boards b ON b.id = l.board_id WHERE l.id = cards.list_id AND (b.owner_id = (SELECT auth.uid()) OR EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = b.id AND bm.user_id = (SELECT auth.uid())))));
CREATE POLICY "Card attachments select by card access" ON public.card_attachments FOR SELECT TO authenticated USING (can_access_card(card_id));
CREATE POLICY "Card attachments insert by card edit access" ON public.card_attachments FOR INSERT TO authenticated WITH CHECK ((can_edit_card_content(card_id) AND (created_by = (SELECT auth.uid()))));
CREATE POLICY "Card attachments update by card edit access" ON public.card_attachments FOR UPDATE TO authenticated USING (can_edit_card_content(card_id)) WITH CHECK (can_edit_card_content(card_id));
CREATE POLICY "Card comments select by card access" ON public.card_comments FOR SELECT TO authenticated USING (can_access_card(card_id));
CREATE POLICY "Card comments update own or moderated" ON public.card_comments FOR UPDATE TO authenticated USING ((((author_id = (SELECT auth.uid())) AND (deleted_at IS NULL)) OR can_moderate_card_comments(card_id))) WITH CHECK (((author_id = (SELECT auth.uid())) OR can_moderate_card_comments(card_id)));
CREATE POLICY "To user can update contact_request status" ON public.contact_requests FOR UPDATE TO authenticated USING (((SELECT auth.uid()) = to_user_id)) WITH CHECK (((SELECT auth.uid()) = to_user_id));
CREATE POLICY "Users can read own contact_requests" ON public.contact_requests FOR SELECT TO authenticated USING ((((SELECT auth.uid()) = from_user_id) OR ((SELECT auth.uid()) = to_user_id)));
CREATE POLICY "Users can manage own contacts" ON public.contacts FOR ALL TO authenticated USING (((SELECT auth.uid()) = user_id)) WITH CHECK (((SELECT auth.uid()) = user_id));
CREATE POLICY "Participants can read conversation_participants" ON public.conversation_participants FOR SELECT TO authenticated USING (is_conversation_participant(conversation_id));
CREATE POLICY "Participants read reactions" ON public.message_reactions FOR SELECT TO authenticated USING ((EXISTS (SELECT 1 FROM messages m WHERE ((m.id = message_reactions.message_id) AND is_conversation_participant(m.conversation_id)))));
CREATE POLICY "Users manage own reactions" ON public.message_reactions FOR ALL TO authenticated USING (((SELECT auth.uid()) = user_id)) WITH CHECK (((SELECT auth.uid()) = user_id));
CREATE POLICY "Participants can read messages" ON public.messages FOR SELECT TO authenticated USING (is_conversation_participant(conversation_id));
CREATE POLICY "Participants can send messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (((sender_id = (SELECT auth.uid())) AND can_send_conversation_message(conversation_id)));
CREATE POLICY "Sender can update own messages" ON public.messages FOR UPDATE TO authenticated USING ((sender_id = (SELECT auth.uid()))) WITH CHECK ((sender_id = (SELECT auth.uid())));
CREATE POLICY "Profiles select by contact_requests" ON public.profiles FOR SELECT TO authenticated USING (has_contact_request_with(id));
CREATE POLICY "Profiles select by contacts" ON public.profiles FOR SELECT TO authenticated USING ((((SELECT auth.uid()) = id) OR is_shared_board_member(id) OR is_contact(id)));
CREATE POLICY "Space assets access members" ON public.space_assets FOR ALL TO authenticated USING (can_access_space(space_id, false)) WITH CHECK (can_access_space(space_id, true));
CREATE POLICY "Space comments access members" ON public.space_comments FOR ALL TO authenticated USING (can_access_space(space_id, false)) WITH CHECK (can_access_space(space_id, true));
CREATE POLICY "Space members select" ON public.space_members FOR SELECT TO authenticated USING (((user_id = (SELECT auth.uid())) OR is_space_owner(space_id)));
CREATE POLICY "Spaces select owner or members" ON public.spaces FOR SELECT TO authenticated USING (((owner_id = (SELECT auth.uid())) OR (EXISTS (SELECT 1 FROM space_members sm WHERE ((sm.space_id = spaces.id) AND (sm.user_id = (SELECT auth.uid())))))));
CREATE POLICY "Spaces write owner or editors" ON public.spaces FOR UPDATE TO authenticated USING (((owner_id = (SELECT auth.uid())) OR (EXISTS (SELECT 1 FROM space_members sm WHERE ((sm.space_id = spaces.id) AND (sm.user_id = (SELECT auth.uid())) AND (sm.role = 'editor')))))) WITH CHECK (((owner_id = (SELECT auth.uid())) OR (EXISTS (SELECT 1 FROM space_members sm WHERE ((sm.space_id = spaces.id) AND (sm.user_id = (SELECT auth.uid())) AND (sm.role = 'editor'))))));
CREATE POLICY "Anyone authenticated can read presence" ON public.user_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users upsert own presence" ON public.user_presence FOR ALL TO authenticated USING (((SELECT auth.uid()) = user_id)) WITH CHECK (((SELECT auth.uid()) = user_id));
