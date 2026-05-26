-- Storage policies for chat image uploads (bucket: chat-attachments)
-- Fixes: "new row violates row-level security policy" when uploading images.

-- Ensure bucket exists (harmless if already created)
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Helper: extract conversation_id from object name "{conversation_id}/{uuid}.ext"
-- We inline the logic in policies to avoid creating extra SQL functions.

-- Read: any authenticated user can read objects in this bucket
DROP POLICY IF EXISTS "chat_attachments_read" ON storage.objects;
CREATE POLICY "chat_attachments_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'chat-attachments');

-- Insert: only conversation participants can upload into "{conversation_id}/..."
DROP POLICY IF EXISTS "chat_attachments_insert_participants" ON storage.objects;
CREATE POLICY "chat_attachments_insert_participants"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND public.is_conversation_participant(
    CASE
      WHEN name ~ '^[0-9a-fA-F-]{36}/' THEN substring(name, 1, 36)::uuid
      ELSE NULL
    END
  )
);

-- Update metadata: only owner
DROP POLICY IF EXISTS "chat_attachments_update_owner" ON storage.objects;
CREATE POLICY "chat_attachments_update_owner"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-attachments' AND owner = auth.uid())
WITH CHECK (bucket_id = 'chat-attachments' AND owner = auth.uid());

-- Delete: only owner (or participant if you prefer; keeping owner-only is safer)
DROP POLICY IF EXISTS "chat_attachments_delete_owner" ON storage.objects;
CREATE POLICY "chat_attachments_delete_owner"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-attachments' AND owner = auth.uid());

