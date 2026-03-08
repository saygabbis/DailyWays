-- Bucket space-assets para upload de imagens/arquivos do whiteboard
INSERT INTO storage.buckets (id, name, public)
VALUES ('space-assets', 'space-assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Políticas: usuários autenticados podem inserir e ler em space-assets
DROP POLICY IF EXISTS "space-assets insert" ON storage.objects;
DROP POLICY IF EXISTS "space-assets select" ON storage.objects;
DROP POLICY IF EXISTS "space-assets update" ON storage.objects;
DROP POLICY IF EXISTS "space-assets delete" ON storage.objects;

CREATE POLICY "space-assets insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'space-assets');

CREATE POLICY "space-assets select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'space-assets');

CREATE POLICY "space-assets update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'space-assets');

CREATE POLICY "space-assets delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'space-assets');
