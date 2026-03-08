-- Whiteboard: space_nodes, space_connectors, space_comments, space_assets
-- Content of infinite canvas inside a Space

-- space_nodes: all canvas objects (sticky_note, text, shape, frame, connector, image, comment)
CREATE TABLE IF NOT EXISTS public.space_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('sticky_note', 'text', 'shape', 'frame', 'connector', 'image', 'comment')),
    x FLOAT NOT NULL DEFAULT 0,
    y FLOAT NOT NULL DEFAULT 0,
    width FLOAT NOT NULL DEFAULT 100,
    height FLOAT NOT NULL DEFAULT 100,
    rotation FLOAT NOT NULL DEFAULT 0,
    scale FLOAT NOT NULL DEFAULT 1,
    data_json JSONB NOT NULL DEFAULT '{}',
    style_json JSONB NOT NULL DEFAULT '{}',
    parent_id UUID REFERENCES public.space_nodes(id) ON DELETE SET NULL,
    z_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_space_nodes_space_id ON public.space_nodes(space_id);
CREATE INDEX IF NOT EXISTS idx_space_nodes_space_type ON public.space_nodes(space_id, type);
CREATE INDEX IF NOT EXISTS idx_space_nodes_parent ON public.space_nodes(space_id, parent_id);

ALTER TABLE public.space_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage space_nodes of own spaces"
ON public.space_nodes FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_nodes.space_id AND s.owner_id = auth.uid())
);

CREATE TRIGGER handle_updated_at_space_nodes
    BEFORE UPDATE ON public.space_nodes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- space_connectors: arrows between nodes (optional separate table; connectors can also be type=connector in space_nodes)
CREATE TABLE IF NOT EXISTS public.space_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    from_node_id UUID NOT NULL REFERENCES public.space_nodes(id) ON DELETE CASCADE,
    to_node_id UUID NOT NULL REFERENCES public.space_nodes(id) ON DELETE CASCADE,
    control_points JSONB NOT NULL DEFAULT '[]',
    style_json JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_space_connectors_space_id ON public.space_connectors(space_id);

ALTER TABLE public.space_connectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage space_connectors of own spaces"
ON public.space_connectors FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_connectors.space_id AND s.owner_id = auth.uid())
);

CREATE TRIGGER handle_updated_at_space_connectors
    BEFORE UPDATE ON public.space_connectors
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- space_comments: comments at position or on a node
CREATE TABLE IF NOT EXISTS public.space_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    node_id UUID REFERENCES public.space_nodes(id) ON DELETE CASCADE,
    x FLOAT,
    y FLOAT,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    parent_id UUID REFERENCES public.space_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_space_comments_space_id ON public.space_comments(space_id);
CREATE INDEX IF NOT EXISTS idx_space_comments_node_id ON public.space_comments(node_id);
CREATE INDEX IF NOT EXISTS idx_space_comments_parent_id ON public.space_comments(parent_id);

ALTER TABLE public.space_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage space_comments of own spaces"
ON public.space_comments FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_comments.space_id AND s.owner_id = auth.uid())
);

-- space_assets: metadata for uploaded files (images) in Storage
CREATE TABLE IF NOT EXISTS public.space_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    url TEXT,
    filename TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_space_assets_space_id ON public.space_assets(space_id);

ALTER TABLE public.space_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage space_assets of own spaces"
ON public.space_assets FOR ALL
USING (
    EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_assets.space_id AND s.owner_id = auth.uid())
);

-- Realtime publication for whiteboard tables (idempotent)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.space_nodes;
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Table public.space_nodes already in supabase_realtime publication.';
END $$;
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.space_connectors;
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Table public.space_connectors already in supabase_realtime publication.';
END $$;
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.space_comments;
EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'Table public.space_comments already in supabase_realtime publication.';
END $$;
