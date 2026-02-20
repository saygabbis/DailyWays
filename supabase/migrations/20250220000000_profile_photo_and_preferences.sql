-- ================================================================
-- DailyWays: Foto de perfil + preferências salvas na conta
-- ================================================================

-- 1. Novas colunas na tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photo_url  text,
  ADD COLUMN IF NOT EXISTS theme      text DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS accent     text DEFAULT 'purple',
  ADD COLUMN IF NOT EXISTS font_id    text DEFAULT 'poppins',
  ADD COLUMN IF NOT EXISTS language   text DEFAULT 'pt-br',
  ADD COLUMN IF NOT EXISTS anim_style text DEFAULT 'default';

-- 2. Bucket público para fotos de perfil
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,          -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS para o bucket avatars
--    Qualquer person autenticada pode ver (bucket é público, mas RLS ainda se aplica ao SELECT)
CREATE POLICY "Avatar public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

--    O usuário só pode fazer upload/update dentro da sua própria pasta (userId/*)
CREATE POLICY "Avatar owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Avatar owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Avatar owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
