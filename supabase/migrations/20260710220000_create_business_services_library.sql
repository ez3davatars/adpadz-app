-- Business-owned service library.
--
-- Smart Cards keep lightweight placement rows for public rendering and booking
-- requests. The reusable service details live here and project into every
-- linked placement without deleting historical or unlinked legacy rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.business_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes integer,
  price numeric(12, 2),
  currency text,
  booking_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_services_name_check CHECK (btrim(name) <> ''),
  CONSTRAINT business_services_duration_check CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  CONSTRAINT business_services_price_check CHECK (price IS NULL OR price >= 0),
  CONSTRAINT business_services_currency_check CHECK (
    (price IS NULL AND currency IS NULL)
    OR (price IS NOT NULL AND currency ~ '^[A-Z]{3}$')
  ),
  CONSTRAINT business_services_booking_url_http_check CHECK (
    booking_url IS NULL OR booking_url = '' OR booking_url ~* '^https?://'
  ),
  CONSTRAINT business_services_sort_order_check CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS business_services_business_sort_idx
  ON public.business_services(business_id, is_active, sort_order, created_at);
CREATE INDEX IF NOT EXISTS business_services_owner_idx
  ON public.business_services(owner_id);

CREATE OR REPLACE FUNCTION public.business_services_set_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.business_id IS DISTINCT FROM OLD.business_id THEN
    RAISE EXCEPTION 'A service cannot be moved to another Business Hub';
  END IF;

  SELECT owner_user_id
  INTO v_owner_id
  FROM public.businesses
  WHERE id = NEW.business_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Business Hub owner not found';
  END IF;

  NEW.owner_id = v_owner_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_services_set_owner ON public.business_services;
CREATE TRIGGER business_services_set_owner
  BEFORE INSERT OR UPDATE OF business_id, owner_id ON public.business_services
  FOR EACH ROW EXECUTE FUNCTION public.business_services_set_owner();

CREATE OR REPLACE FUNCTION public.business_services_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_services_set_updated_at ON public.business_services;
CREATE TRIGGER business_services_set_updated_at
  BEFORE UPDATE ON public.business_services
  FOR EACH ROW EXECUTE FUNCTION public.business_services_set_updated_at();

ALTER TABLE public.business_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_services_owner_select" ON public.business_services;
CREATE POLICY "business_services_owner_select" ON public.business_services
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.businesses
      WHERE businesses.id = business_services.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "business_services_owner_insert" ON public.business_services;
CREATE POLICY "business_services_owner_insert" ON public.business_services
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.businesses
      WHERE businesses.id = business_services.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "business_services_owner_update" ON public.business_services;
CREATE POLICY "business_services_owner_update" ON public.business_services
  FOR UPDATE TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.businesses
      WHERE businesses.id = business_services.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.businesses
      WHERE businesses.id = business_services.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "business_services_owner_delete" ON public.business_services;
CREATE POLICY "business_services_owner_delete" ON public.business_services
  FOR DELETE TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.businesses
      WHERE businesses.id = business_services.business_id
        AND businesses.owner_user_id = auth.uid()
    )
  );

REVOKE ALL ON public.business_services FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_services TO authenticated;

ALTER TABLE public.business_card_booking_services
  ADD COLUMN IF NOT EXISTS service_id uuid;

-- Promote each eligible legacy placement as its own library entry. Keeping a
-- one-to-one identity avoids guessing whether similarly named historical rows
-- were intended to share details, while preserving every existing row.
WITH legacy_services AS MATERIALIZED (
  SELECT
    booking_service.id AS booking_service_id,
    gen_random_uuid() AS service_id,
    card.business_id,
    business.owner_user_id AS owner_id,
    booking_service.name,
    booking_service.description,
    booking_service.duration_minutes,
    booking_service.is_active,
    GREATEST(booking_service.sort_order, 0) AS sort_order,
    booking_service.created_at,
    booking_service.updated_at
  FROM public.business_card_booking_services AS booking_service
  JOIN public.business_cards AS card
    ON card.id = booking_service.card_id
  JOIN public.businesses AS business
    ON business.id = card.business_id
  JOIN auth.users AS owner_user
    ON owner_user.id = business.owner_user_id
  WHERE booking_service.service_id IS NULL
    AND business.owner_user_id IS NOT NULL
    AND card.owner_user_id = business.owner_user_id
    AND booking_service.owner_id = business.owner_user_id
    AND btrim(booking_service.name) <> ''
), inserted_services AS (
  INSERT INTO public.business_services (
    id,
    business_id,
    owner_id,
    name,
    description,
    duration_minutes,
    price,
    currency,
    booking_url,
    is_active,
    sort_order,
    created_at,
    updated_at
  )
  SELECT
    service_id,
    business_id,
    owner_id,
    name,
    description,
    duration_minutes,
    NULL,
    NULL,
    NULL,
    is_active,
    sort_order,
    created_at,
    updated_at
  FROM legacy_services
  RETURNING id
)
UPDATE public.business_card_booking_services AS booking_service
SET service_id = legacy_service.service_id
FROM legacy_services AS legacy_service
JOIN inserted_services AS inserted_service
  ON inserted_service.id = legacy_service.service_id
