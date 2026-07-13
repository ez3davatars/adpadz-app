-- Close direct public QR destination reads and keep public attribution checks
-- working through a narrow boolean helper. Also enforce final Smart Card / Hub
-- coherence after atomic placement reconciliation, and make booking metadata
-- canonical when it crosses the public lead-ingestion boundary.

CREATE OR REPLACE FUNCTION public.adpadz_qr_link_is_active_destination(
  p_qr_link_id uuid,
  p_destination_type text,
  p_destination_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.qr_links AS qr
    WHERE qr.id = p_qr_link_id
      AND qr.status = 'active'
      AND (qr.expires_at IS NULL OR qr.expires_at > now())
      AND qr.destination_type = p_destination_type
      AND qr.destination_id = p_destination_id
      AND (
        (
          p_destination_type = 'business_card'
          AND EXISTS (
            SELECT 1
            FROM public.business_cards AS card
            WHERE card.id = p_destination_id
              AND card.owner_user_id = qr.owner_user_id
              AND card.business_id IS NOT DISTINCT FROM qr.business_id
          )
        )
        OR (
          p_destination_type = 'campaign'
          AND EXISTS (
            SELECT 1
            FROM public.campaigns AS campaign
            WHERE campaign.id = p_destination_id
              AND campaign.owner_id = qr.owner_user_id
              AND campaign.business_id IS NOT DISTINCT FROM qr.business_id
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.adpadz_qr_link_is_active_destination(uuid, text, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adpadz_qr_link_is_active_destination(uuid, text, uuid)
  TO anon, authenticated;

-- Policies execute as the requesting API role. Route their QR coherence checks
-- through the helper before revoking anon's raw table access.
DROP POLICY IF EXISTS campaign_events_public_insert ON public.campaign_events;
CREATE POLICY campaign_events_public_insert ON public.campaign_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    campaign_id IS NOT NULL
    AND occurred_at BETWEEN now() - interval '1 minute' AND now() + interval '1 minute'
    AND (
      (
        output_type = 'interactive_ad'
        AND event_type IN ('view', 'reveal', 'cta_click', 'share', 'save', 'offer_claim')
      )
      OR (
        output_type = 'qr_landing'
        AND event_type = 'view'
        AND metadata ->> 'source' = 'qr_redirect'
        AND metadata ->> 'action' = 'qr_scan'
        AND public.adpadz_qr_link_is_active_destination(
          public.adpadz_jsonb_uuid(metadata, 'qr_link_id'),
          'campaign',
          campaign_id
        )
      )
    )
    AND public.adpadz_campaign_event_is_coherent(
      campaign_id,
      business_card_id,
      output_type
    )
  );

DROP POLICY IF EXISTS business_card_events_public_insert ON public.business_card_events;
CREATE POLICY business_card_events_public_insert ON public.business_card_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    business_card_id IS NOT NULL
    AND occurred_at BETWEEN now() - interval '1 minute' AND now() + interval '1 minute'
    AND EXISTS (
      SELECT 1
      FROM public.business_cards AS card
      WHERE card.id = business_card_events.business_card_id
        AND card.is_published IS TRUE
        AND (
          card.business_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.businesses AS business
            WHERE business.id = card.business_id
              AND business.owner_user_id = card.owner_user_id
              AND business.active IS TRUE
          )
        )
        AND (event_type <> 'lead_submit' OR card.lead_form_enabled IS TRUE)
        AND (
          event_type <> 'booking_request_submit'
          OR (card.booking_mode = 'request' AND card.booking_request_enabled IS TRUE)
        )
        AND (event_type <> 'booking_click' OR card.booking_enabled IS TRUE)
    )
    AND (
      (
        event_type IN ('offer_view', 'offer_claim')
        AND offer_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.business_card_offers AS offer
          WHERE offer.id = business_card_events.offer_id
            AND offer.business_card_id = business_card_events.business_card_id
            AND offer.is_active IS TRUE
            AND (offer.starts_at IS NULL OR offer.starts_at <= now())
            AND (offer.ends_at IS NULL OR offer.ends_at >= now())
        )
        AND (
          event_type <> 'offer_claim'
          OR metadata ->> 'redemption_code' ~ '^ADP-[A-F0-9]{4}-[A-F0-9]{6}$'
        )
      )
      OR (event_type NOT IN ('offer_view', 'offer_claim') AND offer_id IS NULL)
    )
    AND (
      (qr_link_id IS NULL AND event_type <> 'qr_scan')
      OR (
        qr_link_id IS NOT NULL
        AND public.adpadz_qr_link_is_active_destination(
          qr_link_id,
          'business_card',
          business_card_id
        )
      )
    )
    AND (
      event_type <> 'interactive_ad_click'
      OR (
        public.adpadz_jsonb_uuid(metadata, 'campaign_id') IS NOT NULL
        AND public.adpadz_campaign_event_is_coherent(
          public.adpadz_jsonb_uuid(metadata, 'campaign_id'),
          business_card_id,
          'interactive_ad'
        )
      )
    )
  );

-- Remove every SELECT policy on qr_links, including renamed legacy policies.
-- The sole authenticated owner policy is recreated explicitly below.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'qr_links'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.qr_links', policy_row.policyname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS qr_links_owner_select ON public.qr_links;
CREATE POLICY qr_links_owner_select ON public.qr_links
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

REVOKE SELECT ON TABLE public.qr_links FROM PUBLIC;
REVOKE SELECT ON TABLE public.qr_links FROM anon;
GRANT SELECT ON TABLE public.qr_links TO authenticated;

-- resolve_qr_redirect remains the only public destination lookup surface.
GRANT EXECUTE ON FUNCTION public.resolve_qr_redirect(text, text, text)
  TO anon, authenticated;

-- Serialize parent Hub/owner moves with mutations of the two child collections
-- whose tenant identity depends on the card. The a-prefixed child trigger names
-- make these locks run before the existing ownership/canonicalization triggers,
-- so a waiter validates against the committed post-move card state.
CREATE OR REPLACE FUNCTION public.adpadz_lock_card_child_coherence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  old_card_id uuid;
  new_card_id uuid;
  lock_card_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'business_cards' THEN
    new_card_id := NEW.id;
  ELSIF TG_TABLE_NAME = 'business_card_booking_services' THEN
    IF TG_OP <> 'INSERT' THEN
      old_card_id := OLD.card_id;
    END IF;
    IF TG_OP <> 'DELETE' THEN
      new_card_id := NEW.card_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'business_marketing_assets' THEN
    IF TG_OP <> 'INSERT' THEN
      old_card_id := OLD.smart_card_id;
    END IF;
    IF TG_OP <> 'DELETE' THEN
      new_card_id := NEW.smart_card_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported card-child coherence trigger table: %', TG_TABLE_NAME
      USING ERRCODE = '0A000';
  END IF;

  -- Lock both sides of a child move in UUID order to avoid lock-order cycles.
  FOR lock_card_id IN
    SELECT candidate.card_id
    FROM (
      VALUES (old_card_id), (new_card_id)
    ) AS candidate(card_id)
    WHERE candidate.card_id IS NOT NULL
    GROUP BY candidate.card_id
    ORDER BY candidate.card_id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(
      'adpadz:card-child-coherence:' || lock_card_id::text,
      0
    ));
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_cards_a_lock_child_coherence
  ON public.business_cards;
