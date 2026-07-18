-- Move Community Mailer operations behind Mission Control authorization while
-- preserving the existing community_cards, slots, orders, and public URLs.

ALTER TABLE public.community_card_slots
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creative_asset_id uuid REFERENCES public.business_marketing_assets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS qr_link_id uuid REFERENCES public.qr_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_text text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS proof_status text NOT NULL DEFAULT 'not_started';

ALTER TABLE public.community_card_slots
  DROP CONSTRAINT IF EXISTS community_card_slots_payment_status_check,
  DROP CONSTRAINT IF EXISTS community_card_slots_proof_status_check;
ALTER TABLE public.community_card_slots
  ADD CONSTRAINT community_card_slots_payment_status_check
    CHECK (payment_status IN ('not_started', 'pending', 'paid', 'waived', 'refunded')),
  ADD CONSTRAINT community_card_slots_proof_status_check
    CHECK (proof_status IN ('not_started', 'pending', 'changes_requested', 'approved'));

UPDATE public.community_card_slots AS slot
SET business_id = business.id
FROM public.businesses AS business
WHERE slot.business_id IS NULL
  AND NULLIF(btrim(slot.advertiser_name), '') IS NOT NULL
  AND lower(btrim(business.name)) = lower(btrim(slot.advertiser_name))
  AND (
    SELECT count(*)
    FROM public.businesses AS matching_business
    WHERE lower(btrim(matching_business.name)) = lower(btrim(slot.advertiser_name))
  ) = 1;

CREATE INDEX IF NOT EXISTS community_card_slots_business_idx
  ON public.community_card_slots(business_id, community_card_id);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.community_cards FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.community_card_slots FROM authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_community_mailers(
  check_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    check_user_id IS NOT NULL
    AND check_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.admin_users AS admin_user
      WHERE admin_user.user_id = check_user_id
        AND admin_user.active IS TRUE
        AND admin_user.role IN ('owner', 'admin')
    );
