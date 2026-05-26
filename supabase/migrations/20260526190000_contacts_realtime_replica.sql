-- Realtime para lista de contatos + réplica completa para filtros em UPDATE.

ALTER TABLE public.contact_requests REPLICA IDENTITY FULL;
ALTER TABLE public.contacts REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.contacts already in supabase_realtime publication.';
END $$;
