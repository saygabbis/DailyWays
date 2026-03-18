-- Reforça que as tabelas do DailyWays que a UI escuta em realtime
-- estão incluídas na publication supabase_realtime.
-- Idempotente: se já existir, não altera nada.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.boards;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.boards already in supabase_realtime publication.';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.lists;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.lists already in supabase_realtime publication.';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cards;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.cards already in supabase_realtime publication.';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.subtasks;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.subtasks already in supabase_realtime publication.';
END $$;

-- Para o fluxo de compartilhamento / aceite
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.board_members;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.board_members already in supabase_realtime publication.';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.board_invitations;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.board_invitations already in supabase_realtime publication.';
END $$;

