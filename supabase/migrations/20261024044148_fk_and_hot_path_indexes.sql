-- Vistoria 2026-10-24 — índices.
-- As tabelas centrais não tinham índice nas FKs (cards.list_id, lists.board_id, boards.owner_id,
-- board_members.user_id, messages.conversation_id…). Toda checagem de RLS e todo load de board
-- fazia seq scan, e DELETE em cascata varria a tabela filha inteira.

-- Caminhos quentes (com a ordenação que o app usa)
CREATE INDEX IF NOT EXISTS boards_owner_id_position_idx ON public.boards (owner_id, position);
CREATE INDEX IF NOT EXISTS lists_board_id_position_idx ON public.lists (board_id, position);
CREATE INDEX IF NOT EXISTS cards_list_id_position_idx ON public.cards (list_id, position);
CREATE INDEX IF NOT EXISTS board_members_user_id_idx ON public.board_members (user_id);
CREATE INDEX IF NOT EXISTS messages_conversation_id_created_at_idx ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversation_participants_user_id_idx ON public.conversation_participants (user_id);
CREATE INDEX IF NOT EXISTS groups_owner_id_position_idx ON public.groups (owner_id, position);
CREATE INDEX IF NOT EXISTS spaces_owner_id_position_idx ON public.spaces (owner_id, position);
CREATE INDEX IF NOT EXISTS space_members_user_id_idx ON public.space_members (user_id);
CREATE INDEX IF NOT EXISTS board_invitations_board_id_idx ON public.board_invitations (board_id);
CREATE INDEX IF NOT EXISTS board_invitations_invitee_user_id_idx ON public.board_invitations (invitee_user_id);
CREATE INDEX IF NOT EXISTS space_invitations_space_id_idx ON public.space_invitations (space_id);
CREATE INDEX IF NOT EXISTS space_invitations_invitee_user_id_idx ON public.space_invitations (invitee_user_id);
CREATE INDEX IF NOT EXISTS contact_requests_to_user_id_idx ON public.contact_requests (to_user_id);
CREATE INDEX IF NOT EXISTS contacts_contact_user_id_idx ON public.contacts (contact_user_id);
CREATE INDEX IF NOT EXISTS journal_notes_user_id_idx ON public.journal_notes (user_id);
CREATE INDEX IF NOT EXISTS dm_message_requests_recipient_id_idx ON public.dm_message_requests (recipient_id);
CREATE INDEX IF NOT EXISTS dm_request_messages_request_id_idx ON public.dm_request_messages (request_id);
CREATE INDEX IF NOT EXISTS board_undo_stacks_board_id_idx ON public.board_undo_stacks (board_id);

-- Demais FKs (aceleram ON DELETE CASCADE / SET NULL, p.ex. ao apagar usuário, card ou nó)
CREATE INDEX IF NOT EXISTS blocked_users_blocked_user_id_idx ON public.blocked_users (blocked_user_id);
CREATE INDEX IF NOT EXISTS board_invitations_inviter_id_idx ON public.board_invitations (inviter_id);
CREATE INDEX IF NOT EXISTS boards_group_id_idx ON public.boards (group_id);
CREATE INDEX IF NOT EXISTS card_activity_logs_actor_id_idx ON public.card_activity_logs (actor_id);
CREATE INDEX IF NOT EXISTS card_assignees_assigned_by_idx ON public.card_assignees (assigned_by);
CREATE INDEX IF NOT EXISTS card_attachments_created_by_idx ON public.card_attachments (created_by);
CREATE INDEX IF NOT EXISTS card_comments_author_id_idx ON public.card_comments (author_id);
CREATE INDEX IF NOT EXISTS cards_cover_attachment_id_idx ON public.cards (cover_attachment_id);
CREATE INDEX IF NOT EXISTS conversation_participants_last_read_message_id_idx ON public.conversation_participants (last_read_message_id);
CREATE INDEX IF NOT EXISTS dev_tool_config_updated_by_idx ON public.dev_tool_config (updated_by);
CREATE INDEX IF NOT EXISTS dm_request_messages_sender_id_idx ON public.dm_request_messages (sender_id);
CREATE INDEX IF NOT EXISTS message_reactions_user_id_idx ON public.message_reactions (user_id);
CREATE INDEX IF NOT EXISTS message_receipts_user_id_idx ON public.message_receipts (user_id);
CREATE INDEX IF NOT EXISTS message_user_state_user_id_idx ON public.message_user_state (user_id);
CREATE INDEX IF NOT EXISTS messages_reply_to_id_idx ON public.messages (reply_to_id);
CREATE INDEX IF NOT EXISTS messages_sender_id_idx ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS space_assets_created_by_idx ON public.space_assets (created_by);
CREATE INDEX IF NOT EXISTS space_comments_author_id_idx ON public.space_comments (author_id);
CREATE INDEX IF NOT EXISTS space_connectors_from_node_id_idx ON public.space_connectors (from_node_id);
CREATE INDEX IF NOT EXISTS space_connectors_to_node_id_idx ON public.space_connectors (to_node_id);
CREATE INDEX IF NOT EXISTS space_invitations_inviter_id_idx ON public.space_invitations (inviter_id);
CREATE INDEX IF NOT EXISTS space_nodes_created_by_idx ON public.space_nodes (created_by);
CREATE INDEX IF NOT EXISTS spaces_group_id_idx ON public.spaces (group_id);
