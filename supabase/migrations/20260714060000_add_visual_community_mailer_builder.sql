-- Add the canonical visual builder without replacing existing mailer rows,
-- normalized geometry, orders, or public slugs.
ALTER TABLE public.community_cards
  ADD COLUMN IF NOT EXISTS layout_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consumer_headline text NOT NULL DEFAULT 'Support Local. Save Local.',
  ADD COLUMN IF NOT EXISTS discovery_qr_link_id uuid REFERENCES public.qr_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS layout_revision bigint NOT NULL DEFAULT 0;

UPDATE public.community_cards SET created_by = owner_id
WHERE created_by IS NULL AND owner_id IS NOT NULL;
ALTER TABLE public.community_cards DROP CONSTRAINT IF EXISTS community_cards_owner_id_fkey;
ALTER TABLE public.community_cards ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.community_cards ADD CONSTRAINT community_cards_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.community_card_orders
  DROP CONSTRAINT IF EXISTS community_card_orders_buyer_user_id_fkey;
ALTER TABLE public.community_card_orders ALTER COLUMN buyer_user_id DROP NOT NULL;
ALTER TABLE public.community_card_orders
  ADD CONSTRAINT community_card_orders_buyer_user_id_fkey
  FOREIGN KEY (buyer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.community_card_slots
  ADD COLUMN IF NOT EXISTS placement_type text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS placement_tier text NOT NULL DEFAULT 'standard',
  ADD COLUMN IF NOT EXISTS z_index integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS discount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category_exclusive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_creative_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS production_status text NOT NULL DEFAULT 'not_started';

UPDATE public.community_card_slots
SET is_featured = true, placement_tier = 'featured'
WHERE placement_type = 'featured';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'community_card_slots'
      AND column_name = 'notes'
  ) THEN
    EXECUTE 'UPDATE public.community_card_slots
      SET internal_notes = notes
      WHERE internal_notes IS NULL AND notes IS NOT NULL';
  END IF;
END;
$$;

UPDATE public.community_card_slots
SET placement_tier = 'system', is_locked = true
WHERE placement_type IN ('brand', 'adpadz');

UPDATE public.community_cards AS card
SET discovery_qr_link_id = legacy.qr_link_id
FROM (
  SELECT community_card_id, (array_agg(DISTINCT qr_link_id))[1] AS qr_link_id
  FROM public.community_card_slots
  WHERE placement_type IN ('brand', 'adpadz') AND qr_link_id IS NOT NULL
  GROUP BY community_card_id
  HAVING count(DISTINCT qr_link_id) = 1
) AS legacy
WHERE card.id = legacy.community_card_id
  AND card.discovery_qr_link_id IS NULL;

DROP TRIGGER IF EXISTS community_card_slots_category_exclusivity
  ON public.community_card_slots;
DROP FUNCTION IF EXISTS public.community_card_slot_category_is_available();

