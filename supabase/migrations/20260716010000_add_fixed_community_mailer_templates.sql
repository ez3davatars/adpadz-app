-- Replace freeform Community Mailer geometry with a small approved template
-- catalog. Existing mailers remain legacy until an operator explicitly
-- converts each side; assignment and order history block destructive changes.

ALTER TABLE public.community_cards
  ADD COLUMN IF NOT EXISTS front_layout_variant text NOT NULL DEFAULT 'legacy_freeform',
  ADD COLUMN IF NOT EXISTS back_layout_variant text NOT NULL DEFAULT 'legacy_freeform';

ALTER TABLE public.community_cards
  DROP CONSTRAINT IF EXISTS community_cards_front_layout_variant_check,
  DROP CONSTRAINT IF EXISTS community_cards_back_layout_variant_check;
ALTER TABLE public.community_cards
  ADD CONSTRAINT community_cards_front_layout_variant_check
    CHECK (front_layout_variant IN ('legacy_freeform', 'double_top', 'double_bottom', 'compact')) NOT VALID,
  ADD CONSTRAINT community_cards_back_layout_variant_check
    CHECK (back_layout_variant IN ('legacy_freeform', 'double_top', 'double_bottom', 'compact')) NOT VALID;

ALTER TABLE public.community_card_slots
  ADD COLUMN IF NOT EXISTS template_index smallint;
ALTER TABLE public.community_card_slots
  DROP CONSTRAINT IF EXISTS community_card_slots_template_index_check;
ALTER TABLE public.community_card_slots
  ADD CONSTRAINT community_card_slots_template_index_check
    CHECK (template_index IS NULL OR template_index BETWEEN 1 AND 6) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS community_card_slots_template_position_uidx
  ON public.community_card_slots(community_card_id, side, template_index)
  WHERE template_index IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_fixed_community_mailer_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  selected_variant text;
BEGIN
  SELECT CASE WHEN NEW.side = 'front'
      THEN card.front_layout_variant ELSE card.back_layout_variant END
  INTO selected_variant
  FROM public.community_cards AS card
  WHERE card.id = NEW.community_card_id;

  IF selected_variant <> 'legacy_freeform'
     AND NEW.placement_type NOT IN ('brand', 'adpadz')
     AND NEW.template_index IS NULL THEN
    RAISE EXCEPTION 'Fixed Community Mailers only accept approved template placements.';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.template_index IS NOT NULL AND (
    NEW.side IS DISTINCT FROM OLD.side OR
    NEW.template_index IS DISTINCT FROM OLD.template_index OR
    NEW.x IS DISTINCT FROM OLD.x OR NEW.y IS DISTINCT FROM OLD.y OR
    NEW.width IS DISTINCT FROM OLD.width OR
    NEW.height IS DISTINCT FROM OLD.height OR
    NEW.placement_type IS DISTINCT FROM OLD.placement_type
  ) THEN
    RAISE EXCEPTION 'Placement geometry is controlled by the approved mailer template.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_card_slots_enforce_fixed_template
  ON public.community_card_slots;
CREATE TRIGGER community_card_slots_enforce_fixed_template
  BEFORE INSERT OR UPDATE ON public.community_card_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_fixed_community_mailer_slot();

