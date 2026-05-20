-- Presence / cursor color for realtime collab
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS presence_color text,
  ADD COLUMN IF NOT EXISTS presence_color_auto boolean DEFAULT true;