CREATE OR REPLACE FUNCTION public.get_admin_community_mailers()
RETURNS TABLE (
  id uuid, title text, zone_name text, public_slug text, format text,
  mailing_date date, household_count integer, status text,
  sales_open boolean, is_published boolean, updated_at timestamptz,
  total_placements bigint, available_placements bigint,
  held_placements bigint, sold_placements bigint,
  creative_ready bigint, payments_ready bigint, proofs_ready bigint,
  booked_revenue_cents bigint, attention_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT card.id, card.title, card.zone_name, card.public_slug, card.format,
         card.mailing_date, card.household_count, card.status,
         card.sales_open, card.is_published, card.updated_at,
         count(slot.id),
         count(slot.id) FILTER (WHERE slot.status = 'available'),
         count(slot.id) FILTER (WHERE slot.status = 'reserved'),
         count(slot.id) FILTER (WHERE slot.status IN ('sold', 'proof', 'approved')),
         count(slot.id) FILTER (
           WHERE slot.ad_image_url IS NOT NULL OR slot.creative_asset_id IS NOT NULL
         ),
         count(slot.id) FILTER (
           WHERE slot.status NOT IN ('available', 'unavailable', 'intake')
             AND slot.payment_status IN ('paid', 'waived')
         ),
         count(slot.id) FILTER (WHERE slot.proof_status = 'approved'),
         COALESCE(sum(slot.price_cents - slot.discount_cents) FILTER (
           WHERE slot.status NOT IN ('available', 'unavailable', 'intake')
             AND slot.payment_status IN ('paid', 'waived')
         ), 0),
         count(slot.id) FILTER (
           WHERE slot.status <> 'available' AND (
             slot.business_id IS NULL OR
             (slot.ad_image_url IS NULL AND slot.creative_asset_id IS NULL) OR
             slot.payment_status NOT IN ('paid', 'waived') OR
             slot.proof_status <> 'approved' OR
             slot.production_status NOT IN ('approved', 'print_ready', 'printed', 'mailed')
           )
         ) + CASE WHEN card.mailing_date IS NULL THEN 1 ELSE 0 END
  FROM public.community_cards AS card
  LEFT JOIN public.community_card_slots AS slot
    ON slot.community_card_id = card.id
    AND slot.placement_type NOT IN ('brand', 'adpadz')
  WHERE public.is_adpadz_admin(auth.uid())
  GROUP BY card.id
  ORDER BY card.updated_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_community_mailer(p_mailer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_adpadz_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Adpadz administrator access required.' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'mailer', to_jsonb(card) - 'owner_id' - 'created_by' - 'updated_by'
      || jsonb_build_object(
      'discovery_qr_destination_url', discovery_qr.destination_url
    ),
    'placements', COALESCE((
      SELECT jsonb_agg(to_jsonb(slot) - 'buyer_user_id' || jsonb_build_object(
        'business_name', business.name,
        'creative_asset_title', asset.title,
        'creative_asset_url', COALESCE(asset.file_url, asset.thumbnail_url, asset.external_url),
        'qr_title', placement_qr.title,
        'qr_destination_url', placement_qr.destination_url
      ) ORDER BY slot.side, slot.z_index, slot.slot_key)
      FROM public.community_card_slots AS slot
      LEFT JOIN public.businesses AS business ON business.id = slot.business_id
      LEFT JOIN public.business_marketing_assets AS asset
        ON asset.id = slot.creative_asset_id
      LEFT JOIN public.qr_links AS placement_qr
        ON placement_qr.id = slot.qr_link_id
        AND placement_qr.status = 'active'
        AND (placement_qr.expires_at IS NULL OR placement_qr.expires_at > now())
      WHERE slot.community_card_id = card.id
        AND slot.placement_type NOT IN ('brand', 'adpadz')
    ), '[]'::jsonb),
    'businesses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', business.id, 'name', business.name
      ) ORDER BY business.name)
      FROM public.businesses AS business WHERE business.active IS TRUE
    ), '[]'::jsonb),
    'assets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', asset.id, 'business_id', asset.business_id, 'title', asset.title,
        'url', COALESCE(asset.file_url, asset.thumbnail_url, asset.external_url)
      ) ORDER BY asset.updated_at DESC)
      FROM public.business_marketing_assets AS asset WHERE asset.is_active IS TRUE
    ), '[]'::jsonb),
    'qr_links', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', qr.id, 'business_id', qr.business_id, 'title', qr.title,
        'destination_url', qr.destination_url
      ) ORDER BY qr.title)
      FROM public.qr_links AS qr
      WHERE qr.status = 'active'
        AND (qr.expires_at IS NULL OR qr.expires_at > now())
    ), '[]'::jsonb)
  ) INTO result
  FROM public.community_cards AS card
  LEFT JOIN public.qr_links AS discovery_qr
    ON discovery_qr.id = card.discovery_qr_link_id
    AND discovery_qr.status = 'active'
    AND (discovery_qr.expires_at IS NULL OR discovery_qr.expires_at > now())
  WHERE card.id = p_mailer_id;
  IF result IS NULL THEN
    RAISE EXCEPTION 'Community Mailer not found.' USING ERRCODE = 'P0002';
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_admin_community_mailer(
  p_title text, p_zone_name text, p_format text, p_layout_key text,
  p_household_count integer, p_mailing_date date, p_slots jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE mailer_id uuid; slot jsonb;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer owner or admin access required.'
      USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_title), '') IS NULL
     OR NULLIF(btrim(p_zone_name), '') IS NULL THEN
    RAISE EXCEPTION 'Campaign name and mailing zone are required.';
  END IF;
  INSERT INTO public.community_cards (
    owner_id, created_by, updated_by, title, zone_name, format, layout_key,
    household_count, mailing_date
  ) VALUES (
    NULL, auth.uid(), auth.uid(), btrim(p_title), btrim(p_zone_name),
    p_format, p_layout_key, p_household_count, p_mailing_date
  ) RETURNING id INTO mailer_id;
  FOR slot IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_slots, '[]'::jsonb))
  LOOP
    INSERT INTO public.community_card_slots (
      community_card_id, slot_key, label, side, x, y, width, height,
      price_cents, status, placement_type, placement_tier, z_index,
      is_featured
    ) VALUES (
      mailer_id, slot->>'slot_key', slot->>'label', slot->>'side',
      (slot->>'x')::numeric, (slot->>'y')::numeric,
      (slot->>'width')::numeric, (slot->>'height')::numeric,
      COALESCE((slot->>'price_cents')::integer, 25000),
      COALESCE(slot->>'status', 'available'),
      COALESCE(slot->>'placement_type', 'standard'),
      COALESCE(slot->>'placement_tier', 'standard'),
      COALESCE((slot->>'z_index')::integer, 1),
      COALESCE((slot->>'is_featured')::boolean, false)
    );
  END LOOP;
  PERFORM public.assert_community_mailer_layout(mailer_id);
  RETURN mailer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_admin_community_mailer(
  p_mailer_id uuid, p_changes jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer owner or admin access required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR EXISTS (
    SELECT 1
    FROM jsonb_object_keys(COALESCE(p_changes, '{}'::jsonb)) AS supplied(key)
    WHERE supplied.key <> ALL (ARRAY[
      'title','zone_name','mailing_date','household_count','status',
      'sales_open','is_published','layout_locked','consumer_headline',
      'discovery_qr_link_id'
    ])
  ) THEN
    RAISE EXCEPTION 'Unsupported Community Mailer change.';
  END IF;
  IF p_changes ? 'discovery_qr_link_id'
     AND NULLIF(p_changes->>'discovery_qr_link_id', '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.qr_links AS qr
       WHERE qr.id = (p_changes->>'discovery_qr_link_id')::uuid
         AND qr.status = 'active'
         AND (qr.expires_at IS NULL OR qr.expires_at > now())
     ) THEN
    RAISE EXCEPTION 'Discovery QR link must be active and unexpired.';
  END IF;
  UPDATE public.community_cards SET
    title = CASE WHEN p_changes ? 'title'
      THEN NULLIF(btrim(p_changes->>'title'), '') ELSE title END,
    zone_name = CASE WHEN p_changes ? 'zone_name'
      THEN NULLIF(btrim(p_changes->>'zone_name'), '') ELSE zone_name END,
    mailing_date = CASE WHEN p_changes ? 'mailing_date'
      THEN NULLIF(p_changes->>'mailing_date', '')::date ELSE mailing_date END,
    household_count = CASE WHEN p_changes ? 'household_count'
      THEN (p_changes->>'household_count')::integer ELSE household_count END,
    status = CASE WHEN p_changes ? 'status' THEN p_changes->>'status' ELSE status END,
    sales_open = CASE WHEN p_changes ? 'sales_open'
      THEN (p_changes->>'sales_open')::boolean ELSE sales_open END,
    is_published = CASE WHEN p_changes ? 'is_published'
      THEN (p_changes->>'is_published')::boolean ELSE is_published END,
    layout_locked = CASE WHEN p_changes ? 'layout_locked'
      THEN (p_changes->>'layout_locked')::boolean ELSE layout_locked END,
    consumer_headline = CASE WHEN p_changes ? 'consumer_headline'
      THEN NULLIF(btrim(p_changes->>'consumer_headline'), '')
      ELSE consumer_headline END,
    discovery_qr_link_id = CASE WHEN p_changes ? 'discovery_qr_link_id'
      THEN NULLIF(p_changes->>'discovery_qr_link_id', '')::uuid
      ELSE discovery_qr_link_id END,
    updated_by = auth.uid()
  WHERE id = p_mailer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community Mailer not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.assert_community_mailer_layout(p_mailer_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_admin_community_placement(
  p_placement_id uuid, p_changes jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_slot public.community_card_slots%ROWTYPE;
  proposed_business_id uuid;
  proposed_asset_id uuid;
  proposed_qr_id uuid;
  proposed_status text;
  proposed_payment_status text;
  side_changed boolean;
  mailer_id uuid;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer owner or admin access required.'
      USING ERRCODE = '42501';
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR EXISTS (
    SELECT 1
    FROM jsonb_object_keys(COALESCE(p_changes, '{}'::jsonb)) AS supplied(key)
    WHERE supplied.key <> ALL (ARRAY[
      'label','side','placement_type','placement_tier','status','business_id',
      'creative_asset_id','qr_link_id','offer_text','category','internal_notes',
      'is_featured','price_cents','discount_cents','category_exclusive',
      'is_locked','public_creative_visible','payment_status','proof_status',
      'production_status'
    ])
  ) THEN
    RAISE EXCEPTION 'Unsupported placement change.';
  END IF;
  SELECT community_card_id INTO mailer_id
  FROM public.community_card_slots WHERE id = p_placement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM public.community_cards WHERE id = mailer_id FOR UPDATE;
  SELECT * INTO current_slot
  FROM public.community_card_slots
  WHERE id = p_placement_id AND community_card_id = mailer_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement not found.' USING ERRCODE = 'P0002';
  END IF;
  side_changed := p_changes ? 'side'
    AND current_slot.side IS DISTINCT FROM p_changes->>'side';
  IF side_changed AND current_slot.is_locked THEN
    RAISE EXCEPTION 'Unlock the placement before moving it to another side.';
  END IF;
  IF side_changed AND EXISTS (
    SELECT 1 FROM public.community_cards
    WHERE id = mailer_id AND layout_locked
  ) THEN
    RAISE EXCEPTION 'Unlock the layout before moving a placement.';
  END IF;
  proposed_business_id := CASE WHEN p_changes ? 'business_id'
    THEN NULLIF(p_changes->>'business_id', '')::uuid
    ELSE current_slot.business_id END;
  proposed_asset_id := CASE WHEN p_changes ? 'creative_asset_id'
    THEN NULLIF(p_changes->>'creative_asset_id', '')::uuid
    ELSE current_slot.creative_asset_id END;
  proposed_qr_id := CASE WHEN p_changes ? 'qr_link_id'
    THEN NULLIF(p_changes->>'qr_link_id', '')::uuid
    ELSE current_slot.qr_link_id END;
  proposed_status := CASE WHEN p_changes ? 'status'
    THEN p_changes->>'status' ELSE current_slot.status END;
  proposed_payment_status := CASE WHEN p_changes ? 'payment_status'
    THEN p_changes->>'payment_status' ELSE current_slot.payment_status END;
  IF proposed_asset_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.business_marketing_assets
    WHERE id = proposed_asset_id AND business_id = proposed_business_id
      AND is_active IS TRUE
  ) THEN
    RAISE EXCEPTION 'Creative asset must be active and belong to the assigned business.';
  END IF;
  IF proposed_qr_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.qr_links
    WHERE id = proposed_qr_id AND business_id = proposed_business_id
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION 'QR campaign must be active, unexpired, and belong to the assigned business.';
  END IF;
  IF proposed_status = 'available'
     AND current_slot.buyer_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cancel the active reservation before reopening this placement.';
  END IF;
  IF proposed_status = 'available' AND proposed_business_id IS NOT NULL THEN
    RAISE EXCEPTION 'An assigned placement cannot remain available for booking.';
  END IF;
  IF proposed_status NOT IN ('available', 'unavailable')
     AND proposed_business_id IS NULL THEN
    RAISE EXCEPTION 'Assign a business before changing this placement status.';
  END IF;
  IF proposed_status IN ('available', 'unavailable', 'intake')
     AND proposed_payment_status IN ('paid', 'waived') THEN
    RAISE EXCEPTION 'Only assigned inventory can be marked paid or waived.';
  END IF;
  IF (
    (
      p_changes ? 'price_cents'
      AND (p_changes->>'price_cents')::integer IS DISTINCT FROM current_slot.price_cents
    )
    OR (
      p_changes ? 'discount_cents'
      AND (p_changes->>'discount_cents')::integer IS DISTINCT FROM current_slot.discount_cents
    )
  ) AND EXISTS (
    SELECT 1 FROM public.community_card_orders AS orders
    WHERE current_slot.id = ANY(orders.slot_ids)
  ) THEN
    RAISE EXCEPTION 'Pricing is locked after a placement has order history.';
  END IF;
  UPDATE public.community_card_slots SET
    label = CASE WHEN p_changes ? 'label'
      THEN NULLIF(btrim(p_changes->>'label'), '') ELSE label END,
    side = CASE WHEN p_changes ? 'side' THEN p_changes->>'side' ELSE side END,
    placement_type = CASE WHEN p_changes ? 'placement_type'
      THEN p_changes->>'placement_type' ELSE placement_type END,
    placement_tier = CASE WHEN p_changes ? 'placement_tier'
      THEN p_changes->>'placement_tier' ELSE placement_tier END,
    status = proposed_status,
    business_id = proposed_business_id,
    advertiser_name = CASE WHEN p_changes ? 'business_id'
      THEN (SELECT business.name FROM public.businesses AS business
            WHERE business.id = proposed_business_id)
      ELSE advertiser_name END,
    creative_asset_id = proposed_asset_id,
    qr_link_id = proposed_qr_id,
    offer_text = CASE WHEN p_changes ? 'offer_text'
      THEN NULLIF(btrim(p_changes->>'offer_text'), '') ELSE offer_text END,
    category = CASE WHEN p_changes ? 'category'
      THEN NULLIF(btrim(p_changes->>'category'), '') ELSE category END,
    internal_notes = CASE WHEN p_changes ? 'internal_notes'
      THEN NULLIF(btrim(p_changes->>'internal_notes'), '') ELSE internal_notes END,
    is_featured = CASE WHEN p_changes ? 'is_featured'
      THEN (p_changes->>'is_featured')::boolean ELSE is_featured END,
    price_cents = CASE WHEN p_changes ? 'price_cents'
      THEN (p_changes->>'price_cents')::integer ELSE price_cents END,
    discount_cents = CASE WHEN p_changes ? 'discount_cents'
      THEN (p_changes->>'discount_cents')::integer ELSE discount_cents END,
    category_exclusive = CASE WHEN p_changes ? 'category_exclusive'
      THEN (p_changes->>'category_exclusive')::boolean
      ELSE category_exclusive END,
    is_locked = CASE WHEN p_changes ? 'is_locked'
      THEN (p_changes->>'is_locked')::boolean ELSE is_locked END,
    public_creative_visible = CASE WHEN p_changes ? 'public_creative_visible'
      THEN (p_changes->>'public_creative_visible')::boolean
      ELSE public_creative_visible END,
    payment_status = proposed_payment_status,
    proof_status = CASE WHEN p_changes ? 'proof_status'
      THEN p_changes->>'proof_status' ELSE proof_status END,
    production_status = CASE WHEN p_changes ? 'production_status'
      THEN p_changes->>'production_status' ELSE production_status END
  WHERE id = p_placement_id;
  PERFORM public.assert_community_mailer_layout(mailer_id);
  UPDATE public.community_cards
  SET layout_revision = layout_revision
        + CASE WHEN side_changed THEN 1 ELSE 0 END,
      updated_by = auth.uid(), updated_at = now()
  WHERE id = mailer_id;
END;
$$;

DROP FUNCTION IF EXISTS public.save_admin_community_mailer_layout(uuid, jsonb);
CREATE OR REPLACE FUNCTION public.save_admin_community_mailer_layout(
  p_mailer_id uuid, p_placements jsonb, p_expected_revision bigint DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  item jsonb;
  current_slot public.community_card_slots%ROWTYPE;
  current_revision bigint;
  mailer_locked boolean;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer owner or admin access required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT layout_locked, layout_revision
  INTO mailer_locked, current_revision
  FROM public.community_cards WHERE id = p_mailer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Community Mailer not found.' USING ERRCODE = 'P0002';
  END IF;
  IF mailer_locked THEN
    RAISE EXCEPTION 'Unlock the layout before changing geometry.';
  END IF;
  IF p_expected_revision IS NOT NULL
     AND p_expected_revision <> current_revision THEN
    RAISE EXCEPTION 'This layout changed in another session. Refresh before saving.'
      USING ERRCODE = '40001';
  END IF;
  IF p_placements IS NULL OR jsonb_typeof(p_placements) <> 'array' OR (
    SELECT count(*) <> count(DISTINCT item->>'id')
    FROM jsonb_array_elements(p_placements) AS rows(item)
  ) THEN
    RAISE EXCEPTION 'Layout updates must contain unique placement IDs.';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_placements)
  LOOP
    SELECT * INTO current_slot
    FROM public.community_card_slots
    WHERE id = (item->>'id')::uuid AND community_card_id = p_mailer_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Placement belongs to another mailer or no longer exists.';
    END IF;
    IF current_slot.is_locked AND (
      current_slot.side IS DISTINCT FROM item->>'side'
      OR current_slot.x IS DISTINCT FROM (item->>'x')::numeric
      OR current_slot.y IS DISTINCT FROM (item->>'y')::numeric
      OR current_slot.width IS DISTINCT FROM (item->>'width')::numeric
      OR current_slot.height IS DISTINCT FROM (item->>'height')::numeric
      OR current_slot.z_index IS DISTINCT FROM (item->>'z_index')::integer
    ) THEN
      RAISE EXCEPTION 'Unlock the placement before changing its geometry.';
    END IF;
    IF NOT current_slot.is_locked THEN
      UPDATE public.community_card_slots SET
        side = item->>'side', x = (item->>'x')::numeric,
        y = (item->>'y')::numeric, width = (item->>'width')::numeric,
        height = (item->>'height')::numeric,
        z_index = COALESCE((item->>'z_index')::integer, z_index)
      WHERE id = current_slot.id;
    END IF;
  END LOOP;
  PERFORM public.assert_community_mailer_layout(p_mailer_id);
  UPDATE public.community_cards
  SET layout_revision = layout_revision + 1,
      updated_by = auth.uid(), updated_at = now()
  WHERE id = p_mailer_id
  RETURNING layout_revision INTO current_revision;
  RETURN current_revision;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_admin_community_placement(
  p_mailer_id uuid, p_placement jsonb
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE placement_id uuid; placement_type_value text;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer owner or admin access required.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.community_cards
    WHERE id = p_mailer_id AND layout_locked IS FALSE FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'Mailer is missing or its layout is locked.';
  END IF;
  placement_type_value := COALESCE(p_placement->>'placement_type', 'standard');
  IF placement_type_value NOT IN (
    'standard','mini','wide','tall','large','featured','ribbon'
  ) THEN
    RAISE EXCEPTION 'Unsupported sellable placement type.';
  END IF;
  IF placement_type_value = 'featured' AND p_placement->>'side' <> 'front' THEN
    RAISE EXCEPTION 'The featured sponsor placement must be on the front.';
  END IF;
  INSERT INTO public.community_card_slots (
    community_card_id, slot_key, label, side, x, y, width, height,
    price_cents, status, placement_type, placement_tier, z_index,
    is_featured, is_locked
  ) VALUES (
    p_mailer_id,
    COALESCE(NULLIF(p_placement->>'slot_key', ''),
      'custom-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    COALESCE(NULLIF(btrim(p_placement->>'label'), ''), 'New placement'),
    p_placement->>'side',
    (p_placement->>'x')::numeric, (p_placement->>'y')::numeric,
    (p_placement->>'width')::numeric, (p_placement->>'height')::numeric,
    COALESCE((p_placement->>'price_cents')::integer, 25000),
    'available', placement_type_value,
    COALESCE(p_placement->>'placement_tier', 'standard'),
    COALESCE((p_placement->>'z_index')::integer, 1),
    COALESCE((p_placement->>'is_featured')::boolean,
      placement_type_value = 'featured'),
    false
  ) RETURNING id INTO placement_id;
  PERFORM public.assert_community_mailer_layout(p_mailer_id);
  UPDATE public.community_cards
  SET layout_revision = layout_revision + 1,
      updated_by = auth.uid(), updated_at = now()
  WHERE id = p_mailer_id;
  RETURN placement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_admin_community_placement(
  p_placement_id uuid
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE mailer_id uuid;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer owner or admin access required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT community_card_id INTO mailer_id
  FROM public.community_card_slots
  WHERE id = p_placement_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement not found.' USING ERRCODE = 'P0002';
  END IF;
  PERFORM 1 FROM public.community_cards
  WHERE id = mailer_id AND layout_locked IS FALSE
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unlock the layout before deleting a placement.';
  END IF;
  PERFORM 1
  FROM public.community_card_slots AS slot
  WHERE slot.id = p_placement_id
    AND slot.community_card_id = mailer_id
    AND slot.status = 'available'
    AND slot.business_id IS NULL
    AND slot.buyer_user_id IS NULL
    AND slot.is_locked IS FALSE
    AND slot.placement_type NOT IN ('brand', 'adpadz')
    AND NOT EXISTS (
      SELECT 1 FROM public.community_card_orders AS card_order
      WHERE p_placement_id = ANY(card_order.slot_ids)
    )
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only unlocked, unused placements without order history can be deleted.';
  END IF;
  DELETE FROM public.community_card_slots WHERE id = p_placement_id;
  UPDATE public.community_cards
  SET layout_revision = layout_revision + 1,
      updated_by = auth.uid(), updated_at = now()
  WHERE id = mailer_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_community_card_spaces(
  p_card_id uuid, p_slot_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  order_id uuid;
  selected_count integer := cardinality(p_slot_ids);
  matched_count integer;
  total_cents integer;
  user_id uuid := auth.uid();
  owned_business_id uuid;
  owned_business_count integer;
BEGIN
  IF user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before reserving an ad space.';
  END IF;
  IF selected_count NOT IN (1, 2)
     OR cardinality(ARRAY(SELECT DISTINCT unnest(p_slot_ids)))
        <> selected_count THEN
    RAISE EXCEPTION 'Choose one or two unique ad spaces.';
  END IF;
  PERFORM 1 FROM public.community_cards
    WHERE id = p_card_id AND is_published IS TRUE AND sales_open IS TRUE
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This mailing zone is not currently open for sales.';
  END IF;
  PERFORM 1 FROM public.community_card_slots
  WHERE id = ANY(p_slot_ids) AND community_card_id = p_card_id
  FOR UPDATE;
  SELECT count(*), sum(price_cents - discount_cents)
  INTO matched_count, total_cents
  FROM public.community_card_slots
  WHERE id = ANY(p_slot_ids)
    AND community_card_id = p_card_id
    AND status = 'available'
    AND price_cents - discount_cents > 0
    AND placement_type NOT IN ('brand', 'adpadz');
  IF matched_count <> selected_count OR total_cents IS NULL OR total_cents <= 0 THEN
    RAISE EXCEPTION 'One or more selected spaces just filled or cannot be booked.';
  END IF;
  SELECT count(*), (array_agg(id ORDER BY id))[1]
  INTO owned_business_count, owned_business_id
  FROM public.businesses
  WHERE owner_user_id = user_id AND active IS TRUE;
  INSERT INTO public.community_card_orders (
    community_card_id, buyer_user_id, slot_ids, quantity, amount_cents, status
  ) VALUES (
    p_card_id, user_id, p_slot_ids, selected_count, total_cents,
    'pending_payment'
  ) RETURNING id INTO order_id;
  UPDATE public.community_card_slots
  SET status = 'reserved', buyer_user_id = user_id,
      business_id = CASE WHEN owned_business_count = 1
        THEN owned_business_id ELSE business_id END
  WHERE id = ANY(p_slot_ids) AND community_card_id = p_card_id;
  PERFORM public.assert_community_mailer_layout(p_card_id);
  RETURN order_id;
END;
$$;

DROP FUNCTION IF EXISTS public.get_business_community_campaigns();
CREATE OR REPLACE FUNCTION public.get_business_community_campaigns()
RETURNS TABLE (
  id uuid, title text, zone_name text, public_slug text, mailing_date date,
  household_count integer, format text, layout_key text, status text,
  sales_open boolean, is_published boolean,
  consumer_headline text, discovery_qr_destination_url text,
  available_placements bigint, layout_placements jsonb, own_placements jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT card.id, card.title, card.zone_name, card.public_slug,
         card.mailing_date, card.household_count, card.format, card.layout_key,
         card.status, card.sales_open, card.is_published,
         card.consumer_headline, discovery_qr.destination_url,
         count(slot.id) FILTER (
           WHERE slot.status = 'available' AND card.sales_open IS TRUE
         ),
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', slot.id,
           'community_card_id', slot.community_card_id,
           'slot_key', slot.slot_key,
           'label', slot.label,
           'side', slot.side,
           'x', slot.x, 'y', slot.y,
           'width', slot.width, 'height', slot.height,
           'price_cents', CASE
             WHEN slot.status = 'available' AND card.sales_open
             THEN slot.price_cents - slot.discount_cents ELSE 0 END,
           'status', CASE
              WHEN own_business.id IS NOT NULL OR (
                slot.buyer_user_id = auth.uid() AND slot.business_id IS NULL
              )
               THEN slot.status
             WHEN slot.status = 'available' AND card.sales_open THEN 'available'
             WHEN slot.status = 'unavailable' OR NOT card.sales_open THEN 'unavailable'
             ELSE 'occupied' END,
           'placement_type', slot.placement_type,
           'placement_tier', slot.placement_tier,
           'z_index', slot.z_index,
           'is_featured', slot.is_featured,
           'is_locked', true,
           'discount_cents', 0,
           'category_exclusive', false,
           'business_id', own_business.id,
           'advertiser_name', CASE
              WHEN own_business.id IS NOT NULL OR (
                slot.buyer_user_id = auth.uid() AND slot.business_id IS NULL
              )
             THEN COALESCE(own_business.name, slot.advertiser_name)
             ELSE NULL END,
           'ad_image_url', CASE
              WHEN own_business.id IS NOT NULL OR (
                slot.buyer_user_id = auth.uid() AND slot.business_id IS NULL
              )
             THEN COALESCE(asset.file_url, asset.thumbnail_url,
               asset.external_url, slot.ad_image_url)
             ELSE NULL END
         ) ORDER BY slot.side, slot.z_index, slot.slot_key)
         FILTER (
           WHERE slot.id IS NOT NULL
             AND slot.placement_type NOT IN ('brand', 'adpadz')
         ), '[]'::jsonb),
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', slot.id,
           'label', slot.label,
           'status', slot.status,
           'artwork_url', COALESCE(asset.file_url, asset.thumbnail_url,
             asset.external_url, slot.ad_image_url),
           'offer', slot.offer_text,
           'proof_status', slot.proof_status,
           'payment_status', slot.payment_status,
           'production_status', slot.production_status,
           'qr_destination_url', placement_qr.destination_url
         ) ORDER BY slot.side, slot.z_index, slot.slot_key)
         FILTER (
            WHERE own_business.id IS NOT NULL OR (
              slot.buyer_user_id = auth.uid() AND slot.business_id IS NULL
            )
         ), '[]'::jsonb)
  FROM public.community_cards AS card
  LEFT JOIN public.qr_links AS discovery_qr
    ON discovery_qr.id = card.discovery_qr_link_id
    AND discovery_qr.status = 'active'
    AND (discovery_qr.expires_at IS NULL OR discovery_qr.expires_at > now())
  LEFT JOIN public.community_card_slots AS slot
    ON slot.community_card_id = card.id
    AND slot.placement_type NOT IN ('brand', 'adpadz')
  LEFT JOIN public.businesses AS own_business
    ON own_business.id = slot.business_id
    AND own_business.owner_user_id = auth.uid()
    AND own_business.active IS TRUE
  LEFT JOIN public.business_marketing_assets AS asset
    ON asset.id = slot.creative_asset_id
    AND asset.business_id = slot.business_id
    AND asset.is_active IS TRUE
    AND (
      own_business.id IS NOT NULL OR (
        slot.buyer_user_id = auth.uid() AND slot.business_id IS NULL
      )
    )
  LEFT JOIN public.qr_links AS placement_qr
    ON placement_qr.id = slot.qr_link_id
    AND placement_qr.business_id = slot.business_id
    AND placement_qr.status = 'active'
    AND (placement_qr.expires_at IS NULL OR placement_qr.expires_at > now())
    AND (
      own_business.id IS NOT NULL OR (
        slot.buyer_user_id = auth.uid() AND slot.business_id IS NULL
      )
    )
  WHERE auth.uid() IS NOT NULL
    AND card.is_published IS TRUE
    AND (
      card.sales_open IS TRUE
      OR EXISTS (
        SELECT 1
        FROM public.community_card_slots AS owned_slot
        LEFT JOIN public.businesses AS caller_business
          ON caller_business.id = owned_slot.business_id
        WHERE owned_slot.community_card_id = card.id
          AND (
            (
              owned_slot.buyer_user_id = auth.uid()
              AND owned_slot.business_id IS NULL
            )
            OR caller_business.owner_user_id = auth.uid()
          )
      )
    )
  GROUP BY card.id, discovery_qr.destination_url
  ORDER BY card.mailing_date NULLS LAST, card.title;
$$;

CREATE OR REPLACE FUNCTION public.get_public_community_mailer(p_public_slug text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'mailer', jsonb_build_object(
      'id', card.id,
      'title', card.title,
      'zone_name', card.zone_name,
      'public_slug', card.public_slug,
      'format', card.format,
      'layout_key', card.layout_key,
      'consumer_headline', card.consumer_headline,
      'discovery_qr_destination_url', discovery_qr.destination_url,
      'mailing_date', card.mailing_date,
      'household_count', card.household_count,
      'status', card.status,
      'sales_open', card.sales_open,
      'is_published', card.is_published
    ),
    'placements', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', slot.id,
        'community_card_id', slot.community_card_id,
        'slot_key', slot.slot_key,
        'label', slot.label,
        'side', slot.side,
        'x', slot.x, 'y', slot.y,
        'width', slot.width, 'height', slot.height,
        'price_cents', CASE
          WHEN card.sales_open AND slot.status = 'available'
          THEN slot.price_cents - slot.discount_cents ELSE 0 END,
        'status', CASE
          WHEN card.sales_open AND slot.status = 'available' THEN 'available'
          WHEN slot.status = 'unavailable' OR NOT card.sales_open THEN 'unavailable'
          ELSE 'occupied' END,
        'placement_type', slot.placement_type,
        'placement_tier', slot.placement_tier,
        'z_index', slot.z_index,
        'is_featured', slot.is_featured,
        'is_locked', true,
        'discount_cents', 0,
        'category_exclusive', false,
        'advertiser_name', CASE
          WHEN slot.public_creative_visible AND slot.status <> 'available'
          THEN COALESCE(business.name, slot.advertiser_name) ELSE NULL END,
        'ad_image_url', CASE
          WHEN slot.public_creative_visible AND slot.status <> 'available'
          THEN COALESCE(asset.file_url, asset.thumbnail_url,
            asset.external_url, slot.ad_image_url)
          ELSE NULL END
      ) ORDER BY slot.side, slot.z_index, slot.slot_key)
      FROM public.community_card_slots AS slot
      LEFT JOIN public.businesses AS business
        ON business.id = slot.business_id AND business.active IS TRUE
      LEFT JOIN public.business_marketing_assets AS asset
        ON asset.id = slot.creative_asset_id
        AND asset.business_id = slot.business_id
        AND asset.is_active IS TRUE
      WHERE slot.community_card_id = card.id
        AND slot.placement_type NOT IN ('brand', 'adpadz')
    ), '[]'::jsonb)
  )
  FROM public.community_cards AS card
  LEFT JOIN public.qr_links AS discovery_qr
    ON discovery_qr.id = card.discovery_qr_link_id
    AND discovery_qr.status = 'active'
    AND (discovery_qr.expires_at IS NULL OR discovery_qr.expires_at > now())
  WHERE card.public_slug = p_public_slug
    AND card.is_published IS TRUE;
