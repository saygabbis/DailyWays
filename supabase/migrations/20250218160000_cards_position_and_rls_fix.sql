-- =============================================================================
-- Migration: cards.position + Fix RLS infinite recursion
-- =============================================================================
-- O problema: boards RLS referencia board_members, e board_members RLS
-- referencia boards, criando recursão infinita no PostgreSQL.
-- Solução: funções SECURITY DEFINER que bypassam RLS para quebrar o ciclo.
-- =============================================================================

-- ── 1. Coluna position para cards ──────────────────────────────────────────
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS position int NOT NULL DEFAULT 0;

-- ── 2. Funções helper (SECURITY DEFINER = bypassam RLS) ───────────────────

-- Verifica se o usuário atual é dono do board
CREATE OR REPLACE FUNCTION public.owns_board(board_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards WHERE id = board_uuid AND owner_id = auth.uid()
  );
$$;

-- Verifica se o usuário atual é membro do board
CREATE OR REPLACE FUNCTION public.is_board_member(board_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.board_members WHERE board_id = board_uuid AND user_id = auth.uid()
  );
$$;

-- Verifica se o usuário pode acessar o board (dono OU membro)
CREATE OR REPLACE FUNCTION public.can_access_board(board_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.boards WHERE id = board_uuid AND owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.board_members WHERE board_id = board_uuid AND user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.owns_board(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_board_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_board(uuid) TO authenticated;

-- ── 3. Recriar policies de boards (sem recursão) ──────────────────────────

DROP POLICY IF EXISTS "Users can do all on own boards" ON public.boards;
DROP POLICY IF EXISTS "Members can select and update shared boards" ON public.boards;
DROP POLICY IF EXISTS "Members can update shared boards" ON public.boards;

CREATE POLICY "Owner full access"
  ON public.boards FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Member read access"
  ON public.boards FOR SELECT
  USING (public.is_board_member(id));

CREATE POLICY "Member update access"
  ON public.boards FOR UPDATE
  USING (public.is_board_member(id));

-- ── 4. Recriar policies de board_members (sem recursão) ───────────────────

DROP POLICY IF EXISTS "Board members can be read by board owner or members" ON public.board_members;
DROP POLICY IF EXISTS "Board owner can insert/update/delete members" ON public.board_members;

CREATE POLICY "Members see own memberships"
  ON public.board_members FOR SELECT
  USING (user_id = auth.uid() OR public.owns_board(board_id));

CREATE POLICY "Owner manages members"
  ON public.board_members FOR ALL
  USING (public.owns_board(board_id))
  WITH CHECK (public.owns_board(board_id));

-- ── 5. Recriar policies de lists (com WITH CHECK) ─────────────────────────

DROP POLICY IF EXISTS "Lists follow board access" ON public.lists;

CREATE POLICY "Lists follow board access"
  ON public.lists FOR ALL
  USING (public.can_access_board(board_id))
  WITH CHECK (public.can_access_board(board_id));

-- ── 6. Recriar policies de cards (com WITH CHECK) ─────────────────────────

DROP POLICY IF EXISTS "Cards follow list/board access" ON public.cards;

CREATE POLICY "Cards follow list/board access"
  ON public.cards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.lists l
      WHERE l.id = cards.list_id AND public.can_access_board(l.board_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lists l
      WHERE l.id = cards.list_id AND public.can_access_board(l.board_id)
    )
  );

-- ── 7. Recriar policies de subtasks (com WITH CHECK) ──────────────────────

DROP POLICY IF EXISTS "Subtasks follow card access" ON public.subtasks;

CREATE POLICY "Subtasks follow card access"
  ON public.subtasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      JOIN public.lists l ON l.id = c.list_id
      WHERE c.id = subtasks.card_id AND public.can_access_board(l.board_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cards c
      JOIN public.lists l ON l.id = c.list_id
      WHERE c.id = subtasks.card_id AND public.can_access_board(l.board_id)
    )
  );