CREATE TRIGGER business_cards_a_lock_child_coherence
  BEFORE UPDATE OF business_id, owner_user_id ON public.business_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.adpadz_lock_card_child_coherence();

DROP TRIGGER IF EXISTS business_card_booking_services_a_lock_card_coherence
  ON public.business_card_booking_services;
CREATE TRIGGER business_card_booking_services_a_lock_card_coherence
  BEFORE INSERT OR UPDATE OR DELETE ON public.business_card_booking_services
  FOR EACH ROW
  EXECUTE FUNCTION public.adpadz_lock_card_child_coherence();

DROP TRIGGER IF EXISTS business_marketing_assets_a_lock_card_coherence
  ON public.business_marketing_assets;
CREATE TRIGGER business_marketing_assets_a_lock_card_coherence
  BEFORE INSERT OR UPDATE OR DELETE ON public.business_marketing_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.adpadz_lock_card_child_coherence();

REVOKE ALL ON FUNCTION public.adpadz_lock_card_child_coherence()
  FROM PUBLIC;

-- Validate the final state at transaction end. This permits atomic card-child
-- reconciliation that does not trip immediate child validation. Existing
-- linked placements must be deleted/recreated when changing Hubs; unsafe
-- partial/in-place moves fail closed.
CREATE OR REPLACE FUNCTION public.adpadz_enforce_card_service_business_coherence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_owner_id uuid;
  current_business_id uuid;
