-- Save the canonical Business Hub and connect unassigned owned resources in
-- one transaction so the settings page cannot report a half-completed save.

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_profile_shape_check;

ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_profile_shape_check
  CHECK (
    owner_user_id IS NOT NULL
    AND name IS NOT NULL
    AND active IS NOT NULL
    AND char_length(btrim(name)) BETWEEN 1 AND 160
    AND (slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
    AND char_length(COALESCE(slug, '')) <= 120
    AND char_length(COALESCE(description, '')) <= 5000
    AND char_length(COALESCE(phone, '')) <= 64
    AND char_length(COALESCE(email, '')) <= 320
    AND (
      email IS NULL
      OR email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    )
    AND char_length(COALESCE(address, '')) <= 1000
    AND (
      website IS NULL
      OR (
        website ~* '^https?://'
        AND website !~ '[[:cntrl:]]'
        AND char_length(website) <= 2048
      )
    )
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.save_business_hub(
  p_business jsonb,
  p_business_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id uuid := auth.uid();
  business_input public.businesses%ROWTYPE;
  existing_business public.businesses%ROWTYPE;
  saved_business public.businesses%ROWTYPE;
  effective_id uuid := p_business_id;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to save a Business Hub'
      USING ERRCODE = '42501';
  END IF;

  IF p_business IS NULL OR jsonb_typeof(p_business) <> 'object' THEN
    RAISE EXCEPTION 'p_business must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  business_input := jsonb_populate_record(NULL::public.businesses, p_business);
  business_input.name := btrim(COALESCE(business_input.name, ''));
  business_input.slug := NULLIF(btrim(COALESCE(business_input.slug, '')), '');
  business_input.description := NULLIF(btrim(COALESCE(business_input.description, '')), '');
  business_input.phone := NULLIF(btrim(COALESCE(business_input.phone, '')), '');
  business_input.email := NULLIF(lower(btrim(COALESCE(business_input.email, ''))), '');
  business_input.website := NULLIF(btrim(COALESCE(business_input.website, '')), '');
  business_input.address := NULLIF(btrim(COALESCE(business_input.address, '')), '');
  business_input.active := COALESCE(business_input.active, true);

  IF business_input.name = '' THEN
    RAISE EXCEPTION 'Business name is required'
      USING ERRCODE = '23502';
  END IF;

  IF business_input.slug IS NULL
     OR business_input.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'Business slug must use lowercase letters, numbers, and single hyphens'
      USING ERRCODE = '23514';
  END IF;

  IF business_input.website IS NOT NULL
     AND (
       business_input.website !~* '^https?://'
       OR business_input.website ~ '[[:cntrl:]]'
     ) THEN
    RAISE EXCEPTION 'Business website must use a safe HTTP or HTTPS URL'
      USING ERRCODE = '23514';
  END IF;

  IF business_input.email IS NOT NULL
     AND business_input.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Public business email is invalid'
      USING ERRCODE = '23514';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'adpadz:business-hub:' || actor_id::text,
    0
  ));

  IF effective_id IS NULL THEN
    SELECT *
    INTO existing_business
    FROM public.businesses
    WHERE owner_user_id = actor_id
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      effective_id := existing_business.id;
    END IF;
  ELSE
    SELECT *
    INTO existing_business
    FROM public.businesses
    WHERE id = effective_id
      AND owner_user_id = actor_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Business Hub not found or not owned by the current user'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF effective_id IS NULL THEN
    INSERT INTO public.businesses (
      owner_user_id,
      name,
      slug,
      description,
      phone,
      email,
      website,
      address,
      active
    ) VALUES (
      actor_id,
      business_input.name,
      business_input.slug,
      business_input.description,
      business_input.phone,
      business_input.email,
      business_input.website,
      business_input.address,
      business_input.active
    )
    RETURNING * INTO saved_business;
  ELSE
    UPDATE public.businesses
    SET
      name = business_input.name,
      slug = business_input.slug,
      description = business_input.description,
      phone = business_input.phone,
      email = business_input.email,
      website = business_input.website,
      address = business_input.address,
      active = business_input.active
    WHERE id = effective_id
      AND owner_user_id = actor_id
    RETURNING * INTO saved_business;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Business Hub update was rejected by ownership policy'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.business_cards
  SET
    business_id = saved_business.id,
    business_name = saved_business.name,
    phone = saved_business.phone,
    email = saved_business.email,
    website = saved_business.website,
    address = saved_business.address,
    bio = saved_business.description
  WHERE owner_user_id = actor_id
    AND (
      business_id IS NULL
      OR business_id = saved_business.id
    );

  -- Dependencies move before campaigns. Campaign ownership policy validates
  -- primary asset/QR Hub identity, and destination guards validate the final
  -- campaign/QR relationship inside this same transaction.
  UPDATE public.business_marketing_assets
  SET business_id = saved_business.id
  WHERE owner_id = actor_id
    AND business_id IS NULL;

  UPDATE public.qr_links
  SET business_id = saved_business.id
  WHERE owner_user_id = actor_id
    AND business_id IS NULL;

  UPDATE public.campaigns
  SET business_id = saved_business.id
  WHERE owner_id = actor_id
    AND business_id IS NULL;

  RETURN saved_business.id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_business_hub(jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_business_hub(jsonb, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_business_hub(jsonb, uuid) TO authenticated;

COMMENT ON FUNCTION public.save_business_hub(jsonb, uuid) IS
  'Atomically saves one owner Business Hub and connects otherwise-unassigned owned resources.';
