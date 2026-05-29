-- chat-attachments: bucket privado + leitura só para participantes da conversa

UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';

CREATE OR REPLACE FUNCTION public.storage_conversation_id_from_path(p_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_name ~ '^[0-9a-fA-F-]{36}/' THEN substring(p_name, 1, 36)::uuid
    ELSE NULL
  END;
$$;

DROP POLICY IF EXISTS "chat_attachments_read" ON storage.objects;
CREATE POLICY "chat_attachments_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND public.is_conversation_participant(public.storage_conversation_id_from_path(name))
  );
