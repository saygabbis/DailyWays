CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Migration: Groups, Spaces and multi-selection support
-- Creates groups and spaces tables, and links boards to groups

-- Create Groups table (Foldable containers for boards or spaces)
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('board', 'space')),
    position INTEGER NOT NULL DEFAULT 0,
    is_expanded BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for groups
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own groups" 
ON public.groups FOR ALL 
USING (auth.uid() = owner_id);

-- Create Spaces table (Infinite canvas)
CREATE TABLE IF NOT EXISTS public.spaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    color TEXT,
    emoji TEXT DEFAULT '🌌'::text,
    position INTEGER NOT NULL DEFAULT 0,
    group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
    pan_x FLOAT NOT NULL DEFAULT 0,
    pan_y FLOAT NOT NULL DEFAULT 0,
    zoom FLOAT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for spaces
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own spaces" 
ON public.spaces FOR ALL 
USING (auth.uid() = owner_id);

-- Add group_id to boards
ALTER TABLE public.boards 
ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- Triggers for updated_at
CREATE TRIGGER handle_updated_at_groups 
    BEFORE UPDATE ON public.groups 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_updated_at_spaces 
    BEFORE UPDATE ON public.spaces 
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add Spaces and Groups to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spaces;
