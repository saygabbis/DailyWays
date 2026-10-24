-- Espelho mínimo do schema de produção para testar funções SQL no PGlite (Postgres embutido).
-- Só as tabelas/colunas que as funções testadas usam. Conferido contra produção em 2026-10-24
-- (information_schema.columns). Não é migration: não rode no Supabase.

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;

CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
$$;

CREATE TABLE public.profiles (id uuid PRIMARY KEY, username text);

CREATE TABLE public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  position integer NOT NULL DEFAULT 0
);

CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  title text DEFAULT 'Novo Board',
  color text,
  emoji text DEFAULT '📋',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  position integer DEFAULT 0,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL
);

CREATE TABLE public.board_members (
  board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid,
  role text DEFAULT 'editor',
  PRIMARY KEY (board_id, user_id)
);

CREATE TABLE public.lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE,
  title text DEFAULT 'Nova Lista',
  position integer DEFAULT 0,
  color text,
  is_completion_list boolean DEFAULT false
);

CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid REFERENCES public.lists(id) ON DELETE CASCADE,
  title text DEFAULT 'Nova Tarefa',
  description text DEFAULT '',
  priority text DEFAULT 'none',
  due_date timestamptz,
  my_day boolean DEFAULT false,
  labels jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  position integer DEFAULT 0,
  completed boolean DEFAULT false,
  color text,
  start_date timestamptz,
  is_all_day boolean DEFAULT true,
  recurrence_rule text,
  cover_attachment_id uuid,
  updated_at timestamptz DEFAULT now(),
  day_category text,
  estimated_minutes integer
);

CREATE TABLE public.subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES public.cards(id) ON DELETE CASCADE,
  title text,
  done boolean DEFAULT false,
  position integer DEFAULT 0,
  link_url text,
  link_label text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

INSERT INTO public.profiles (id, username) VALUES
  ('00000000-0000-4000-8000-000000000001', 'u1'),
  ('00000000-0000-4000-8000-000000000002', 'u2');