WHERE booking_service.id = legacy_service.booking_service_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.business_card_booking_services'::regclass
      AND conname = 'business_card_booking_services_service_id_fkey'
  ) THEN
    ALTER TABLE public.business_card_booking_services
      ADD CONSTRAINT business_card_booking_services_service_id_fkey
      FOREIGN KEY (service_id)
      REFERENCES public.business_services(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS business_card_booking_services_service_id_idx
  ON public.business_card_booking_services(service_id);

-- Keep the existing owner derivation and additionally validate each reusable
-- service selection. A new service authored in the Smart Card editor is given
-- a library identity automatically when that card belongs to a Business Hub.
CREATE OR REPLACE FUNCTION public.business_card_booking_services_set_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_card_owner_id uuid;
  v_business_id uuid;
  v_service_business_id uuid;
  v_service_owner_id uuid;
  v_service_active boolean;
BEGIN
  SELECT owner_user_id, business_id
  INTO v_card_owner_id, v_business_id
  FROM public.business_cards
  WHERE id = NEW.card_id;

  IF v_card_owner_id IS NULL THEN
    RAISE EXCEPTION 'Smart Card owner not found';
  END IF;

  NEW.owner_id = v_card_owner_id;

  IF NEW.service_id IS NOT NULL THEN
    SELECT business_id, owner_id, is_active
    INTO v_service_business_id, v_service_owner_id, v_service_active
    FROM public.business_services
    WHERE id = NEW.service_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Business service not found';
    END IF;

    IF v_business_id IS NULL
      OR v_service_business_id IS DISTINCT FROM v_business_id
      OR v_service_owner_id IS DISTINCT FROM v_card_owner_id THEN
      RAISE EXCEPTION 'Business service does not belong to this Smart Card Business Hub';
    END IF;

    NEW.is_active = NEW.is_active AND v_service_active;
  ELSIF v_business_id IS NOT NULL
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
      is_active,
      sort_order
    ) VALUES (
      v_business_id,
      v_card_owner_id,
      NEW.name,
      NEW.description,
      NEW.duration_minutes,
      NEW.is_active,
      GREATEST(NEW.sort_order, 0)
    )
    RETURNING id INTO NEW.service_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_card_booking_services_set_owner ON public.business_card_booking_services;
CREATE TRIGGER business_card_booking_services_set_owner
  BEFORE INSERT OR UPDATE OF card_id, service_id, owner_id ON public.business_card_booking_services
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
    is_active = CASE
      WHEN OLD.is_active IS DISTINCT FROM NEW.is_active THEN NEW.is_active
      ELSE business_card_booking_services.is_active
    END
  WHERE service_id = NEW.id
    AND owner_id = NEW.owner_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_services_project_to_smart_cards ON public.business_services;
CREATE TRIGGER business_services_project_to_smart_cards
  AFTER UPDATE OF name, description, duration_minutes, is_active ON public.business_services
  FOR EACH ROW EXECUTE FUNCTION public.business_services_project_to_smart_cards();

REVOKE ALL ON FUNCTION public.business_services_set_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.business_card_booking_services_set_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.business_services_project_to_smart_cards() FROM PUBLIC;

COMMENT ON TABLE public.business_services IS
  'Reusable business-owned services projected into selected Smart Card booking-service rows.';
COMMENT ON COLUMN public.business_card_booking_services.service_id IS
  'Optional reusable Business Hub service selected for this Smart Card placement.';
