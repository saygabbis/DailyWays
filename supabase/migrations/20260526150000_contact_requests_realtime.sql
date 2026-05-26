-- Realtime para pedidos de contato (notificações instantâneas)

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.contact_requests;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.contact_requests already in supabase_realtime publication.';
END $$;
