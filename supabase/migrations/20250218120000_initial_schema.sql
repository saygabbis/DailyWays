-- DailyWays: profiles (1:1 com auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  name text,
  avatar text,
  bio text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Login por username: retorna email (executável por anon para tela de login)
CREATE OR REPLACE FUNCTION public.get_email_by_username(u text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT au.email
  FROM auth.users au
  JOIN public.profiles p ON p.id = au.id
  WHERE p.username = u
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO authenticated;

-- Boards
CREATE TABLE IF NOT EXISTS public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Novo Board',
  color text,
  emoji text DEFAULT '📋',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.board_members (
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor',
  PRIMARY KEY (board_id, user_id)
);

ALTER TABLE public.board_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can do all on own boards"
  ON public.boards FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Members can select and update shared boards"
  ON public.boards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.board_members bm
      WHERE bm.board_id = boards.id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can update shared boards"
  ON public.boards FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.board_members bm
      WHERE bm.board_id = boards.id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Board members can be read by board owner or members"
  ON public.board_members FOR SELECT
  USING (
    auth.uid() = (SELECT owner_id FROM public.boards WHERE id = board_id)
    OR user_id = auth.uid()
  );

CREATE POLICY "Board owner can insert/update/delete members"
  ON public.board_members FOR ALL
  USING (
    auth.uid() = (SELECT owner_id FROM public.boards WHERE id = board_id)
  );

-- Lists
CREATE TABLE IF NOT EXISTS public.lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova Lista',
  position int NOT NULL DEFAULT 0
);

ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lists follow board access"
  ON public.lists FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.id = lists.board_id AND (b.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.board_members bm WHERE bm.board_id = b.id AND bm.user_id = auth.uid()))
    )
  );

-- Cards
CREATE TABLE IF NOT EXISTS public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nova Tarefa',
  description text DEFAULT '',
  priority text DEFAULT 'none',
  due_date timestamptz,
  my_day boolean DEFAULT false,
  labels jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cards follow list/board access"
  ON public.cards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.lists l
      JOIN public.boards b ON b.id = l.board_id
      WHERE l.id = cards.list_id AND (b.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.board_members bm WHERE bm.board_id = b.id AND bm.user_id = auth.uid()))
    )
  );

-- Subtasks
CREATE TABLE IF NOT EXISTS public.subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  title text NOT NULL,
  done boolean DEFAULT false
);

ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subtasks follow card access"
  ON public.subtasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      JOIN public.lists l ON l.id = c.list_id
      JOIN public.boards b ON b.id = l.board_id
      WHERE c.id = subtasks.card_id AND (b.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.board_members bm WHERE bm.board_id = b.id AND bm.user_id = auth.uid()))
    )
  );
