-- Linhas guia de régua (Illustrator-style), por space e página
CREATE TABLE IF NOT EXISTS public.space_ruler_guides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    page_id TEXT NOT NULL DEFAULT 'page-main',
    axis TEXT NOT NULL CHECK (axis IN ('x', 'y')),
    position DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_space_ruler_guides_space_id ON public.space_ruler_guides(space_id);
CREATE INDEX IF NOT EXISTS idx_space_ruler_guides_space_page ON public.space_ruler_guides(space_id, page_id);

ALTER TABLE public.space_ruler_guides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage space_ruler_guides of own spaces" ON public.space_ruler_guides;
CREATE POLICY "Users can manage space_ruler_guides of own spaces"
ON public.space_ruler_guides FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_ruler_guides.space_id AND s.owner_id = auth.uid())
);

DROP TRIGGER IF EXISTS handle_updated_at_space_ruler_guides ON public.space_ruler_guides;
CREATE TRIGGER handle_updated_at_space_ruler_guides
    BEFORE UPDATE ON public.space_ruler_guides
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.space_ruler_guides;
EXCEPTION
    WHEN duplicate_object THEN
        RAISE NOTICE 'Table public.space_ruler_guides already in supabase_realtime publication.';
END $$;
