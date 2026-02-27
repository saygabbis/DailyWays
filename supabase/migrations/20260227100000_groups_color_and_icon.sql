-- Pastas (groups): cor e ícone opcional
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS icon text;

COMMENT ON COLUMN public.groups.color IS 'Cor da pasta (hex ou nome)';
COMMENT ON COLUMN public.groups.icon IS 'Ícone da pasta (id interno do app)';

