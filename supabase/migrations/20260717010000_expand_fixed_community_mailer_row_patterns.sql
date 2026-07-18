-- Expand the approved 9x12 template catalog into independently composable
-- four-unit top and bottom rows. Sellable artwork reaches the bleed-safe edge;
-- only narrow gutters and the protected center mailing/identity band remain.

ALTER TABLE public.community_cards
  ADD COLUMN IF NOT EXISTS front_top_pattern text NOT NULL DEFAULT 'double_pair',
  ADD COLUMN IF NOT EXISTS front_bottom_pattern text NOT NULL DEFAULT 'singles',
  ADD COLUMN IF NOT EXISTS back_top_pattern text NOT NULL DEFAULT 'double_pair',
  ADD COLUMN IF NOT EXISTS back_bottom_pattern text NOT NULL DEFAULT 'singles';

UPDATE public.community_cards
SET front_top_pattern = CASE WHEN front_layout_variant = 'double_bottom' THEN 'singles' ELSE 'double_pair' END,
    front_bottom_pattern = CASE WHEN front_layout_variant = 'double_bottom' THEN 'double_pair' ELSE 'singles' END,
    back_top_pattern = CASE WHEN back_layout_variant = 'double_bottom' THEN 'singles' ELSE 'double_pair' END,
    back_bottom_pattern = CASE WHEN back_layout_variant = 'double_bottom' THEN 'double_pair' ELSE 'singles' END
WHERE front_layout_variant IN ('double_top', 'double_bottom')
   OR back_layout_variant IN ('double_top', 'double_bottom');

ALTER TABLE public.community_cards
  DROP CONSTRAINT IF EXISTS community_cards_front_top_pattern_check,
  DROP CONSTRAINT IF EXISTS community_cards_front_bottom_pattern_check,
  DROP CONSTRAINT IF EXISTS community_cards_back_top_pattern_check,
  DROP CONSTRAINT IF EXISTS community_cards_back_bottom_pattern_check,
  DROP CONSTRAINT IF EXISTS community_cards_front_layout_variant_check,
  DROP CONSTRAINT IF EXISTS community_cards_back_layout_variant_check;
ALTER TABLE public.community_cards
  ADD CONSTRAINT community_cards_front_top_pattern_check CHECK (front_top_pattern IN ('singles','double_left','double_center','double_right','double_pair','full')),
  ADD CONSTRAINT community_cards_front_bottom_pattern_check CHECK (front_bottom_pattern IN ('singles','double_left','double_center','double_right','double_pair','full')),
  ADD CONSTRAINT community_cards_back_top_pattern_check CHECK (back_top_pattern IN ('singles','double_left','double_center','double_right','double_pair','full')),
  ADD CONSTRAINT community_cards_back_bottom_pattern_check CHECK (back_bottom_pattern IN ('singles','double_left','double_center','double_right','double_pair','full')),
  ADD CONSTRAINT community_cards_front_layout_variant_check CHECK (front_layout_variant IN ('legacy_freeform','double_top','double_bottom','row_grid','compact')) NOT VALID,
  ADD CONSTRAINT community_cards_back_layout_variant_check CHECK (back_layout_variant IN ('legacy_freeform','double_top','double_bottom','row_grid','compact')) NOT VALID;

ALTER TABLE public.community_card_slots
  DROP CONSTRAINT IF EXISTS community_card_slots_template_index_check;
ALTER TABLE public.community_card_slots
  ADD CONSTRAINT community_card_slots_template_index_check
    CHECK (template_index IS NULL OR template_index BETWEEN 1 AND 8) NOT VALID;

CREATE OR REPLACE FUNCTION public.community_mailer_row_segments(p_pattern text)
RETURNS TABLE (segment_order integer, unit_start integer, unit_count integer)
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT segment_order, unit_start, unit_count
  FROM (VALUES
    ('singles', 1, 0, 1), ('singles', 2, 1, 1), ('singles', 3, 2, 1), ('singles', 4, 3, 1),
    ('double_left', 1, 0, 2), ('double_left', 2, 2, 1), ('double_left', 3, 3, 1),
    ('double_center', 1, 0, 1), ('double_center', 2, 1, 2), ('double_center', 3, 3, 1),
    ('double_right', 1, 0, 1), ('double_right', 2, 1, 1), ('double_right', 3, 2, 2),
    ('double_pair', 1, 0, 2), ('double_pair', 2, 2, 2),
    ('full', 1, 0, 4)
  ) AS segment(pattern, segment_order, unit_start, unit_count)
  WHERE pattern = p_pattern
  ORDER BY segment_order;
$$;

