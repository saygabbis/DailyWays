-- Configuração global de ferramentas DEV (prank, contas extras). Só o owner principal pode escrever.

CREATE TABLE IF NOT EXISTS public.dev_tool_config (
  id text PRIMARY KEY DEFAULT 'global',
  config jsonb NOT NULL DEFAULT '{"prankEnabled":true,"additionalDevs":[]}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.dev_tool_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev_tool_config_select_authenticated" ON public.dev_tool_config;
CREATE POLICY "dev_tool_config_select_authenticated"
  ON public.dev_tool_config
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "dev_tool_config_write_primary" ON public.dev_tool_config;
CREATE POLICY "dev_tool_config_write_primary"
  ON public.dev_tool_config
  FOR ALL
  TO authenticated
  USING (lower(coalesce(auth.jwt() ->> 'email', '')) = 'gaffonsoxx@gmail.com')
  WITH CHECK (lower(coalesce(auth.jwt() ->> 'email', '')) = 'gaffonsoxx@gmail.com');

INSERT INTO public.dev_tool_config (id, config)
VALUES ('global', '{"prankEnabled":true,"additionalDevs":[]}'::jsonb)
ON CONFLICT (id) DO NOTHING;
