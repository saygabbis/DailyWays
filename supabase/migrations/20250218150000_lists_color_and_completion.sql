-- Listas: cor e flag "lista de conclusão" (para overview e auto-marcar subtarefas)
ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS is_completion_list boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.lists.color IS 'Cor da lista (hex ou nome)';
COMMENT ON COLUMN public.lists.is_completion_list IS 'Se true, cards nesta lista contam como concluídos no overview e subtarefas são auto-marcadas ao mover';
