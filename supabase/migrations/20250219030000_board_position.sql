-- Adiciona coluna position aos boards para suportar reordenação persistente
ALTER TABLE public.boards ADD COLUMN IF NOT EXISTS position int NOT NULL DEFAULT 0;

-- Inicializa o position baseado na data de criação para manter a ordem atual
WITH ordered_boards AS (
  SELECT id, row_number() OVER (PARTITION BY owner_id ORDER BY created_at) - 1 as new_pos
  FROM public.boards
)
UPDATE public.boards
SET position = ordered_boards.new_pos
FROM ordered_boards
WHERE boards.id = ordered_boards.id;
