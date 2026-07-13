-- Atomically reconcile a Smart Card editor snapshot.
--
-- API (authenticated only):
--   select public.save_smart_card_bundle(
--     jsonb_build_object(
--       'card', jsonb_build_object('id', '<optional uuid>', 'slug', 'my-card', ...),
--       'links', jsonb_build_array(...),
--       'offers', jsonb_build_array(...),
--       'gallery', jsonb_build_array(...),
--       'booking_services', jsonb_build_array(...),
--       'marketing_assets', jsonb_build_array(...),
--       'before_after_items', jsonb_build_array(...),
--       'testimonials', jsonb_build_array(...)
--     )
--   );
--
-- The card object is required. Omit card.id to create a card; include it to
-- update a card owned by auth.uid(). Each child collection is optional. A
-- present collection is a complete snapshot: UUID rows in the array are
-- updated in place, new/draft rows are inserted, and rows for this card that
-- are absent from the array are deleted. An omitted collection is untouched.
-- Existing item fields omitted from an item object are preserved. Non-UUID
-- item ids (for example "draft-123") are treated as client-only draft keys.
--
-- The function returns the canonical card and every child collection. Calls
-- are atomic because a PostgreSQL function invocation runs in one transaction;
-- any validation or write error rolls back the entire bundle.