CREATE OR REPLACE FUNCTION public.apply_admin_community_mailer_template(
  p_mailer_id uuid, p_side text, p_top_pattern text, p_bottom_pattern text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  mailer_format text;
  next_revision bigint;
  top_count integer;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer owner or admin access required.' USING ERRCODE = '42501';
  END IF;
  IF p_side NOT IN ('front', 'back') THEN RAISE EXCEPTION 'Choose the front or back side.'; END IF;
  IF p_top_pattern NOT IN ('singles','double_left','double_center','double_right','double_pair','full')
     OR p_bottom_pattern NOT IN ('singles','double_left','double_center','double_right','double_pair','full') THEN
    RAISE EXCEPTION 'Choose approved top and bottom row layouts.';
  END IF;

  SELECT format INTO mailer_format FROM public.community_cards
  WHERE id = p_mailer_id AND layout_locked IS FALSE FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mailer is missing or its layout is locked.'; END IF;
  IF mailer_format <> 'postcard_9x12' THEN RAISE EXCEPTION 'Row layouts apply only to 9 x 12 mailers.'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.community_card_slots AS slot
    WHERE slot.community_card_id = p_mailer_id AND slot.side = p_side
      AND slot.placement_type NOT IN ('brand', 'adpadz')
      AND (slot.status <> 'available' OR slot.business_id IS NOT NULL OR slot.buyer_user_id IS NOT NULL
        OR EXISTS (SELECT 1 FROM public.community_card_orders AS card_order WHERE slot.id = ANY(card_order.slot_ids)))
  ) THEN
    RAISE EXCEPTION 'Unassign or resolve every placement and order before changing this side layout.';
  END IF;

  DELETE FROM public.community_card_slots
  WHERE community_card_id = p_mailer_id AND side = p_side
    AND placement_type NOT IN ('brand', 'adpadz');

  UPDATE public.community_cards SET
    front_layout_variant = CASE WHEN p_side = 'front' THEN 'row_grid' ELSE front_layout_variant END,
    back_layout_variant = CASE WHEN p_side = 'back' THEN 'row_grid' ELSE back_layout_variant END,
    front_top_pattern = CASE WHEN p_side = 'front' THEN p_top_pattern ELSE front_top_pattern END,
    front_bottom_pattern = CASE WHEN p_side = 'front' THEN p_bottom_pattern ELSE front_bottom_pattern END,
    back_top_pattern = CASE WHEN p_side = 'back' THEN p_top_pattern ELSE back_top_pattern END,
    back_bottom_pattern = CASE WHEN p_side = 'back' THEN p_bottom_pattern ELSE back_bottom_pattern END,
    layout_key = 'community-appreciation-9x12-row-grid', updated_by = auth.uid(), updated_at = now()
  WHERE id = p_mailer_id;

  SELECT count(*) INTO top_count FROM public.community_mailer_row_segments(p_top_pattern);
  INSERT INTO public.community_card_slots (
    community_card_id, slot_key, label, side, template_index, x, y, width, height,
    price_cents, status, placement_type, placement_tier, z_index, is_featured, is_locked
  )
  SELECT p_mailer_id, p_side || '-' || row_name || '-' || segment_order,
    initcap(p_side) || ' ' || row_name || ' ' || segment_order, p_side,
    CASE WHEN row_name = 'top' THEN segment_order ELSE top_count + segment_order END,
    0.75 + unit_start * 24.775, CASE WHEN row_name = 'top' THEN 0.75 ELSE 53.5 END,
    unit_count * 24.175 + (unit_count - 1) * 0.6, 45.75,
    unit_count * 25000, 'available',
    CASE WHEN unit_count = 4 THEN 'large' WHEN unit_count = 2 THEN 'wide' ELSE 'standard' END,
    CASE WHEN unit_count > 1 THEN 'premium' ELSE 'standard' END, 1, false, true
  FROM (
    SELECT 'top'::text AS row_name, * FROM public.community_mailer_row_segments(p_top_pattern)
    UNION ALL
    SELECT 'bottom'::text AS row_name, * FROM public.community_mailer_row_segments(p_bottom_pattern)
  ) AS positions;

  PERFORM public.assert_community_mailer_layout(p_mailer_id);
  UPDATE public.community_cards SET layout_revision = layout_revision + 1
  WHERE id = p_mailer_id RETURNING layout_revision INTO next_revision;
  RETURN next_revision;
END;
$$;

REVOKE ALL ON FUNCTION public.community_mailer_row_segments(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_admin_community_mailer_template(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_admin_community_mailer_template(uuid,text,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.apply_admin_community_mailer_template(uuid,text,text) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
