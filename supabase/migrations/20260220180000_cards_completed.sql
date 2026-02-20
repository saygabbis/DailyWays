-- Adiciona coluna 'completed' à tabela de cards para persistir estado de conclusão
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.cards.completed IS 'Se true, o card é marcado como concluído no dashboard e busca';