$$;

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
         count(slot.id) FILTER (WHERE slot.ad_image_url IS NOT NULL OR slot.creative_asset_id IS NOT NULL),
         count(slot.id) FILTER (WHERE slot.payment_status IN ('paid', 'waived')),
         count(slot.id) FILTER (WHERE slot.proof_status = 'approved'),
         COALESCE(sum(slot.price_cents) FILTER (WHERE slot.status <> 'available'), 0),
         count(slot.id) FILTER (
           WHERE slot.status <> 'available' AND (
             slot.business_id IS NULL OR
             (slot.ad_image_url IS NULL AND slot.creative_asset_id IS NULL) OR
             slot.payment_status NOT IN ('paid', 'waived') OR
             slot.proof_status <> 'approved'
           )
         ) + CASE WHEN card.mailing_date IS NULL THEN 1 ELSE 0 END
  FROM public.community_cards AS card
  LEFT JOIN public.community_card_slots AS slot ON slot.community_card_id = card.id
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
    'mailer', to_jsonb(card),
    'placements', COALESCE((
      SELECT jsonb_agg(to_jsonb(slot) || jsonb_build_object(
        'business_name', business.name,
        'creative_asset_title', asset.title,
        'creative_asset_url', COALESCE(asset.file_url, asset.thumbnail_url, asset.external_url)
      ) ORDER BY slot.side, slot.slot_key)
      FROM public.community_card_slots AS slot
      LEFT JOIN public.businesses AS business ON business.id = slot.business_id
      LEFT JOIN public.business_marketing_assets AS asset ON asset.id = slot.creative_asset_id
      WHERE slot.community_card_id = card.id
    ), '[]'::jsonb),
    'businesses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', business.id, 'name', business.name) ORDER BY business.name)
      FROM public.businesses AS business WHERE business.active IS TRUE
    ), '[]'::jsonb),
    'assets', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', asset.id, 'business_id', asset.business_id, 'title', asset.title,
        'url', COALESCE(asset.file_url, asset.thumbnail_url, asset.external_url)
      ) ORDER BY asset.updated_at DESC)
      FROM public.business_marketing_assets AS asset WHERE asset.is_active IS TRUE
    ), '[]'::jsonb)
  ) INTO result
  FROM public.community_cards AS card WHERE card.id = p_mailer_id;
  IF result IS NULL THEN RAISE EXCEPTION 'Community Mailer not found.' USING ERRCODE = 'P0002'; END IF;
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
    RAISE EXCEPTION 'Adpadz administrator access required.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(p_title), '') IS NULL OR NULLIF(btrim(p_zone_name), '') IS NULL THEN
    RAISE EXCEPTION 'Campaign name and mailing zone are required.';
  END IF;
  INSERT INTO public.community_cards (
    owner_id, title, zone_name, format, layout_key, household_count, mailing_date
  ) VALUES (
    auth.uid(), btrim(p_title), btrim(p_zone_name), p_format, p_layout_key,
    p_household_count, p_mailing_date
  ) RETURNING id INTO mailer_id;
  FOR slot IN SELECT value FROM jsonb_array_elements(COALESCE(p_slots, '[]'::jsonb))
  LOOP
    INSERT INTO public.community_card_slots (
      community_card_id, slot_key, label, side, x, y, width, height,
      price_cents, status, is_featured
    ) VALUES (
      mailer_id, slot->>'slot_key', slot->>'label', slot->>'side',
      (slot->>'x')::numeric, (slot->>'y')::numeric,
      (slot->>'width')::numeric, (slot->>'height')::numeric,
      COALESCE((slot->>'price_cents')::integer, 25000), 'available',
      COALESCE((slot->>'is_featured')::boolean, false)
    );
  END LOOP;
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
    RAISE EXCEPTION 'Adpadz administrator access required.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.community_cards SET
    title = CASE WHEN p_changes ? 'title' THEN NULLIF(btrim(p_changes->>'title'), '') ELSE title END,
    zone_name = CASE WHEN p_changes ? 'zone_name' THEN NULLIF(btrim(p_changes->>'zone_name'), '') ELSE zone_name END,
    mailing_date = CASE WHEN p_changes ? 'mailing_date' THEN NULLIF(p_changes->>'mailing_date', '')::date ELSE mailing_date END,
    household_count = CASE WHEN p_changes ? 'household_count' THEN (p_changes->>'household_count')::integer ELSE household_count END,
    status = CASE WHEN p_changes ? 'status' THEN p_changes->>'status' ELSE status END,
    sales_open = CASE WHEN p_changes ? 'sales_open' THEN (p_changes->>'sales_open')::boolean ELSE sales_open END,
    is_published = CASE WHEN p_changes ? 'is_published' THEN (p_changes->>'is_published')::boolean ELSE is_published END
  WHERE id = p_mailer_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Community Mailer not found.' USING ERRCODE = 'P0002'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_admin_community_placement(
  p_placement_id uuid, p_changes jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Adpadz administrator access required.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.community_card_slots AS slot SET
    status = CASE WHEN p_changes ? 'status' THEN p_changes->>'status' ELSE status END,
    business_id = CASE WHEN p_changes ? 'business_id' THEN NULLIF(p_changes->>'business_id', '')::uuid ELSE business_id END,
    advertiser_name = CASE WHEN p_changes ? 'advertiser_name' THEN NULLIF(btrim(p_changes->>'advertiser_name'), '') ELSE advertiser_name END,
    creative_asset_id = CASE WHEN p_changes ? 'creative_asset_id' THEN NULLIF(p_changes->>'creative_asset_id', '')::uuid ELSE creative_asset_id END,
    offer_text = CASE WHEN p_changes ? 'offer_text' THEN NULLIF(btrim(p_changes->>'offer_text'), '') ELSE offer_text END,
    category = CASE WHEN p_changes ? 'category' THEN NULLIF(btrim(p_changes->>'category'), '') ELSE category END,
    internal_notes = CASE WHEN p_changes ? 'internal_notes' THEN NULLIF(btrim(p_changes->>'internal_notes'), '') ELSE internal_notes END,
    is_featured = CASE WHEN p_changes ? 'is_featured' THEN (p_changes->>'is_featured')::boolean ELSE is_featured END,
    payment_status = CASE WHEN p_changes ? 'payment_status' THEN p_changes->>'payment_status' ELSE payment_status END,
    proof_status = CASE WHEN p_changes ? 'proof_status' THEN p_changes->>'proof_status' ELSE proof_status END
  WHERE slot.id = p_placement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Placement not found.' USING ERRCODE = 'P0002'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_business_community_campaigns()