CREATE OR REPLACE FUNCTION public.apply_admin_community_mailer_template(
  p_mailer_id uuid,
  p_side text,
  p_variant text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  mailer_format text;
  next_revision bigint;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer owner or admin access required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_side NOT IN ('front', 'back') THEN
    RAISE EXCEPTION 'Choose the front or back side.';
  END IF;
  IF p_variant NOT IN ('double_top', 'double_bottom') THEN
    RAISE EXCEPTION 'Choose an approved fixed layout.';
  END IF;

  SELECT format INTO mailer_format
  FROM public.community_cards
  WHERE id = p_mailer_id AND layout_locked IS FALSE
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mailer is missing or its layout is locked.';
  END IF;
  IF mailer_format <> 'postcard_9x12' THEN
    RAISE EXCEPTION 'This layout selector currently applies only to 9 x 12 mailers.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.community_card_slots AS slot
    WHERE slot.community_card_id = p_mailer_id
      AND slot.side = p_side
      AND slot.placement_type NOT IN ('brand', 'adpadz')
      AND (
        slot.status <> 'available' OR slot.business_id IS NOT NULL OR
        slot.buyer_user_id IS NOT NULL OR
        EXISTS (
          SELECT 1 FROM public.community_card_orders AS card_order
          WHERE slot.id = ANY(card_order.slot_ids)
        )
      )
  ) THEN
    RAISE EXCEPTION 'Unassign or resolve every placement and order before changing this side layout.';
  END IF;

  DELETE FROM public.community_card_slots
  WHERE community_card_id = p_mailer_id
    AND side = p_side
    AND placement_type NOT IN ('brand', 'adpadz');

  UPDATE public.community_cards
  SET front_layout_variant = CASE WHEN p_side = 'front'
        THEN p_variant ELSE front_layout_variant END,
      back_layout_variant = CASE WHEN p_side = 'back'
        THEN p_variant ELSE back_layout_variant END,
      layout_key = 'community-appreciation-9x12-fixed',
      updated_by = auth.uid(), updated_at = now()
  WHERE id = p_mailer_id;

  INSERT INTO public.community_card_slots (
    community_card_id, slot_key, label, side, template_index,
    x, y, width, height, price_cents, status, placement_type,
    placement_tier, z_index, is_featured, is_locked
  )
  SELECT p_mailer_id,
         p_side || '-template-' || position.template_index,
         initcap(p_side) || ' ' || position.label,
         p_side, position.template_index,
         position.x, position.y, position.width, 42,
         CASE WHEN position.placement_type = 'wide' THEN 50000 ELSE 25000 END,
         'available', position.placement_type,
         CASE WHEN position.placement_type = 'wide' THEN 'premium' ELSE 'standard' END,
         1, false, true
  FROM (
    SELECT * FROM (VALUES
      (1, 'top double 1', 3::numeric, 3::numeric, 46.25::numeric, 'wide'::text),
      (2, 'top double 2', 50.75::numeric, 3::numeric, 46.25::numeric, 'wide'::text),
      (3, 'bottom 1', 3::numeric, 55::numeric, 22.75::numeric, 'standard'::text),
      (4, 'bottom 2', 26.75::numeric, 55::numeric, 22.75::numeric, 'standard'::text),
      (5, 'bottom 3', 50.5::numeric, 55::numeric, 22.75::numeric, 'standard'::text),
      (6, 'bottom 4', 74.25::numeric, 55::numeric, 22.75::numeric, 'standard'::text)
    ) AS top_positions(template_index, label, x, y, width, placement_type)
    WHERE p_variant = 'double_top'
    UNION ALL
    SELECT * FROM (VALUES
      (1, 'top 1', 3::numeric, 3::numeric, 22.75::numeric, 'standard'::text),
      (2, 'top 2', 26.75::numeric, 3::numeric, 22.75::numeric, 'standard'::text),
      (3, 'top 3', 50.5::numeric, 3::numeric, 22.75::numeric, 'standard'::text),
      (4, 'top 4', 74.25::numeric, 3::numeric, 22.75::numeric, 'standard'::text),
      (5, 'bottom double 1', 3::numeric, 55::numeric, 46.25::numeric, 'wide'::text),
      (6, 'bottom double 2', 50.75::numeric, 55::numeric, 46.25::numeric, 'wide'::text)
    ) AS bottom_positions(template_index, label, x, y, width, placement_type)
    WHERE p_variant = 'double_bottom'
  ) AS position;

  PERFORM public.assert_community_mailer_layout(p_mailer_id);
  UPDATE public.community_cards
  SET layout_revision = layout_revision + 1
  WHERE id = p_mailer_id
  RETURNING layout_revision INTO next_revision;
  RETURN next_revision;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_admin_community_mailer(
  p_title text, p_zone_name text, p_format text, p_layout_key text,
  p_household_count integer, p_mailing_date date, p_slots jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  mailer_id uuid;
  slot jsonb;
  selected_variant text;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer owner or admin access required.'
      USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_title), '') IS NULL OR NULLIF(btrim(p_zone_name), '') IS NULL THEN
    RAISE EXCEPTION 'Campaign name and mailing zone are required.';
  END IF;
  selected_variant := CASE
    WHEN p_format = 'postcard_9x12' AND p_layout_key LIKE '%double-bottom'
      THEN 'double_bottom'
    WHEN p_format = 'postcard_9x12' THEN 'double_top'
    ELSE 'compact'
  END;

  INSERT INTO public.community_cards (
    owner_id, created_by, updated_by, title, zone_name, format, layout_key,
    household_count, mailing_date, front_layout_variant, back_layout_variant
  ) VALUES (
    auth.uid(), auth.uid(), auth.uid(), btrim(p_title), btrim(p_zone_name),
    p_format, p_layout_key, p_household_count, p_mailing_date,
    selected_variant, selected_variant
  ) RETURNING id INTO mailer_id;

  FOR slot IN SELECT value FROM jsonb_array_elements(COALESCE(p_slots, '[]'::jsonb))
  LOOP
    INSERT INTO public.community_card_slots (
      community_card_id, slot_key, label, side, template_index,
      x, y, width, height, price_cents, status, placement_type,
      placement_tier, z_index, is_featured, is_locked
    ) VALUES (
      mailer_id, slot->>'slot_key', slot->>'label', slot->>'side',
      (slot->>'template_index')::smallint,
      (slot->>'x')::numeric, (slot->>'y')::numeric,
      (slot->>'width')::numeric, (slot->>'height')::numeric,
      COALESCE((slot->>'price_cents')::integer, 25000), 'available',
      COALESCE(slot->>'placement_type', 'standard'),
      CASE WHEN slot->>'placement_type' = 'wide' THEN 'premium' ELSE 'standard' END,
      1, false, true
    );
  END LOOP;
  PERFORM public.assert_community_mailer_layout(mailer_id);
  RETURN mailer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_admin_community_placement(
  p_placement_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  mailer_id uuid;
  fixed_index smallint;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer owner or admin access required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT community_card_id, template_index INTO mailer_id, fixed_index
  FROM public.community_card_slots WHERE id = p_placement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement not found.' USING ERRCODE = 'P0002';
  END IF;
  IF fixed_index IS NOT NULL THEN
    RAISE EXCEPTION 'Approved template placements cannot be deleted.';
  END IF;
  DELETE FROM public.community_card_slots AS slot
  WHERE slot.id = p_placement_id
    AND slot.status = 'available'
    AND slot.business_id IS NULL
    AND slot.buyer_user_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.community_card_orders AS card_order
      WHERE p_placement_id = ANY(card_order.slot_ids)
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only unused legacy placements can be deleted.';
  END IF;
  UPDATE public.community_cards
  SET layout_revision = layout_revision + 1,
      updated_by = auth.uid(), updated_at = now()
  WHERE id = mailer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_admin_community_mailer_template(uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_admin_community_mailer_template(uuid, text, text)
  TO authenticated;
REVOKE ALL ON FUNCTION public.enforce_fixed_community_mailer_slot()
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
