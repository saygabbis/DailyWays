-- RLS de space_ruler_guides alinhado a space_nodes (owner + membros editor)

DROP POLICY IF EXISTS "Users can manage space_ruler_guides of own spaces" ON public.space_ruler_guides;

DROP POLICY IF EXISTS "Space ruler guides select members" ON public.space_ruler_guides;
CREATE POLICY "Space ruler guides select members"
  ON public.space_ruler_guides FOR SELECT
  USING (can_access_space(space_id, false));

DROP POLICY IF EXISTS "Space ruler guides insert editors" ON public.space_ruler_guides;
CREATE POLICY "Space ruler guides insert editors"
  ON public.space_ruler_guides FOR INSERT
  WITH CHECK (can_access_space(space_id, true));

DROP POLICY IF EXISTS "Space ruler guides update editors" ON public.space_ruler_guides;
CREATE POLICY "Space ruler guides update editors"
  ON public.space_ruler_guides FOR UPDATE
  USING (can_access_space(space_id, true))
  WITH CHECK (can_access_space(space_id, true));

DROP POLICY IF EXISTS "Space ruler guides delete editors" ON public.space_ruler_guides;
CREATE POLICY "Space ruler guides delete editors"
  ON public.space_ruler_guides FOR DELETE
  USING (can_access_space(space_id, true));
