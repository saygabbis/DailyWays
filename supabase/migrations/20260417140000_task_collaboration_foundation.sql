CREATE OR REPLACE FUNCTION public.can_access_card(p_card_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON l.id = c.list_id
    JOIN public.boards b ON b.id = l.board_id
    WHERE c.id = p_card_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.board_members bm
          WHERE bm.board_id = b.id
            AND bm.user_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_card_content(p_card_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON l.id = c.list_id
    JOIN public.boards b ON b.id = l.board_id
    WHERE c.id = p_card_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.board_members bm
          WHERE bm.board_id = b.id
            AND bm.user_id = auth.uid()
            AND bm.role IN ('owner', 'admin', 'editor')
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_moderate_card_comments(p_card_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cards c
    JOIN public.lists l ON l.id = c.list_id
    JOIN public.boards b ON b.id = l.board_id
    WHERE c.id = p_card_id
      AND (
        b.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.board_members bm
          WHERE bm.board_id = b.id
            AND bm.user_id = auth.uid()
            AND bm.role IN ('owner', 'admin')
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_access_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_card_content(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_moderate_card_comments(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.card_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  kind text NOT NULL,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  link_url text,
  link_label text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT card_attachments_kind_check CHECK (kind IN ('image', 'file', 'link')),
  CONSTRAINT card_attachments_storage_or_link_check CHECK (
    (kind = 'link' AND link_url IS NOT NULL AND storage_path IS NULL)
    OR (kind IN ('image', 'file') AND storage_path IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS card_attachments_card_id_created_at_idx
  ON public.card_attachments(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS card_attachments_card_id_kind_idx
  ON public.card_attachments(card_id, kind);

ALTER TABLE public.card_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Card attachments select by card access" ON public.card_attachments;
CREATE POLICY "Card attachments select by card access"
  ON public.card_attachments FOR SELECT
  USING (public.can_access_card(card_id));

DROP POLICY IF EXISTS "Card attachments insert by card edit access" ON public.card_attachments;
CREATE POLICY "Card attachments insert by card edit access"
  ON public.card_attachments FOR INSERT
  WITH CHECK (
    public.can_edit_card_content(card_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Card attachments update by card edit access" ON public.card_attachments;
CREATE POLICY "Card attachments update by card edit access"
  ON public.card_attachments FOR UPDATE
  USING (public.can_edit_card_content(card_id))
  WITH CHECK (public.can_edit_card_content(card_id));

DROP POLICY IF EXISTS "Card attachments delete by card edit access" ON public.card_attachments;
CREATE POLICY "Card attachments delete by card edit access"
  ON public.card_attachments FOR DELETE
  USING (public.can_edit_card_content(card_id));

CREATE TABLE IF NOT EXISTS public.card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT card_comments_body_not_empty CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS card_comments_card_id_created_at_idx
  ON public.card_comments(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS card_comments_card_id_deleted_at_idx
  ON public.card_comments(card_id, deleted_at);

ALTER TABLE public.card_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Card comments select by card access" ON public.card_comments;
CREATE POLICY "Card comments select by card access"
  ON public.card_comments FOR SELECT
  USING (public.can_access_card(card_id));

DROP POLICY IF EXISTS "Card comments insert by card edit access" ON public.card_comments;
CREATE POLICY "Card comments insert by card edit access"
  ON public.card_comments FOR INSERT
  WITH CHECK (
    public.can_edit_card_content(card_id)
    AND author_id = auth.uid()
  );

DROP POLICY IF EXISTS "Card comments update own or moderated" ON public.card_comments;
CREATE POLICY "Card comments update own or moderated"
  ON public.card_comments FOR UPDATE
  USING (
    (author_id = auth.uid() AND deleted_at IS NULL)
    OR public.can_moderate_card_comments(card_id)
  )
  WITH CHECK (
    (author_id = auth.uid())
    OR public.can_moderate_card_comments(card_id)
  );

DROP POLICY IF EXISTS "Card comments delete own or moderated" ON public.card_comments;
CREATE POLICY "Card comments delete own or moderated"
  ON public.card_comments FOR DELETE
  USING (
    author_id = auth.uid()
    OR public.can_moderate_card_comments(card_id)
  );

CREATE TABLE IF NOT EXISTS public.card_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS card_activity_logs_card_id_created_at_idx
  ON public.card_activity_logs(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS card_activity_logs_event_type_idx
  ON public.card_activity_logs(event_type);

ALTER TABLE public.card_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Card activity logs select by card access" ON public.card_activity_logs;
CREATE POLICY "Card activity logs select by card access"
  ON public.card_activity_logs FOR SELECT
  USING (public.can_access_card(card_id));

DROP POLICY IF EXISTS "Card activity logs insert by card edit access" ON public.card_activity_logs;
CREATE POLICY "Card activity logs insert by card edit access"
  ON public.card_activity_logs FOR INSERT
  WITH CHECK (
    public.can_edit_card_content(card_id)
    AND (actor_id IS NULL OR actor_id = auth.uid())
  );

CREATE TABLE IF NOT EXISTS public.card_assignees (
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (card_id, user_id)
);

CREATE INDEX IF NOT EXISTS card_assignees_user_id_idx
  ON public.card_assignees(user_id, created_at DESC);

ALTER TABLE public.card_assignees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Card assignees select by card access" ON public.card_assignees;
CREATE POLICY "Card assignees select by card access"
  ON public.card_assignees FOR SELECT
  USING (public.can_access_card(card_id));

DROP POLICY IF EXISTS "Card assignees insert by card edit access" ON public.card_assignees;
CREATE POLICY "Card assignees insert by card edit access"
  ON public.card_assignees FOR INSERT
  WITH CHECK (
    public.can_edit_card_content(card_id)
    AND (
      assigned_by IS NULL
      OR assigned_by = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.cards c
      JOIN public.lists l ON l.id = c.list_id
      JOIN public.board_members bm ON bm.board_id = l.board_id
      WHERE c.id = card_assignees.card_id
        AND bm.user_id = card_assignees.user_id
    )
  );

DROP POLICY IF EXISTS "Card assignees delete by card edit access" ON public.card_assignees;
CREATE POLICY "Card assignees delete by card edit access"
  ON public.card_assignees FOR DELETE
  USING (public.can_edit_card_content(card_id));

ALTER TABLE public.cards
  DROP CONSTRAINT IF EXISTS cards_cover_attachment_id_fkey;

ALTER TABLE public.cards
  ADD CONSTRAINT cards_cover_attachment_id_fkey
  FOREIGN KEY (cover_attachment_id)
  REFERENCES public.card_attachments(id)
  ON DELETE SET NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  false,
  10485760,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Task attachments read" ON storage.objects;
CREATE POLICY "Task attachments read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'task-attachments'
    AND public.can_access_card((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Task attachments insert" ON storage.objects;
CREATE POLICY "Task attachments insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND auth.uid() IS NOT NULL
    AND public.can_edit_card_content((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Task attachments update" ON storage.objects;
CREATE POLICY "Task attachments update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'task-attachments'
    AND public.can_edit_card_content((storage.foldername(name))[1]::uuid)
  )
  WITH CHECK (
    bucket_id = 'task-attachments'
    AND public.can_edit_card_content((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "Task attachments delete" ON storage.objects;
CREATE POLICY "Task attachments delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'task-attachments'
    AND public.can_edit_card_content((storage.foldername(name))[1]::uuid)
  );

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.card_attachments;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.card_attachments already in supabase_realtime publication.';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.card_comments;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.card_comments already in supabase_realtime publication.';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.card_activity_logs;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.card_activity_logs already in supabase_realtime publication.';
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.card_assignees;
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE 'Table public.card_assignees already in supabase_realtime publication.';
END $$;