RETURNS TABLE (
  id uuid, title text, zone_name text, public_slug text, mailing_date date,
  household_count integer, format text, available_placements bigint,
  own_placements jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT card.id, card.title, card.zone_name, card.public_slug,
         card.mailing_date, card.household_count, card.format,
         count(slot.id) FILTER (WHERE slot.status = 'available'),
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', slot.id, 'label', slot.label, 'status', slot.status,
           'artwork_url', COALESCE(asset.file_url, asset.thumbnail_url, asset.external_url, slot.ad_image_url),
           'offer', slot.offer_text, 'proof_status', slot.proof_status,
           'payment_status', slot.payment_status
         )) FILTER (WHERE own_business.id IS NOT NULL), '[]'::jsonb)
  FROM public.community_cards AS card
  LEFT JOIN public.community_card_slots AS slot ON slot.community_card_id = card.id
  LEFT JOIN public.businesses AS own_business
    ON own_business.id = slot.business_id AND own_business.owner_user_id = auth.uid()
  LEFT JOIN public.business_marketing_assets AS asset
    ON asset.id = slot.creative_asset_id AND asset.owner_id = auth.uid()
  WHERE auth.uid() IS NOT NULL AND card.is_published IS TRUE AND card.sales_open IS TRUE
  GROUP BY card.id ORDER BY card.mailing_date NULLS LAST, card.title;
$$;

CREATE OR REPLACE FUNCTION public.get_public_community_mailer(p_public_slug text)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'mailer', jsonb_build_object(
      'id', card.id, 'title', card.title, 'zone_name', card.zone_name,
      'public_slug', card.public_slug, 'format', card.format,
      'layout_key', card.layout_key, 'mailing_date', card.mailing_date,
      'household_count', card.household_count, 'status', card.status,
      'sales_open', card.sales_open, 'is_published', card.is_published,
      'created_at', card.created_at, 'updated_at', card.updated_at
    ),
    'placements', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', slot.id, 'community_card_id', slot.community_card_id,
        'slot_key', slot.slot_key, 'label', slot.label, 'side', slot.side,
        'x', slot.x, 'y', slot.y, 'width', slot.width, 'height', slot.height,
        'price_cents', CASE WHEN card.sales_open AND slot.status = 'available'
          THEN slot.price_cents ELSE 0 END,
        'status', CASE
          WHEN card.sales_open AND slot.status = 'available' THEN 'available'
          ELSE 'occupied' END,
        'advertiser_name', NULL,
        'ad_image_url', NULL
      ) ORDER BY slot.side, slot.slot_key)
      FROM public.community_card_slots AS slot
      WHERE slot.community_card_id = card.id
    ), '[]'::jsonb)
  )
  FROM public.community_cards AS card
  WHERE card.public_slug = p_public_slug
    AND card.is_published IS TRUE;
$$;

REVOKE SELECT ON TABLE public.community_cards, public.community_card_slots
  FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.get_admin_community_mailers() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_admin_community_mailer(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_admin_community_mailer(text,text,text,text,integer,date,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_admin_community_mailer(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_admin_community_placement(uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_business_community_campaigns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_community_mailer(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_manage_community_mailers(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_community_mailers() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_community_mailer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_community_mailer(text,text,text,text,integer,date,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_community_mailer(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_admin_community_placement(uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_business_community_campaigns() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_community_mailer(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_community_mailers(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
