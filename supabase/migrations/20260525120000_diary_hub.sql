-- Diary Hub: day categories on cards + daily progress tracking

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS day_category text
    CHECK (day_category IS NULL OR day_category IN ('essential', 'creative', 'self'));

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS estimated_minutes integer
    CHECK (estimated_minutes IS NULL OR estimated_minutes >= 0);

CREATE TABLE IF NOT EXISTS public.daily_progress (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  tasks_completed integer NOT NULL DEFAULT 0,
  focus_seconds integer NOT NULL DEFAULT 0,
  important_task_done boolean NOT NULL DEFAULT false,
  minimal_goal_met boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_date)
);

ALTER TABLE public.daily_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_progress' AND policyname = 'daily_progress_select_own'
  ) THEN
    CREATE POLICY "daily_progress_select_own"
      ON public.daily_progress FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_progress' AND policyname = 'daily_progress_insert_own'
  ) THEN
    CREATE POLICY "daily_progress_insert_own"
      ON public.daily_progress FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_progress' AND policyname = 'daily_progress_update_own'
  ) THEN
    CREATE POLICY "daily_progress_update_own"
      ON public.daily_progress FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_progress' AND policyname = 'daily_progress_delete_own'
  ) THEN
    CREATE POLICY "daily_progress_delete_own"
      ON public.daily_progress FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END
$$;
