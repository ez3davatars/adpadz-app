-- Canonical Business Hub service details on Smart Card placements.
--
-- A placement owns only card-local visibility and order. Shared service
-- details are copied from business_services for fast/public reads and are
-- overwritten by triggers whenever a linked placement is written, preventing
-- API clients or older editors from silently diverging from the library.

ALTER TABLE public.business_card_booking_services
  ADD COLUMN IF NOT EXISTS price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS service_is_active boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.business_card_booking_services'::regclass
      AND conname = 'business_card_booking_services_price_check'
  ) THEN
    ALTER TABLE public.business_card_booking_services
      ADD CONSTRAINT business_card_booking_services_price_check
      CHECK (price IS NULL OR price >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.business_card_booking_services'::regclass
      AND conname = 'business_card_booking_services_currency_check'
  ) THEN
    ALTER TABLE public.business_card_booking_services
      ADD CONSTRAINT business_card_booking_services_currency_check
      CHECK (
        (price IS NULL AND currency IS NULL)
        OR (price IS NOT NULL AND currency ~ '^[A-Z]{3}$')
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.business_card_booking_services'::regclass
      AND conname = 'business_card_booking_services_booking_url_http_check'
  ) THEN
    ALTER TABLE public.business_card_booking_services
      ADD CONSTRAINT business_card_booking_services_booking_url_http_check
      CHECK (booking_url IS NULL OR booking_url = '' OR booking_url ~* '^https?://')
      NOT VALID;
  END IF;
END $$;

UPDATE public.business_card_booking_services AS placement
SET
  name = service.name,
  description = service.description,
  duration_minutes = service.duration_minutes,
  price = service.price,
  currency = service.currency,
  booking_url = service.booking_url,
  service_is_active = service.is_active
FROM public.business_services AS service
JOIN public.business_cards AS card
  ON card.business_id = service.business_id
 AND card.owner_user_id = service.owner_id
WHERE placement.service_id = service.id
  AND placement.card_id = card.id
  AND placement.owner_id = service.owner_id;

CREATE OR REPLACE FUNCTION public.business_card_booking_services_set_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_card_owner_id uuid;
  v_business_id uuid;
  v_service public.business_services%ROWTYPE;
  v_selection_changed boolean := false;
  v_should_promote boolean := false;
BEGIN
  SELECT owner_user_id, business_id
  INTO v_card_owner_id, v_business_id
  FROM public.business_cards
  WHERE id = NEW.card_id;

  IF v_card_owner_id IS NULL THEN
    RAISE EXCEPTION 'Smart Card owner not found';
  END IF;

  NEW.owner_id = v_card_owner_id;

  -- The bundle RPC always includes service_id, including null for a custom
  -- row. If an earlier field update in the same transaction just promoted
  -- that row, retain its live mapping instead of immediately unlinking it.
  -- ON DELETE SET NULL still works because the deleted library row no longer
  -- exists when this check runs.
  IF TG_OP = 'UPDATE'
    AND OLD.service_id IS NOT NULL
    AND NEW.service_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.business_services
      WHERE business_services.id = OLD.service_id
    ) THEN
    NEW.service_id = OLD.service_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_selection_changed := NEW.service_id IS NOT NULL;
    v_should_promote := NEW.service_id IS NULL;
  ELSE
    v_selection_changed := OLD.service_id IS DISTINCT FROM NEW.service_id;
    -- Existing unlinked rows remain editable. Once their card belongs to a
    -- Business Hub, their next ordinary edit safely promotes them.
    v_should_promote := OLD.service_id IS NULL AND NEW.service_id IS NULL;
  END IF;

  IF NEW.service_id IS NOT NULL THEN
    SELECT *
    INTO v_service
    FROM public.business_services
    WHERE id = NEW.service_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Business service not found';
    END IF;

    IF v_business_id IS NULL
      OR v_service.business_id IS DISTINCT FROM v_business_id
      OR v_service.owner_id IS DISTINCT FROM v_card_owner_id THEN
      RAISE EXCEPTION 'Business service does not belong to this Smart Card Business Hub';
    END IF;

    IF v_selection_changed AND NOT v_service.is_active THEN
      RAISE EXCEPTION 'Archived Business Hub services cannot be added to a Smart Card';
    END IF;

    NEW.name = v_service.name;
    NEW.description = v_service.description;
    NEW.duration_minutes = v_service.duration_minutes;
    NEW.price = v_service.price;
    NEW.currency = v_service.currency;
    NEW.booking_url = v_service.booking_url;
    NEW.service_is_active = v_service.is_active;
  ELSIF v_should_promote
    AND v_business_id IS NOT NULL
    AND btrim(NEW.name) <> ''
    AND EXISTS (
      SELECT 1
      FROM public.businesses
      WHERE businesses.id = v_business_id
        AND businesses.owner_user_id = v_card_owner_id
    ) THEN
    INSERT INTO public.business_services (
      business_id,
      owner_id,
      name,
      description,
      duration_minutes,
      price,
      currency,
      booking_url,
      is_active,
      sort_order
    ) VALUES (
      v_business_id,
      v_card_owner_id,
      NEW.name,
      NEW.description,
      NEW.duration_minutes,
      NEW.price,
      NEW.currency,
      NEW.booking_url,
      true,
      GREATEST(NEW.sort_order, 0)
    )
    RETURNING id INTO NEW.service_id;

    NEW.service_is_active = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_card_booking_services_set_owner
  ON public.business_card_booking_services;
