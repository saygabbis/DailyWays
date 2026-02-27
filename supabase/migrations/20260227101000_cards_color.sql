-- Cards: cor de fundo opcional (estilo listas)
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS color text;

COMMENT ON COLUMN public.cards.color IS 'Cor do card (hex ou nome)';