BEGIN
  IF NEW.business_id IS NOT DISTINCT FROM OLD.business_id
    AND NEW.owner_user_id IS NOT DISTINCT FROM OLD.owner_user_id THEN
    RETURN NULL;
  END IF;

  SELECT card.owner_user_id, card.business_id
  INTO current_owner_id, current_business_id
  FROM public.business_cards AS card
  WHERE card.id = NEW.id;

  -- A card deleted later in the same transaction has no final state to check.
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF current_business_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.businesses AS business
      WHERE business.id = current_business_id
        AND business.owner_user_id = current_owner_id
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Smart Card Business Hub does not belong to the card owner';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.business_card_booking_services AS placement
    LEFT JOIN public.business_services AS service
      ON service.id = placement.service_id
    WHERE placement.card_id = NEW.id
      AND placement.service_id IS NOT NULL
      AND (
        service.id IS NULL
        OR current_business_id IS NULL
        OR service.business_id IS DISTINCT FROM current_business_id
        OR service.owner_id IS DISTINCT FROM current_owner_id
        OR placement.owner_id IS DISTINCT FROM current_owner_id
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Move or remove linked services before changing this Smart Card Business Hub';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.business_marketing_assets AS asset
    WHERE asset.smart_card_id = NEW.id
      AND (
        asset.owner_id IS DISTINCT FROM current_owner_id
        OR (
          asset.business_id IS NOT NULL
          AND asset.business_id IS DISTINCT FROM current_business_id
        )
      )
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Move or detach attached marketing assets before changing this Smart Card Business Hub';
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS business_cards_service_business_coherence
  ON public.business_cards;
CREATE CONSTRAINT TRIGGER business_cards_service_business_coherence
  AFTER UPDATE ON public.business_cards
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.adpadz_enforce_card_service_business_coherence();

REVOKE ALL ON FUNCTION public.adpadz_enforce_card_service_business_coherence()
  FROM PUBLIC;

-- Public clients may propose a placement id, but every derived service field
-- is server-owned. Remove those keys when no placement survives validation and
-- overwrite them from the canonical placement when one does.
CREATE OR REPLACE FUNCTION public.business_card_leads_require_active_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_placement_id uuid;
  v_business_service_id uuid;
  v_service_name text;
  v_duration_minutes integer;
  v_price numeric(12, 2);
  v_currency text;
BEGIN
  IF NOT public.adpadz_request_uses_public_api_role() THEN
    RETURN NEW;
  END IF;

  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb);

  IF NEW.lead_type IS DISTINCT FROM 'booking_request'
    OR NOT (NEW.metadata ? 'service_id') THEN
    NEW.metadata := NEW.metadata
      - 'service_id'
      - 'service_name'
      - 'business_service_id'
      - 'service_duration_minutes'
      - 'service_price'
      - 'service_currency'
      - 'service_booking_url';
    RETURN NEW;
  END IF;

  v_placement_id := public.adpadz_jsonb_uuid(NEW.metadata, 'service_id');
  SELECT
    placement.service_id,
    placement.name,
    placement.duration_minutes,
    placement.price,
    placement.currency
  INTO
    v_business_service_id,
    v_service_name,
    v_duration_minutes,
    v_price,
    v_currency
  FROM public.business_card_booking_services AS placement
  WHERE placement.id = v_placement_id
    AND placement.card_id = NEW.card_id
    AND placement.is_active IS TRUE
    AND placement.service_is_active IS TRUE;

  IF v_placement_id IS NULL OR NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'The selected booking service is unavailable';
  END IF;

  NEW.metadata := NEW.metadata - 'service_booking_url';
  NEW.metadata := jsonb_set(
    NEW.metadata,
    '{service_id}',
    to_jsonb(v_placement_id::text),
    true
  );
  NEW.metadata := jsonb_set(
    NEW.metadata,
    '{service_name}',
    to_jsonb(v_service_name),
    true
  );
  NEW.metadata := jsonb_set(
    NEW.metadata,
    '{business_service_id}',
    COALESCE(to_jsonb(v_business_service_id::text), 'null'::jsonb),
    true
  );
  NEW.metadata := jsonb_set(
    NEW.metadata,
    '{service_duration_minutes}',
    COALESCE(to_jsonb(v_duration_minutes), 'null'::jsonb),
    true
  );
  NEW.metadata := jsonb_set(
    NEW.metadata,
    '{service_price}',
    COALESCE(to_jsonb(v_price), 'null'::jsonb),
    true
  );
  NEW.metadata := jsonb_set(
    NEW.metadata,
    '{service_currency}',
    COALESCE(to_jsonb(v_currency), 'null'::jsonb),
    true
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_card_leads_z_require_active_service
  ON public.business_card_leads;
CREATE TRIGGER business_card_leads_z_require_active_service
  BEFORE INSERT ON public.business_card_leads
  FOR EACH ROW EXECUTE FUNCTION public.business_card_leads_require_active_service();

REVOKE ALL ON FUNCTION public.business_card_leads_require_active_service()
  FROM PUBLIC;

COMMENT ON FUNCTION public.adpadz_qr_link_is_active_destination(uuid, text, uuid) IS
  'Checks active coherent QR attribution without exposing destination rows or URLs.';
COMMENT ON FUNCTION public.adpadz_lock_card_child_coherence() IS
  'Serializes Smart Card Hub moves with related service-placement and attached-asset mutations.';
COMMENT ON FUNCTION public.adpadz_enforce_card_service_business_coherence() IS
  'Deferred guard ensuring linked services and attached marketing assets match the Smart Card final Business Hub and owner.';