CREATE TRIGGER business_card_booking_services_set_owner
  BEFORE INSERT OR UPDATE ON public.business_card_booking_services
  FOR EACH ROW EXECUTE FUNCTION public.business_card_booking_services_set_owner();

CREATE OR REPLACE FUNCTION public.business_services_project_to_smart_cards()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.business_card_booking_services
  SET
    name = NEW.name,
    description = NEW.description,
    duration_minutes = NEW.duration_minutes,
    price = NEW.price,
    currency = NEW.currency,
    booking_url = NEW.booking_url,
    service_is_active = NEW.is_active
  WHERE service_id = NEW.id
    AND owner_id = NEW.owner_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_services_project_to_smart_cards
  ON public.business_services;
CREATE TRIGGER business_services_project_to_smart_cards
  AFTER UPDATE OF name, description, duration_minutes, price, currency, booking_url, is_active
  ON public.business_services
  FOR EACH ROW EXECUTE FUNCTION public.business_services_project_to_smart_cards();

DROP POLICY IF EXISTS business_card_booking_services_public_read
  ON public.business_card_booking_services;
CREATE POLICY business_card_booking_services_public_read
  ON public.business_card_booking_services
  FOR SELECT TO anon, authenticated
  USING (
    is_active IS TRUE
    AND service_is_active IS TRUE
    AND EXISTS (
      SELECT 1
      FROM public.business_cards
      WHERE business_cards.id = business_card_booking_services.card_id
        AND business_cards.is_published IS TRUE
    )
  );

-- The security migration validates the placement id supplied by public booking
-- requests. This second, alphabetically-later guard additionally requires the
-- linked library service to be active without replacing the larger throttle
-- and normalization function installed there.
CREATE OR REPLACE FUNCTION public.business_card_leads_require_active_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_placement_id uuid;
  v_business_service_id uuid;
  v_duration_minutes integer;
  v_price numeric(12, 2);
  v_currency text;
BEGIN
  IF NOT public.adpadz_request_uses_public_api_role()
    OR NEW.lead_type IS DISTINCT FROM 'booking_request'
    OR NOT (COALESCE(NEW.metadata, '{}'::jsonb) ? 'service_id') THEN
    RETURN NEW;
  END IF;

  v_placement_id := public.adpadz_jsonb_uuid(NEW.metadata, 'service_id');
  SELECT
    placement.service_id,
    placement.duration_minutes,
    placement.price,
    placement.currency
  INTO
    v_business_service_id,
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

REVOKE ALL ON FUNCTION public.business_card_booking_services_set_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.business_services_project_to_smart_cards() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.business_card_leads_require_active_service() FROM PUBLIC;

COMMENT ON COLUMN public.business_card_booking_services.price IS
  'Canonical projected price from business_services when service_id is linked.';
COMMENT ON COLUMN public.business_card_booking_services.currency IS
  'Canonical projected ISO-style currency code from business_services when linked.';
COMMENT ON COLUMN public.business_card_booking_services.booking_url IS
  'Canonical projected service-specific booking URL from business_services when linked.';
COMMENT ON COLUMN public.business_card_booking_services.service_is_active IS
  'Projected library availability; public visibility also requires local is_active.';