$$;

REVOKE ALL ON FUNCTION public.get_admin_community_mailers()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_admin_community_mailer(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_admin_community_mailer(
  text,text,text,text,integer,date,jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_admin_community_mailer(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_admin_community_placement(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_admin_community_mailer_layout(
  uuid,jsonb,bigint
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_admin_community_placement(uuid,jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_admin_community_placement(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_business_community_campaigns()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_community_mailer(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_community_card_spaces(uuid,uuid[])
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_admin_community_mailers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_community_mailer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_community_mailer(
  text,text,text,text,integer,date,jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_community_mailer(uuid,jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_community_placement(uuid,jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_admin_community_mailer_layout(
  uuid,jsonb,bigint
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_admin_community_placement(uuid,jsonb)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_admin_community_placement(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_community_campaigns()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_community_mailer(text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_community_card_spaces(uuid,uuid[])
  TO authenticated;

COMMENT ON COLUMN public.community_card_slots.public_creative_visible IS
  'Explicit opt-in for advertiser identity and artwork in the public projection.';
COMMENT ON FUNCTION public.save_admin_community_mailer_layout(uuid,jsonb,bigint) IS
  'Atomically saves canonical normalized placement geometry with revision checks.';

NOTIFY pgrst, 'reload schema';

DO $$
DECLARE constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.community_card_slots'::regclass
      AND contype = 'c'
      AND (
        position('price_cents' in pg_get_constraintdef(oid)) > 0
        OR position('(status = ANY' in pg_get_constraintdef(oid)) > 0
      )
  LOOP
    EXECUTE format('ALTER TABLE public.community_card_slots DROP CONSTRAINT %I',
      constraint_row.conname);
  END LOOP;
  FOR constraint_row IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.community_card_orders'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.community_card_orders DROP CONSTRAINT %I',
      constraint_row.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.community_card_slots
  DROP CONSTRAINT IF EXISTS community_card_slots_status_check,
  DROP CONSTRAINT IF EXISTS community_card_slots_price_cents_check,
  DROP CONSTRAINT IF EXISTS community_card_slots_placement_type_check,
  DROP CONSTRAINT IF EXISTS community_card_slots_placement_tier_check,
  DROP CONSTRAINT IF EXISTS community_card_slots_z_index_check,
  DROP CONSTRAINT IF EXISTS community_card_slots_discount_check,
  DROP CONSTRAINT IF EXISTS community_card_slots_production_status_check,
  DROP CONSTRAINT IF EXISTS community_card_slots_geometry_bounds_check;

ALTER TABLE public.community_card_slots
  ADD CONSTRAINT community_card_slots_placement_type_check
    CHECK (placement_type IN ('standard','mini','wide','tall','large','featured','ribbon','brand','adpadz')) NOT VALID,
  ADD CONSTRAINT community_card_slots_placement_tier_check
    CHECK (placement_tier IN ('standard','premium','featured','system')) NOT VALID,
  ADD CONSTRAINT community_card_slots_z_index_check CHECK (z_index >= 0) NOT VALID,
  ADD CONSTRAINT community_card_slots_price_cents_check CHECK (price_cents >= 0) NOT VALID,
  ADD CONSTRAINT community_card_slots_discount_check
    CHECK (discount_cents >= 0 AND discount_cents <= price_cents) NOT VALID,
  ADD CONSTRAINT community_card_slots_production_status_check
    CHECK (production_status IN ('not_started','creative_needed','in_design','proofing','approved','print_ready','printed','mailed')) NOT VALID,
  ADD CONSTRAINT community_card_slots_status_check
    CHECK (status IN ('available','reserved','sold','proof','approved','unavailable','intake')) NOT VALID,
  ADD CONSTRAINT community_card_slots_geometry_bounds_check
    CHECK (x >= 0 AND y >= 0 AND width > 0 AND height > 0
      AND x + width <= 100 AND y + height <= 100) NOT VALID;

ALTER TABLE public.community_card_orders
  ADD CONSTRAINT community_card_orders_quantity_check CHECK (quantity IN (1, 2)),
  ADD CONSTRAINT community_card_orders_slot_count_check
    CHECK (cardinality(slot_ids) = quantity),
  ADD CONSTRAINT community_card_orders_amount_check CHECK (amount_cents >= 0),
  ADD CONSTRAINT community_card_orders_status_check
    CHECK (status IN (
      'draft','pending_payment','paid','cancelled','expired',
      'proof_pending','approved'
    ));

DROP POLICY IF EXISTS "card owner manages cards" ON public.community_cards;
DROP POLICY IF EXISTS "card owner manages slots" ON public.community_card_slots;
DROP POLICY IF EXISTS "community_cards_owner_all" ON public.community_cards;
DROP POLICY IF EXISTS "community_card_slots_owner_all" ON public.community_card_slots;
DROP POLICY IF EXISTS "published cards are visible" ON public.community_cards;
DROP POLICY IF EXISTS "published card slots are visible" ON public.community_card_slots;
DROP POLICY IF EXISTS "buyers start orders" ON public.community_card_orders;
DROP POLICY IF EXISTS "buyers see their orders" ON public.community_card_orders;
CREATE POLICY "buyers see their orders"
  ON public.community_card_orders
  FOR SELECT
  TO authenticated
  USING (buyer_user_id = auth.uid());
REVOKE ALL ON TABLE public.community_cards, public.community_card_slots,
  public.community_card_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.community_card_orders TO authenticated;

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
          AND slot.y < 53.5 AND slot.y + slot.height > 46.5
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

REVOKE ALL ON FUNCTION public.assert_community_mailer_layout(uuid)
  FROM PUBLIC, anon, authenticated;
