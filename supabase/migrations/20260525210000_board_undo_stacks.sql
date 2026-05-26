-- Pilha de undo/redo por utilizador e board (sync entre dispositivos).

CREATE TABLE IF NOT EXISTS public.board_undo_stacks (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  stack jsonb NOT NULL DEFAULT '{"entries":[],"index":-1}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, board_id)
);

ALTER TABLE public.board_undo_stacks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own board undo stacks" ON public.board_undo_stacks;
CREATE POLICY "Users manage own board undo stacks"
  ON public.board_undo_stacks
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