CREATE OR REPLACE FUNCTION public.save_smart_card_bundle(p_bundle jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_card jsonb;
  v_card_id uuid;
  v_existing_card public.business_cards%ROWTYPE;
  v_saved_card public.business_cards%ROWTYPE;
  v_business_id uuid;
  v_item jsonb;
  v_item_id uuid;
  v_parent_id uuid;
  v_updated_id uuid;
  v_keep_ids uuid[];
  v_item_exists boolean;
  v_item_business_id uuid;
  v_service_id uuid;
  v_service_id_supplied boolean;
  v_has_service_id_column boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Authentication is required to save a Smart Card';
  END IF;

  IF p_bundle IS NULL OR jsonb_typeof(p_bundle) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Smart Card bundle must be a JSON object';
  END IF;

  v_card := p_bundle -> 'card';
  IF v_card IS NULL OR jsonb_typeof(v_card) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Smart Card bundle.card must be a JSON object';
  END IF;

  IF NULLIF(btrim(v_card ->> 'id'), '') IS NOT NULL THEN
    BEGIN
      v_card_id := (v_card ->> 'id')::uuid;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION USING
          ERRCODE = '22023',
          MESSAGE = 'Smart Card card.id must be a UUID';
    END;

    SELECT card_row.*
    INTO v_existing_card
    FROM public.business_cards AS card_row
    WHERE card_row.id = v_card_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P0002',
        MESSAGE = 'Smart Card was not found or is not available to this user';
    END IF;

    IF v_existing_card.owner_user_id IS DISTINCT FROM v_user_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'The authenticated user does not own this Smart Card';
    END IF;
  END IF;

  IF v_card ? 'business_id' THEN
    IF NULLIF(btrim(v_card ->> 'business_id'), '') IS NULL THEN
      v_business_id := NULL;
    ELSE
      BEGIN
        v_business_id := (v_card ->> 'business_id')::uuid;
      EXCEPTION
        WHEN invalid_text_representation THEN
          RAISE EXCEPTION USING
            ERRCODE = '22023',
            MESSAGE = 'Smart Card card.business_id must be a UUID or null';
      END;
    END IF;
  ELSIF v_card_id IS NOT NULL THEN
    v_business_id := v_existing_card.business_id;
  ELSE
    v_business_id := NULL;
  END IF;

  IF v_business_id IS NOT NULL
    AND (v_card_id IS NULL OR v_card ? 'business_id')
    AND NOT EXISTS (
    SELECT 1
    FROM public.businesses AS business_row
    WHERE business_row.id = v_business_id
      AND business_row.owner_user_id = v_user_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'The selected Business Hub is not owned by the authenticated user';
  END IF;

  IF v_card_id IS NULL THEN
    IF NULLIF(btrim(v_card ->> 'slug'), '') IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'Smart Card card.slug is required';
    END IF;

    INSERT INTO public.business_cards (
      owner_user_id,
      business_id,
      business_name,
      slug,
      tagline,
      logo_url,
      logo_image_id,
      logo_fit,
      logo_position_x,
      logo_position_y,
      logo_zoom,
      cover_image_url,
      cover_image_id,
      cover_fit,
      cover_position_x,
      cover_position_y,
      cover_zoom,
      cover_overlay_opacity,
      phone,
      email,
      website,
      address,
      google_maps_url,
      bio,
      theme,
      template,
      primary_color,
      accent_color,
      is_published,
      featured_video_enabled,
      featured_video_url,
      featured_video_title,
      booking_enabled,
      booking_mode,
      booking_url,
      booking_label,
      booking_provider,
      booking_request_enabled,
      booking_request_title,
      booking_request_description,
      booking_request_button_label,
      lead_form_enabled,
      lead_form_title,
      lead_form_description,
      lead_form_button_label
    ) VALUES (
      v_user_id,
      v_business_id,
      COALESCE(NULLIF(btrim(v_card ->> 'business_name'), ''), 'Untitled business'),
      lower(btrim(v_card ->> 'slug')),
      NULLIF(btrim(v_card ->> 'tagline'), ''),
      NULLIF(btrim(v_card ->> 'logo_url'), ''),
      NULLIF(btrim(v_card ->> 'logo_image_id'), ''),
      COALESCE(NULLIF(v_card ->> 'logo_fit', ''), 'cover'),
      COALESCE(NULLIF(v_card ->> 'logo_position_x', '')::numeric, 50),
      COALESCE(NULLIF(v_card ->> 'logo_position_y', '')::numeric, 50),
      COALESCE(NULLIF(v_card ->> 'logo_zoom', '')::numeric, 1),
      NULLIF(btrim(v_card ->> 'cover_image_url'), ''),
      NULLIF(btrim(v_card ->> 'cover_image_id'), ''),
      COALESCE(NULLIF(v_card ->> 'cover_fit', ''), 'cover'),
      COALESCE(NULLIF(v_card ->> 'cover_position_x', '')::numeric, 50),
      COALESCE(NULLIF(v_card ->> 'cover_position_y', '')::numeric, 50),
      COALESCE(NULLIF(v_card ->> 'cover_zoom', '')::numeric, 1),
      COALESCE(NULLIF(v_card ->> 'cover_overlay_opacity', '')::numeric, 90),
      NULLIF(btrim(v_card ->> 'phone'), ''),
      NULLIF(btrim(v_card ->> 'email'), ''),
      NULLIF(btrim(v_card ->> 'website'), ''),
      NULLIF(btrim(v_card ->> 'address'), ''),
      NULLIF(btrim(v_card ->> 'google_maps_url'), ''),
      NULLIF(btrim(v_card ->> 'bio'), ''),
      COALESCE(NULLIF(v_card ->> 'theme', ''), 'market-pop'),
      COALESCE(NULLIF(v_card ->> 'template', ''), 'modern_glass'),
      COALESCE(NULLIF(v_card ->> 'primary_color', ''), '#B6FF00'),
      COALESCE(NULLIF(v_card ->> 'accent_color', ''), '#14B8A6'),
      COALESCE((v_card ->> 'is_published')::boolean, false),
      COALESCE((v_card ->> 'featured_video_enabled')::boolean, false),
      NULLIF(btrim(v_card ->> 'featured_video_url'), ''),
      COALESCE(NULLIF(btrim(v_card ->> 'featured_video_title'), ''), 'Local Spotlight'),
      COALESCE((v_card ->> 'booking_enabled')::boolean, false),
      COALESCE(NULLIF(v_card ->> 'booking_mode', ''), 'external'),
      NULLIF(btrim(v_card ->> 'booking_url'), ''),
      COALESCE(NULLIF(btrim(v_card ->> 'booking_label'), ''), 'Book Now'),
      NULLIF(btrim(v_card ->> 'booking_provider'), ''),
      COALESCE((v_card ->> 'booking_request_enabled')::boolean, false),
      COALESCE(NULLIF(btrim(v_card ->> 'booking_request_title'), ''), 'Request an Appointment'),
      NULLIF(btrim(v_card ->> 'booking_request_description'), ''),
      COALESCE(NULLIF(btrim(v_card ->> 'booking_request_button_label'), ''), 'Request Booking'),
      COALESCE((v_card ->> 'lead_form_enabled')::boolean, false),
      COALESCE(NULLIF(btrim(v_card ->> 'lead_form_title'), ''), 'Request Information'),
      NULLIF(btrim(v_card ->> 'lead_form_description'), ''),
      COALESCE(NULLIF(btrim(v_card ->> 'lead_form_button_label'), ''), 'Send Request')
    )
    RETURNING * INTO v_saved_card;

    v_card_id := v_saved_card.id;
  ELSE
    IF v_card ? 'slug' AND NULLIF(btrim(v_card ->> 'slug'), '') IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'Smart Card card.slug cannot be blank';
    END IF;

    UPDATE public.business_cards AS card_row
    SET
      business_id = CASE WHEN v_card ? 'business_id' THEN v_business_id ELSE card_row.business_id END,
      business_name = CASE WHEN v_card ? 'business_name' THEN COALESCE(NULLIF(btrim(v_card ->> 'business_name'), ''), 'Untitled business') ELSE card_row.business_name END,
      slug = CASE WHEN v_card ? 'slug' THEN lower(btrim(v_card ->> 'slug')) ELSE card_row.slug END,
      tagline = CASE WHEN v_card ? 'tagline' THEN NULLIF(btrim(v_card ->> 'tagline'), '') ELSE card_row.tagline END,
      logo_url = CASE WHEN v_card ? 'logo_url' THEN NULLIF(btrim(v_card ->> 'logo_url'), '') ELSE card_row.logo_url END,
      logo_image_id = CASE WHEN v_card ? 'logo_image_id' THEN NULLIF(btrim(v_card ->> 'logo_image_id'), '') ELSE card_row.logo_image_id END,
      logo_fit = CASE WHEN v_card ? 'logo_fit' THEN COALESCE(NULLIF(v_card ->> 'logo_fit', ''), 'cover') ELSE card_row.logo_fit END,
      logo_position_x = CASE WHEN v_card ? 'logo_position_x' THEN COALESCE(NULLIF(v_card ->> 'logo_position_x', '')::numeric, 50) ELSE card_row.logo_position_x END,
      logo_position_y = CASE WHEN v_card ? 'logo_position_y' THEN COALESCE(NULLIF(v_card ->> 'logo_position_y', '')::numeric, 50) ELSE card_row.logo_position_y END,
      logo_zoom = CASE WHEN v_card ? 'logo_zoom' THEN COALESCE(NULLIF(v_card ->> 'logo_zoom', '')::numeric, 1) ELSE card_row.logo_zoom END,
      cover_image_url = CASE WHEN v_card ? 'cover_image_url' THEN NULLIF(btrim(v_card ->> 'cover_image_url'), '') ELSE card_row.cover_image_url END,
      cover_image_id = CASE WHEN v_card ? 'cover_image_id' THEN NULLIF(btrim(v_card ->> 'cover_image_id'), '') ELSE card_row.cover_image_id END,
      cover_fit = CASE WHEN v_card ? 'cover_fit' THEN COALESCE(NULLIF(v_card ->> 'cover_fit', ''), 'cover') ELSE card_row.cover_fit END,
      cover_position_x = CASE WHEN v_card ? 'cover_position_x' THEN COALESCE(NULLIF(v_card ->> 'cover_position_x', '')::numeric, 50) ELSE card_row.cover_position_x END,
      cover_position_y = CASE WHEN v_card ? 'cover_position_y' THEN COALESCE(NULLIF(v_card ->> 'cover_position_y', '')::numeric, 50) ELSE card_row.cover_position_y END,
      cover_zoom = CASE WHEN v_card ? 'cover_zoom' THEN COALESCE(NULLIF(v_card ->> 'cover_zoom', '')::numeric, 1) ELSE card_row.cover_zoom END,
      cover_overlay_opacity = CASE WHEN v_card ? 'cover_overlay_opacity' THEN COALESCE(NULLIF(v_card ->> 'cover_overlay_opacity', '')::numeric, 90) ELSE card_row.cover_overlay_opacity END,
      phone = CASE WHEN v_card ? 'phone' THEN NULLIF(btrim(v_card ->> 'phone'), '') ELSE card_row.phone END,
      email = CASE WHEN v_card ? 'email' THEN NULLIF(btrim(v_card ->> 'email'), '') ELSE card_row.email END,
      website = CASE WHEN v_card ? 'website' THEN NULLIF(btrim(v_card ->> 'website'), '') ELSE card_row.website END,
      address = CASE WHEN v_card ? 'address' THEN NULLIF(btrim(v_card ->> 'address'), '') ELSE card_row.address END,
      google_maps_url = CASE WHEN v_card ? 'google_maps_url' THEN NULLIF(btrim(v_card ->> 'google_maps_url'), '') ELSE card_row.google_maps_url END,
      bio = CASE WHEN v_card ? 'bio' THEN NULLIF(btrim(v_card ->> 'bio'), '') ELSE card_row.bio END,
      theme = CASE WHEN v_card ? 'theme' THEN COALESCE(NULLIF(v_card ->> 'theme', ''), 'market-pop') ELSE card_row.theme END,
      template = CASE WHEN v_card ? 'template' THEN COALESCE(NULLIF(v_card ->> 'template', ''), 'modern_glass') ELSE card_row.template END,
      primary_color = CASE WHEN v_card ? 'primary_color' THEN COALESCE(NULLIF(v_card ->> 'primary_color', ''), '#B6FF00') ELSE card_row.primary_color END,
      accent_color = CASE WHEN v_card ? 'accent_color' THEN COALESCE(NULLIF(v_card ->> 'accent_color', ''), '#14B8A6') ELSE card_row.accent_color END,
      is_published = CASE WHEN v_card ? 'is_published' THEN COALESCE((v_card ->> 'is_published')::boolean, false) ELSE card_row.is_published END,
      featured_video_enabled = CASE WHEN v_card ? 'featured_video_enabled' THEN COALESCE((v_card ->> 'featured_video_enabled')::boolean, false) ELSE card_row.featured_video_enabled END,
      featured_video_url = CASE WHEN v_card ? 'featured_video_url' THEN NULLIF(btrim(v_card ->> 'featured_video_url'), '') ELSE card_row.featured_video_url END,
      featured_video_title = CASE WHEN v_card ? 'featured_video_title' THEN COALESCE(NULLIF(btrim(v_card ->> 'featured_video_title'), ''), 'Local Spotlight') ELSE card_row.featured_video_title END,
      booking_enabled = CASE WHEN v_card ? 'booking_enabled' THEN COALESCE((v_card ->> 'booking_enabled')::boolean, false) ELSE card_row.booking_enabled END,
      booking_mode = CASE WHEN v_card ? 'booking_mode' THEN COALESCE(NULLIF(v_card ->> 'booking_mode', ''), 'external') ELSE card_row.booking_mode END,
      booking_url = CASE WHEN v_card ? 'booking_url' THEN NULLIF(btrim(v_card ->> 'booking_url'), '') ELSE card_row.booking_url END,
      booking_label = CASE WHEN v_card ? 'booking_label' THEN COALESCE(NULLIF(btrim(v_card ->> 'booking_label'), ''), 'Book Now') ELSE card_row.booking_label END,
      booking_provider = CASE WHEN v_card ? 'booking_provider' THEN NULLIF(btrim(v_card ->> 'booking_provider'), '') ELSE card_row.booking_provider END,
      booking_request_enabled = CASE WHEN v_card ? 'booking_request_enabled' THEN COALESCE((v_card ->> 'booking_request_enabled')::boolean, false) ELSE card_row.booking_request_enabled END,
      booking_request_title = CASE WHEN v_card ? 'booking_request_title' THEN COALESCE(NULLIF(btrim(v_card ->> 'booking_request_title'), ''), 'Request an Appointment') ELSE card_row.booking_request_title END,
      booking_request_description = CASE WHEN v_card ? 'booking_request_description' THEN NULLIF(btrim(v_card ->> 'booking_request_description'), '') ELSE card_row.booking_request_description END,
      booking_request_button_label = CASE WHEN v_card ? 'booking_request_button_label' THEN COALESCE(NULLIF(btrim(v_card ->> 'booking_request_button_label'), ''), 'Request Booking') ELSE card_row.booking_request_button_label END,
      lead_form_enabled = CASE WHEN v_card ? 'lead_form_enabled' THEN COALESCE((v_card ->> 'lead_form_enabled')::boolean, false) ELSE card_row.lead_form_enabled END,
      lead_form_title = CASE WHEN v_card ? 'lead_form_title' THEN COALESCE(NULLIF(btrim(v_card ->> 'lead_form_title'), ''), 'Request Information') ELSE card_row.lead_form_title END,
      lead_form_description = CASE WHEN v_card ? 'lead_form_description' THEN NULLIF(btrim(v_card ->> 'lead_form_description'), '') ELSE card_row.lead_form_description END,
      lead_form_button_label = CASE WHEN v_card ? 'lead_form_button_label' THEN COALESCE(NULLIF(btrim(v_card ->> 'lead_form_button_label'), ''), 'Send Request') ELSE card_row.lead_form_button_label END
    WHERE card_row.id = v_card_id
      AND card_row.owner_user_id = v_user_id
    RETURNING card_row.* INTO v_saved_card;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = '42501',
        MESSAGE = 'The authenticated user could not update this Smart Card';
    END IF;
  END IF;

  -- Links ------------------------------------------------------------------
  IF p_bundle ? 'links' THEN
    IF jsonb_typeof(p_bundle -> 'links') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Smart Card links must be a JSON array';
    END IF;

    v_keep_ids := ARRAY[]::uuid[];
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_bundle -> 'links') LOOP
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card link must be a JSON object';
      END IF;

      v_item_id := NULL;
      IF NULLIF(btrim(v_item ->> 'id'), '') IS NOT NULL THEN
        BEGIN
          v_item_id := (v_item ->> 'id')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN
          v_item_id := NULL;
        END;
      END IF;

      v_item_exists := false;
      IF v_item_id IS NOT NULL THEN
        SELECT link_row.business_card_id INTO v_parent_id
        FROM public.business_card_links AS link_row
        WHERE link_row.id = v_item_id;
        IF FOUND THEN
          IF v_parent_id IS DISTINCT FROM v_card_id THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A submitted link belongs to another Smart Card';
          END IF;
          IF v_item_id = ANY(v_keep_ids) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A Smart Card link id was submitted more than once';
          END IF;
          v_item_exists := true;
        ELSE
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'A submitted Smart Card link is stale; reload before saving';
        END IF;
      END IF;

      IF (NOT v_item_exists OR v_item ? 'label') AND NULLIF(btrim(v_item ->> 'label'), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card link requires a label';
      END IF;
      IF (NOT v_item_exists OR v_item ? 'url') AND NULLIF(btrim(v_item ->> 'url'), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card link requires a URL';
      END IF;

      IF v_item_exists THEN
        UPDATE public.business_card_links AS link_row
        SET
          label = CASE WHEN v_item ? 'label' THEN btrim(v_item ->> 'label') ELSE link_row.label END,
          url = CASE WHEN v_item ? 'url' THEN btrim(v_item ->> 'url') ELSE link_row.url END,
          sort_order = CASE WHEN v_item ? 'sort_order' THEN COALESCE((v_item ->> 'sort_order')::integer, 0) ELSE link_row.sort_order END,
          is_active = CASE WHEN v_item ? 'is_active' THEN COALESCE((v_item ->> 'is_active')::boolean, true) ELSE link_row.is_active END
        WHERE link_row.id = v_item_id
          AND link_row.business_card_id = v_card_id
        RETURNING link_row.id INTO v_updated_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A Smart Card link could not be updated';
        END IF;
      ELSE
        INSERT INTO public.business_card_links (business_card_id, label, url, sort_order, is_active)
        VALUES (
          v_card_id,
          btrim(v_item ->> 'label'),
          btrim(v_item ->> 'url'),
          COALESCE((v_item ->> 'sort_order')::integer, 0),
          COALESCE((v_item ->> 'is_active')::boolean, true)
        )
        RETURNING id INTO v_item_id;
      END IF;

      v_keep_ids := array_append(v_keep_ids, v_item_id);
    END LOOP;

    DELETE FROM public.business_card_links AS link_row
    WHERE link_row.business_card_id = v_card_id
      AND NOT (link_row.id = ANY(v_keep_ids));
  END IF;

  -- Offers. Updates intentionally never touch view_count or claim_count. -----
  IF p_bundle ? 'offers' THEN
    IF jsonb_typeof(p_bundle -> 'offers') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Smart Card offers must be a JSON array';
    END IF;

    v_keep_ids := ARRAY[]::uuid[];
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_bundle -> 'offers') LOOP
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card offer must be a JSON object';
      END IF;

      v_item_id := NULL;
      IF NULLIF(btrim(v_item ->> 'id'), '') IS NOT NULL THEN
        BEGIN v_item_id := (v_item ->> 'id')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN v_item_id := NULL;
        END;
      END IF;

      v_item_exists := false;
      IF v_item_id IS NOT NULL THEN
        SELECT offer_row.business_card_id INTO v_parent_id
        FROM public.business_card_offers AS offer_row
        WHERE offer_row.id = v_item_id;
        IF FOUND THEN
          IF v_parent_id IS DISTINCT FROM v_card_id THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A submitted offer belongs to another Smart Card';
          END IF;
          IF v_item_id = ANY(v_keep_ids) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A Smart Card offer id was submitted more than once';
          END IF;
          v_item_exists := true;
        ELSE
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'A submitted Smart Card offer is stale; reload before saving';
        END IF;
      END IF;

      IF (NOT v_item_exists OR v_item ? 'title') AND NULLIF(btrim(v_item ->> 'title'), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card offer requires a title';
      END IF;

      IF v_item_exists THEN
        UPDATE public.business_card_offers AS offer_row
        SET
          title = CASE WHEN v_item ? 'title' THEN btrim(v_item ->> 'title') ELSE offer_row.title END,
          description = CASE WHEN v_item ? 'description' THEN NULLIF(btrim(v_item ->> 'description'), '') ELSE offer_row.description END,
          claim_url = CASE WHEN v_item ? 'claim_url' THEN NULLIF(btrim(v_item ->> 'claim_url'), '') ELSE offer_row.claim_url END,
          starts_at = CASE WHEN v_item ? 'starts_at' THEN NULLIF(v_item ->> 'starts_at', '')::timestamptz ELSE offer_row.starts_at END,
          ends_at = CASE WHEN v_item ? 'ends_at' THEN NULLIF(v_item ->> 'ends_at', '')::timestamptz ELSE offer_row.ends_at END,
          is_active = CASE WHEN v_item ? 'is_active' THEN COALESCE((v_item ->> 'is_active')::boolean, true) ELSE offer_row.is_active END
        WHERE offer_row.id = v_item_id
          AND offer_row.business_card_id = v_card_id
        RETURNING offer_row.id INTO v_updated_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A Smart Card offer could not be updated';
        END IF;
      ELSE
        INSERT INTO public.business_card_offers (
          business_card_id, title, description, claim_url, starts_at, ends_at, is_active
        ) VALUES (
          v_card_id,
          btrim(v_item ->> 'title'),
          NULLIF(btrim(v_item ->> 'description'), ''),
          NULLIF(btrim(v_item ->> 'claim_url'), ''),
          NULLIF(v_item ->> 'starts_at', '')::timestamptz,
          NULLIF(v_item ->> 'ends_at', '')::timestamptz,
          COALESCE((v_item ->> 'is_active')::boolean, true)
        )
        RETURNING id INTO v_item_id;
      END IF;

      v_keep_ids := array_append(v_keep_ids, v_item_id);
    END LOOP;

    DELETE FROM public.business_card_offers AS offer_row
    WHERE offer_row.business_card_id = v_card_id
      AND NOT (offer_row.id = ANY(v_keep_ids));
  END IF;

  -- Gallery ----------------------------------------------------------------
  IF p_bundle ? 'gallery' THEN
    IF jsonb_typeof(p_bundle -> 'gallery') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Smart Card gallery must be a JSON array';
    END IF;

    v_keep_ids := ARRAY[]::uuid[];
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_bundle -> 'gallery') LOOP
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card gallery item must be a JSON object';
      END IF;

      v_item_id := NULL;
      IF NULLIF(btrim(v_item ->> 'id'), '') IS NOT NULL THEN
        BEGIN v_item_id := (v_item ->> 'id')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN v_item_id := NULL;
        END;
      END IF;

      v_item_exists := false;
      IF v_item_id IS NOT NULL THEN
        SELECT gallery_row.card_id INTO v_parent_id
        FROM public.business_card_gallery_items AS gallery_row
        WHERE gallery_row.id = v_item_id;
        IF FOUND THEN
          IF v_parent_id IS DISTINCT FROM v_card_id THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A submitted gallery item belongs to another Smart Card';
          END IF;
          IF v_item_id = ANY(v_keep_ids) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A Smart Card gallery item id was submitted more than once';
          END IF;
          v_item_exists := true;
        ELSE
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'A submitted Smart Card gallery item is stale; reload before saving';
        END IF;
      END IF;

      IF (NOT v_item_exists OR v_item ? 'image_url') AND NULLIF(btrim(v_item ->> 'image_url'), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card gallery item requires an image URL';
      END IF;

      IF v_item_exists THEN
        UPDATE public.business_card_gallery_items AS gallery_row
        SET
          image_url = CASE WHEN v_item ? 'image_url' THEN btrim(v_item ->> 'image_url') ELSE gallery_row.image_url END,
          cloudflare_image_id = CASE WHEN v_item ? 'cloudflare_image_id' THEN NULLIF(btrim(v_item ->> 'cloudflare_image_id'), '') ELSE gallery_row.cloudflare_image_id END,
          fit = CASE WHEN v_item ? 'fit' THEN COALESCE(NULLIF(v_item ->> 'fit', ''), 'cover') ELSE gallery_row.fit END,
          position_x = CASE WHEN v_item ? 'position_x' THEN COALESCE(NULLIF(v_item ->> 'position_x', '')::numeric, 50) ELSE gallery_row.position_x END,
          position_y = CASE WHEN v_item ? 'position_y' THEN COALESCE(NULLIF(v_item ->> 'position_y', '')::numeric, 50) ELSE gallery_row.position_y END,
          zoom = CASE WHEN v_item ? 'zoom' THEN COALESCE(NULLIF(v_item ->> 'zoom', '')::numeric, 1) ELSE gallery_row.zoom END,
          caption = CASE WHEN v_item ? 'caption' THEN NULLIF(btrim(v_item ->> 'caption'), '') ELSE gallery_row.caption END,
          sort_order = CASE WHEN v_item ? 'sort_order' THEN COALESCE((v_item ->> 'sort_order')::integer, 0) ELSE gallery_row.sort_order END,
          is_active = CASE WHEN v_item ? 'is_active' THEN COALESCE((v_item ->> 'is_active')::boolean, true) ELSE gallery_row.is_active END
        WHERE gallery_row.id = v_item_id
          AND gallery_row.card_id = v_card_id
        RETURNING gallery_row.id INTO v_updated_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A Smart Card gallery item could not be updated';
        END IF;
      ELSE
        INSERT INTO public.business_card_gallery_items (
          card_id, image_url, cloudflare_image_id, fit, position_x, position_y, zoom,
          caption, sort_order, is_active
        ) VALUES (
          v_card_id,
          btrim(v_item ->> 'image_url'),
          NULLIF(btrim(v_item ->> 'cloudflare_image_id'), ''),
          COALESCE(NULLIF(v_item ->> 'fit', ''), 'cover'),
          COALESCE(NULLIF(v_item ->> 'position_x', '')::numeric, 50),
          COALESCE(NULLIF(v_item ->> 'position_y', '')::numeric, 50),
          COALESCE(NULLIF(v_item ->> 'zoom', '')::numeric, 1),
          NULLIF(btrim(v_item ->> 'caption'), ''),
          COALESCE((v_item ->> 'sort_order')::integer, 0),
          COALESCE((v_item ->> 'is_active')::boolean, true)
        )
        RETURNING id INTO v_item_id;
      END IF;

      v_keep_ids := array_append(v_keep_ids, v_item_id);
    END LOOP;

    DELETE FROM public.business_card_gallery_items AS gallery_row
    WHERE gallery_row.card_id = v_card_id
      AND NOT (gallery_row.id = ANY(v_keep_ids));
  END IF;

  -- Booking-service placements. service_id is accessed only with dynamic SQL
  -- so this function also installs/runs when the optional service-library
  -- migration has not added that column.
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'business_card_booking_services'
      AND column_name = 'service_id'
  ) INTO v_has_service_id_column;

  IF p_bundle ? 'booking_services' THEN
    IF jsonb_typeof(p_bundle -> 'booking_services') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Smart Card booking_services must be a JSON array';
    END IF;

    v_keep_ids := ARRAY[]::uuid[];
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_bundle -> 'booking_services') LOOP
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card booking service must be a JSON object';
      END IF;

      v_item_id := NULL;
      IF NULLIF(btrim(v_item ->> 'id'), '') IS NOT NULL THEN
        BEGIN v_item_id := (v_item ->> 'id')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN v_item_id := NULL;
        END;
      END IF;

      v_item_exists := false;
      IF v_item_id IS NOT NULL THEN
        SELECT service_row.card_id INTO v_parent_id
        FROM public.business_card_booking_services AS service_row
        WHERE service_row.id = v_item_id;
        IF FOUND THEN
          IF v_parent_id IS DISTINCT FROM v_card_id THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A submitted booking service belongs to another Smart Card';
          END IF;
          IF v_item_id = ANY(v_keep_ids) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A Smart Card booking service id was submitted more than once';
          END IF;
          v_item_exists := true;
        ELSE
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'A submitted Smart Card booking service is stale; reload before saving';
        END IF;
      END IF;

      IF (NOT v_item_exists OR v_item ? 'name') AND NULLIF(btrim(v_item ->> 'name'), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card booking service requires a name';
      END IF;

      v_service_id_supplied := v_item ? 'service_id';
      v_service_id := NULL;
      IF v_service_id_supplied AND NULLIF(btrim(v_item ->> 'service_id'), '') IS NOT NULL THEN
        BEGIN
          v_service_id := (v_item ->> 'service_id')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Booking service service_id must be a UUID or null';
        END;
      END IF;

      IF NOT v_has_service_id_column AND v_service_id IS NOT NULL THEN
        RAISE EXCEPTION USING
          ERRCODE = '0A000',
          MESSAGE = 'Booking service service_id requires the business services migration';
      END IF;

      IF v_item_exists THEN
        UPDATE public.business_card_booking_services AS service_row
        SET
          name = CASE WHEN v_item ? 'name' THEN btrim(v_item ->> 'name') ELSE service_row.name END,
          description = CASE WHEN v_item ? 'description' THEN NULLIF(btrim(v_item ->> 'description'), '') ELSE service_row.description END,
          duration_minutes = CASE WHEN v_item ? 'duration_minutes' THEN NULLIF(v_item ->> 'duration_minutes', '')::integer ELSE service_row.duration_minutes END,
          sort_order = CASE WHEN v_item ? 'sort_order' THEN COALESCE((v_item ->> 'sort_order')::integer, 0) ELSE service_row.sort_order END,
          is_active = CASE WHEN v_item ? 'is_active' THEN COALESCE((v_item ->> 'is_active')::boolean, true) ELSE service_row.is_active END
        WHERE service_row.id = v_item_id
          AND service_row.card_id = v_card_id
        RETURNING service_row.id INTO v_updated_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A Smart Card booking service could not be updated';
        END IF;

        IF v_has_service_id_column AND v_service_id_supplied THEN
          v_updated_id := NULL;
          EXECUTE
            'UPDATE public.business_card_booking_services
             SET service_id = $1
             WHERE id = $2 AND card_id = $3
             RETURNING id'
          INTO v_updated_id
          USING v_service_id, v_item_id, v_card_id;
          IF v_updated_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A Smart Card booking service mapping could not be updated';
          END IF;
        END IF;
      ELSIF v_has_service_id_column AND v_service_id IS NOT NULL THEN
        EXECUTE
          'INSERT INTO public.business_card_booking_services
             (card_id, owner_id, service_id, name, description, duration_minutes, sort_order, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id'
        INTO v_item_id
        USING
          v_card_id,
          v_user_id,
          v_service_id,
          btrim(v_item ->> 'name'),
          NULLIF(btrim(v_item ->> 'description'), ''),
          NULLIF(v_item ->> 'duration_minutes', '')::integer,
          COALESCE((v_item ->> 'sort_order')::integer, 0),
          COALESCE((v_item ->> 'is_active')::boolean, true);
      ELSE
        INSERT INTO public.business_card_booking_services (
          card_id, owner_id, name, description, duration_minutes, sort_order, is_active
        ) VALUES (
          v_card_id,
          v_user_id,
          btrim(v_item ->> 'name'),
          NULLIF(btrim(v_item ->> 'description'), ''),
          NULLIF(v_item ->> 'duration_minutes', '')::integer,
          COALESCE((v_item ->> 'sort_order')::integer, 0),
          COALESCE((v_item ->> 'is_active')::boolean, true)
        )
        RETURNING id INTO v_item_id;
      END IF;

      v_keep_ids := array_append(v_keep_ids, v_item_id);
    END LOOP;

    DELETE FROM public.business_card_booking_services AS service_row
    WHERE service_row.card_id = v_card_id
      AND NOT (service_row.id = ANY(v_keep_ids));
  END IF;

  -- Marketing assets -------------------------------------------------------
  IF p_bundle ? 'marketing_assets' THEN
    IF jsonb_typeof(p_bundle -> 'marketing_assets') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Smart Card marketing_assets must be a JSON array';
    END IF;

    v_keep_ids := ARRAY[]::uuid[];
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_bundle -> 'marketing_assets') LOOP
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card marketing asset must be a JSON object';
      END IF;

      v_item_id := NULL;
      IF NULLIF(btrim(v_item ->> 'id'), '') IS NOT NULL THEN
        BEGIN v_item_id := (v_item ->> 'id')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN v_item_id := NULL;
        END;
      END IF;

      v_item_exists := false;
      IF v_item_id IS NOT NULL THEN
        SELECT asset_row.smart_card_id INTO v_parent_id
        FROM public.business_marketing_assets AS asset_row
        WHERE asset_row.id = v_item_id;
        IF FOUND THEN
          IF v_parent_id IS DISTINCT FROM v_card_id THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A submitted marketing asset belongs to another Smart Card';
          END IF;
          IF v_item_id = ANY(v_keep_ids) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A Smart Card marketing asset id was submitted more than once';
          END IF;
          v_item_exists := true;
        ELSE
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'A submitted Smart Card marketing asset is stale; reload before saving';
        END IF;
      END IF;

      IF (NOT v_item_exists OR v_item ? 'asset_type') AND NULLIF(btrim(v_item ->> 'asset_type'), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card marketing asset requires an asset_type';
      END IF;
      IF (NOT v_item_exists OR v_item ? 'title') AND NULLIF(btrim(v_item ->> 'title'), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card marketing asset requires a title';
      END IF;

      IF v_item ? 'business_id' THEN
        IF NULLIF(btrim(v_item ->> 'business_id'), '') IS NULL THEN
          v_item_business_id := NULL;
        ELSE
          BEGIN
            v_item_business_id := (v_item ->> 'business_id')::uuid;
          EXCEPTION WHEN invalid_text_representation THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Marketing asset business_id must be a UUID or null';
          END;
        END IF;
      ELSE
        v_item_business_id := v_business_id;
      END IF;

      IF v_item_business_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.businesses AS business_row
        WHERE business_row.id = v_item_business_id
          AND business_row.owner_user_id = v_user_id
      ) THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A marketing asset references a Business Hub not owned by this user';
      END IF;

      IF v_item_exists THEN
        UPDATE public.business_marketing_assets AS asset_row
        SET
          business_id = CASE WHEN v_item ? 'business_id' THEN v_item_business_id ELSE asset_row.business_id END,
          owner_id = v_user_id,
          asset_type = CASE WHEN v_item ? 'asset_type' THEN btrim(v_item ->> 'asset_type') ELSE asset_row.asset_type END,
          title = CASE WHEN v_item ? 'title' THEN btrim(v_item ->> 'title') ELSE asset_row.title END,
          description = CASE WHEN v_item ? 'description' THEN NULLIF(btrim(v_item ->> 'description'), '') ELSE asset_row.description END,
          file_url = CASE WHEN v_item ? 'file_url' THEN NULLIF(btrim(v_item ->> 'file_url'), '') ELSE asset_row.file_url END,
          external_url = CASE WHEN v_item ? 'external_url' THEN NULLIF(btrim(v_item ->> 'external_url'), '') ELSE asset_row.external_url END,
          thumbnail_url = CASE WHEN v_item ? 'thumbnail_url' THEN NULLIF(btrim(v_item ->> 'thumbnail_url'), '') ELSE asset_row.thumbnail_url END,
          provider = CASE WHEN v_item ? 'provider' THEN NULLIF(btrim(v_item ->> 'provider'), '') ELSE asset_row.provider END,
          provider_asset_id = CASE WHEN v_item ? 'provider_asset_id' THEN NULLIF(btrim(v_item ->> 'provider_asset_id'), '') ELSE asset_row.provider_asset_id END,
          mime_type = CASE WHEN v_item ? 'mime_type' THEN NULLIF(btrim(v_item ->> 'mime_type'), '') ELSE asset_row.mime_type END,
          file_size_bytes = CASE WHEN v_item ? 'file_size_bytes' THEN NULLIF(v_item ->> 'file_size_bytes', '')::bigint ELSE asset_row.file_size_bytes END,
          sort_order = CASE WHEN v_item ? 'sort_order' THEN COALESCE((v_item ->> 'sort_order')::integer, 0) ELSE asset_row.sort_order END,
          is_active = CASE WHEN v_item ? 'is_active' THEN COALESCE((v_item ->> 'is_active')::boolean, true) ELSE asset_row.is_active END
        WHERE asset_row.id = v_item_id
          AND asset_row.smart_card_id = v_card_id
          AND asset_row.owner_id = v_user_id
        RETURNING asset_row.id INTO v_updated_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A Smart Card marketing asset could not be updated';
        END IF;
      ELSE
        INSERT INTO public.business_marketing_assets (
          business_id, smart_card_id, owner_id, asset_type, title, description,
          file_url, external_url, thumbnail_url, provider, provider_asset_id,
          mime_type, file_size_bytes, sort_order, is_active
        ) VALUES (
          v_item_business_id,
          v_card_id,
          v_user_id,
          btrim(v_item ->> 'asset_type'),
          btrim(v_item ->> 'title'),
          NULLIF(btrim(v_item ->> 'description'), ''),
          NULLIF(btrim(v_item ->> 'file_url'), ''),
          NULLIF(btrim(v_item ->> 'external_url'), ''),
          NULLIF(btrim(v_item ->> 'thumbnail_url'), ''),
          NULLIF(btrim(v_item ->> 'provider'), ''),
          NULLIF(btrim(v_item ->> 'provider_asset_id'), ''),
          NULLIF(btrim(v_item ->> 'mime_type'), ''),
          NULLIF(v_item ->> 'file_size_bytes', '')::bigint,
          COALESCE((v_item ->> 'sort_order')::integer, 0),
          COALESCE((v_item ->> 'is_active')::boolean, true)
        )
        RETURNING id INTO v_item_id;
      END IF;

      v_keep_ids := array_append(v_keep_ids, v_item_id);
    END LOOP;

    DELETE FROM public.business_marketing_assets AS asset_row
    WHERE asset_row.smart_card_id = v_card_id
      AND asset_row.owner_id = v_user_id
      AND NOT (asset_row.id = ANY(v_keep_ids));
  END IF;

  -- Before/after items -----------------------------------------------------
  IF p_bundle ? 'before_after_items' THEN
    IF jsonb_typeof(p_bundle -> 'before_after_items') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Smart Card before_after_items must be a JSON array';
    END IF;

    v_keep_ids := ARRAY[]::uuid[];
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_bundle -> 'before_after_items') LOOP
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card before/after item must be a JSON object';
      END IF;

      v_item_id := NULL;
      IF NULLIF(btrim(v_item ->> 'id'), '') IS NOT NULL THEN
        BEGIN v_item_id := (v_item ->> 'id')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN v_item_id := NULL;
        END;
      END IF;

      v_item_exists := false;
      IF v_item_id IS NOT NULL THEN
        SELECT item_row.card_id INTO v_parent_id
        FROM public.business_card_before_after_items AS item_row
        WHERE item_row.id = v_item_id;
        IF FOUND THEN
          IF v_parent_id IS DISTINCT FROM v_card_id THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A submitted before/after item belongs to another Smart Card';
          END IF;
          IF v_item_id = ANY(v_keep_ids) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A Smart Card before/after item id was submitted more than once';
          END IF;
          v_item_exists := true;
        ELSE
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'A submitted Smart Card before/after item is stale; reload before saving';
        END IF;
      END IF;

      IF (NOT v_item_exists OR v_item ? 'title') AND NULLIF(btrim(v_item ->> 'title'), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each before/after item requires a title';
      END IF;
      IF (NOT v_item_exists OR v_item ? 'before_image_url') AND NULLIF(btrim(v_item ->> 'before_image_url'), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each before/after item requires a before image URL';
      END IF;
      IF (NOT v_item_exists OR v_item ? 'after_image_url') AND NULLIF(btrim(v_item ->> 'after_image_url'), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each before/after item requires an after image URL';
      END IF;

      IF v_item_exists THEN
        UPDATE public.business_card_before_after_items AS item_row
        SET
          owner_id = v_user_id,
          title = CASE WHEN v_item ? 'title' THEN btrim(v_item ->> 'title') ELSE item_row.title END,
          description = CASE WHEN v_item ? 'description' THEN NULLIF(btrim(v_item ->> 'description'), '') ELSE item_row.description END,
          before_image_url = CASE WHEN v_item ? 'before_image_url' THEN btrim(v_item ->> 'before_image_url') ELSE item_row.before_image_url END,
          after_image_url = CASE WHEN v_item ? 'after_image_url' THEN btrim(v_item ->> 'after_image_url') ELSE item_row.after_image_url END,
          before_image_id = CASE WHEN v_item ? 'before_image_id' THEN NULLIF(btrim(v_item ->> 'before_image_id'), '') ELSE item_row.before_image_id END,
          after_image_id = CASE WHEN v_item ? 'after_image_id' THEN NULLIF(btrim(v_item ->> 'after_image_id'), '') ELSE item_row.after_image_id END,
          sort_order = CASE WHEN v_item ? 'sort_order' THEN COALESCE((v_item ->> 'sort_order')::integer, 0) ELSE item_row.sort_order END,
          is_active = CASE WHEN v_item ? 'is_active' THEN COALESCE((v_item ->> 'is_active')::boolean, true) ELSE item_row.is_active END
        WHERE item_row.id = v_item_id
          AND item_row.card_id = v_card_id
          AND item_row.owner_id = v_user_id
        RETURNING item_row.id INTO v_updated_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A Smart Card before/after item could not be updated';
        END IF;
      ELSE
        INSERT INTO public.business_card_before_after_items (
          card_id, owner_id, title, description, before_image_url, after_image_url,
          before_image_id, after_image_id, sort_order, is_active
        ) VALUES (
          v_card_id,
          v_user_id,
          btrim(v_item ->> 'title'),
          NULLIF(btrim(v_item ->> 'description'), ''),
          btrim(v_item ->> 'before_image_url'),
          btrim(v_item ->> 'after_image_url'),
          NULLIF(btrim(v_item ->> 'before_image_id'), ''),
          NULLIF(btrim(v_item ->> 'after_image_id'), ''),
          COALESCE((v_item ->> 'sort_order')::integer, 0),
          COALESCE((v_item ->> 'is_active')::boolean, true)
        )
        RETURNING id INTO v_item_id;
      END IF;

      v_keep_ids := array_append(v_keep_ids, v_item_id);
    END LOOP;

    DELETE FROM public.business_card_before_after_items AS item_row
    WHERE item_row.card_id = v_card_id
      AND item_row.owner_id = v_user_id
      AND NOT (item_row.id = ANY(v_keep_ids));
  END IF;

  -- Testimonials -----------------------------------------------------------
  IF p_bundle ? 'testimonials' THEN
    IF jsonb_typeof(p_bundle -> 'testimonials') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Smart Card testimonials must be a JSON array';
    END IF;

    v_keep_ids := ARRAY[]::uuid[];
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_bundle -> 'testimonials') LOOP
      IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each Smart Card testimonial must be a JSON object';
      END IF;

      v_item_id := NULL;
      IF NULLIF(btrim(v_item ->> 'id'), '') IS NOT NULL THEN
        BEGIN v_item_id := (v_item ->> 'id')::uuid;
        EXCEPTION WHEN invalid_text_representation THEN v_item_id := NULL;
        END;
      END IF;

      v_item_exists := false;
      IF v_item_id IS NOT NULL THEN
        SELECT testimonial_row.card_id INTO v_parent_id
        FROM public.business_card_testimonials AS testimonial_row
        WHERE testimonial_row.id = v_item_id;
        IF FOUND THEN
          IF v_parent_id IS DISTINCT FROM v_card_id THEN
            RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A submitted testimonial belongs to another Smart Card';
          END IF;
          IF v_item_id = ANY(v_keep_ids) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A Smart Card testimonial id was submitted more than once';
          END IF;
          v_item_exists := true;
        ELSE
          RAISE EXCEPTION USING ERRCODE = '40001', MESSAGE = 'A submitted Smart Card testimonial is stale; reload before saving';
        END IF;
      END IF;

      IF (NOT v_item_exists OR v_item ? 'customer_name') AND NULLIF(btrim(v_item ->> 'customer_name'), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each testimonial requires a customer_name';
      END IF;
      IF (NOT v_item_exists OR v_item ? 'quote') AND NULLIF(btrim(v_item ->> 'quote'), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Each testimonial requires a quote';
      END IF;

      IF v_item_exists THEN
        UPDATE public.business_card_testimonials AS testimonial_row
        SET
          owner_id = v_user_id,
          customer_name = CASE WHEN v_item ? 'customer_name' THEN btrim(v_item ->> 'customer_name') ELSE testimonial_row.customer_name END,
          rating = CASE WHEN v_item ? 'rating' THEN NULLIF(v_item ->> 'rating', '')::integer ELSE testimonial_row.rating END,
          quote = CASE WHEN v_item ? 'quote' THEN btrim(v_item ->> 'quote') ELSE testimonial_row.quote END,
          image_url = CASE WHEN v_item ? 'image_url' THEN NULLIF(btrim(v_item ->> 'image_url'), '') ELSE testimonial_row.image_url END,
          video_url = CASE WHEN v_item ? 'video_url' THEN NULLIF(btrim(v_item ->> 'video_url'), '') ELSE testimonial_row.video_url END,
          source = CASE WHEN v_item ? 'source' THEN NULLIF(btrim(v_item ->> 'source'), '') ELSE testimonial_row.source END,
          sort_order = CASE WHEN v_item ? 'sort_order' THEN COALESCE((v_item ->> 'sort_order')::integer, 0) ELSE testimonial_row.sort_order END,
          is_active = CASE WHEN v_item ? 'is_active' THEN COALESCE((v_item ->> 'is_active')::boolean, true) ELSE testimonial_row.is_active END
        WHERE testimonial_row.id = v_item_id
          AND testimonial_row.card_id = v_card_id
          AND testimonial_row.owner_id = v_user_id
        RETURNING testimonial_row.id INTO v_updated_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'A Smart Card testimonial could not be updated';
        END IF;
      ELSE
        INSERT INTO public.business_card_testimonials (
          card_id, owner_id, customer_name, rating, quote, image_url, video_url,
          source, sort_order, is_active
        ) VALUES (
          v_card_id,
          v_user_id,
          btrim(v_item ->> 'customer_name'),
          NULLIF(v_item ->> 'rating', '')::integer,
          btrim(v_item ->> 'quote'),
          NULLIF(btrim(v_item ->> 'image_url'), ''),
          NULLIF(btrim(v_item ->> 'video_url'), ''),
          NULLIF(btrim(v_item ->> 'source'), ''),
          COALESCE((v_item ->> 'sort_order')::integer, 0),
          COALESCE((v_item ->> 'is_active')::boolean, true)
        )
        RETURNING id INTO v_item_id;
      END IF;

      v_keep_ids := array_append(v_keep_ids, v_item_id);
    END LOOP;

    DELETE FROM public.business_card_testimonials AS testimonial_row
    WHERE testimonial_row.card_id = v_card_id
      AND testimonial_row.owner_id = v_user_id
      AND NOT (testimonial_row.id = ANY(v_keep_ids));
  END IF;

  RETURN jsonb_build_object(
    'schema_version', 1,
    'card', to_jsonb(v_saved_card),
    'links', (
      SELECT COALESCE(jsonb_agg(to_jsonb(link_row) ORDER BY link_row.sort_order, link_row.created_at, link_row.id), '[]'::jsonb)
      FROM public.business_card_links AS link_row
      WHERE link_row.business_card_id = v_card_id
    ),
    'offers', (
      SELECT COALESCE(jsonb_agg(to_jsonb(offer_row) ORDER BY offer_row.created_at DESC, offer_row.id), '[]'::jsonb)
      FROM public.business_card_offers AS offer_row
      WHERE offer_row.business_card_id = v_card_id
    ),
    'gallery', (
      SELECT COALESCE(jsonb_agg(to_jsonb(gallery_row) ORDER BY gallery_row.sort_order, gallery_row.created_at, gallery_row.id), '[]'::jsonb)
      FROM public.business_card_gallery_items AS gallery_row
      WHERE gallery_row.card_id = v_card_id
    ),
    'booking_services', (
      SELECT COALESCE(jsonb_agg(to_jsonb(service_row) ORDER BY service_row.sort_order, service_row.created_at, service_row.id), '[]'::jsonb)
      FROM public.business_card_booking_services AS service_row
      WHERE service_row.card_id = v_card_id
    ),
    'marketing_assets', (
      SELECT COALESCE(jsonb_agg(to_jsonb(asset_row) ORDER BY asset_row.sort_order, asset_row.created_at, asset_row.id), '[]'::jsonb)
      FROM public.business_marketing_assets AS asset_row
      WHERE asset_row.smart_card_id = v_card_id
    ),
    'before_after_items', (
      SELECT COALESCE(jsonb_agg(to_jsonb(item_row) ORDER BY item_row.sort_order, item_row.created_at, item_row.id), '[]'::jsonb)
      FROM public.business_card_before_after_items AS item_row
      WHERE item_row.card_id = v_card_id
    ),
    'testimonials', (
      SELECT COALESCE(jsonb_agg(to_jsonb(testimonial_row) ORDER BY testimonial_row.sort_order, testimonial_row.created_at, testimonial_row.id), '[]'::jsonb)
      FROM public.business_card_testimonials AS testimonial_row
      WHERE testimonial_row.card_id = v_card_id
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_smart_card_bundle(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_smart_card_bundle(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_smart_card_bundle(jsonb) TO authenticated;

COMMENT ON FUNCTION public.save_smart_card_bundle(jsonb) IS
  'Atomically creates or updates an authenticated owner Smart Card and reconciles submitted child collection snapshots without recreating retained rows.';
