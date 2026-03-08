-- Enable Realtime for boards, lists, cards and subtasks
-- These tables need to be part of the supabase_realtime publication
-- so that postgres_changes events are emitted on INSERT/UPDATE/DELETE.
--
-- Each block uses a DO/EXCEPTION to be idempotent:
-- if the table is already in the publication the command simply succeeds silently.

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
