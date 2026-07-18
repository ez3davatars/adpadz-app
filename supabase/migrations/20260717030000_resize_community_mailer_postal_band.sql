-- Resize the protected center band so the fixed front postal block matches the
-- supplied 12x9 EDDM guide while remaining in the approved center-right location.
-- Guide dimensions: 2.803 x 0.883 inches on the 12 x 9 trim.

DROP TRIGGER IF EXISTS community_card_slots_enforce_fixed_template
  ON public.community_card_slots;

UPDATE public.community_card_slots AS slot
SET y = CASE WHEN slot.slot_key LIKE '%-top-%' THEN 0.75 ELSE 54.9075 END,
    height = 44.3425,
    updated_at = now()
FROM public.community_cards AS card
WHERE card.id = slot.community_card_id
  AND card.format = 'postcard_9x12'
  AND slot.template_index IS NOT NULL
  AND slot.placement_type NOT IN ('brand', 'adpadz')
  AND (card.front_layout_variant <> 'legacy_freeform'
    OR card.back_layout_variant <> 'legacy_freeform');

CREATE TRIGGER community_card_slots_enforce_fixed_template
  BEFORE INSERT OR UPDATE ON public.community_card_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_fixed_community_mailer_slot();
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
    0.75 + unit_start * 24.775, CASE WHEN row_name = 'top' THEN 0.75 ELSE 54.9075 END,
    unit_count * 24.175 + (unit_count - 1) * 0.6, 44.3425,
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

CREATE OR REPLACE FUNCTION public.assert_community_mailer_layout(p_mailer_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.community_cards WHERE id = p_mailer_id
  ) THEN
    RAISE EXCEPTION 'Community Mailer not found.' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.community_cards
    WHERE id = p_mailer_id AND NULLIF(btrim(consumer_headline), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'The Adpadz brand headline is required.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.community_card_slots AS slot
    JOIN public.community_cards AS card ON card.id = slot.community_card_id
    WHERE slot.community_card_id = p_mailer_id
      AND slot.placement_type NOT IN ('brand', 'adpadz')
      AND (
        slot.x < 0 OR slot.y < 0 OR slot.width <= 0 OR slot.height <= 0
        OR slot.x + slot.width > 100 OR slot.y + slot.height > 100
        OR (
          card.format = 'postcard_9x12'
          AND slot.y < 54.9075 AND slot.y + slot.height > 45.0925
        )
        OR (
          card.format = 'community_card_6x11'
          AND slot.y < 31
        )
      )
  ) THEN
    RAISE EXCEPTION 'A placement is outside the printable inventory area.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.community_card_slots AS first_slot
    JOIN public.community_card_slots AS second_slot
      ON second_slot.community_card_id = first_slot.community_card_id
      AND second_slot.side = first_slot.side
      AND second_slot.id > first_slot.id
      AND first_slot.x < second_slot.x + second_slot.width
      AND first_slot.x + first_slot.width > second_slot.x
      AND first_slot.y < second_slot.y + second_slot.height
      AND first_slot.y + first_slot.height > second_slot.y
    WHERE first_slot.community_card_id = p_mailer_id
      AND first_slot.placement_type NOT IN ('brand', 'adpadz')
      AND second_slot.placement_type NOT IN ('brand', 'adpadz')
  ) THEN
    RAISE EXCEPTION 'Placements cannot overlap.';
  END IF;
  IF (
    SELECT count(*) FROM public.community_card_slots
    WHERE community_card_id = p_mailer_id
      AND (is_featured IS TRUE OR placement_type = 'featured')
  ) > 1 THEN
    RAISE EXCEPTION 'Only one featured sponsor is allowed.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.community_card_slots
    WHERE community_card_id = p_mailer_id
      AND (placement_type = 'featured' OR is_featured IS TRUE)
      AND side <> 'front'
  ) THEN
    RAISE EXCEPTION 'The featured sponsor placement must be on the front.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.community_card_slots
    WHERE community_card_id = p_mailer_id
      AND placement_type NOT IN ('brand', 'adpadz')
      AND status = 'available'
      AND price_cents - discount_cents <= 0
  ) THEN
    RAISE EXCEPTION 'Available placements require a positive net price.';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.community_card_slots AS first_slot
    JOIN public.community_card_slots AS second_slot
      ON second_slot.community_card_id = first_slot.community_card_id
      AND second_slot.id > first_slot.id
      AND lower(btrim(second_slot.category)) = lower(btrim(first_slot.category))
    WHERE first_slot.community_card_id = p_mailer_id
      AND first_slot.status <> 'available'
      AND second_slot.status <> 'available'
      AND NULLIF(btrim(first_slot.category), '') IS NOT NULL
      AND (first_slot.category_exclusive OR second_slot.category_exclusive)
  ) THEN
    RAISE EXCEPTION 'Assigned placements violate category exclusivity.';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_admin_community_mailer_template(uuid,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_admin_community_mailer_template(uuid,text,text,text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.assert_community_mailer_layout(uuid)
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';