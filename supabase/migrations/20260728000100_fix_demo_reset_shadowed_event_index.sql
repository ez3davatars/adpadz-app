-- Remove the explicit `event_index integer` declaration from reset_demo_workspace.
-- The three FOR loops auto-declare event_index as their loop variable, making
-- the DECLARE-block entry both shadowed and unused (plpgsql lint warnings).
CREATE OR REPLACE FUNCTION "public"."reset_demo_workspace"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
<<demo_reset>>
DECLARE
  actor_id uuid := auth.uid();
  reset_at timestamptz := clock_timestamp();
  account public.demo_accounts%ROWTYPE;
  slug_suffix text;
  business_slug text;
  card_slug text;
  profile_qr_slug text;
  campaign_qr_slug text;

  business_id uuid;
  card_id uuid;
  offer_id uuid;
  consultation_service_id uuid;
  project_service_id uuid;
  refresh_service_id uuid;
  consultation_placement_id uuid;
  project_placement_id uuid;
  refresh_placement_id uuid;
  cover_asset_id uuid;
  gallery_asset_id uuid;
  detail_asset_id uuid;
  campaign_id uuid;
  scheduled_campaign_id uuid;
  profile_qr_id uuid;
  campaign_qr_id uuid;

  fixture_marker text := 'river-city';
  event_name text;
  event_offer_id uuid;
  event_qr_id uuid;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required to reset the demo workspace'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_demo_account() THEN
    RAISE EXCEPTION 'This account is not registered as an active Adpadz demo account'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'adpadz:reset-demo-workspace:' || actor_id::text,
    0
  ));

  SELECT *
  INTO account
  FROM public.demo_accounts AS demo
  WHERE demo.user_id = actor_id
    AND demo.is_active IS TRUE
    AND demo.fixture_key = 'river-city'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The demo account registration changed; sign in again and retry'
      USING ERRCODE = '42501';
  END IF;

  IF account.last_reset_at IS NOT NULL
     AND account.last_reset_at > reset_at - interval '10 seconds' THEN
    RAISE EXCEPTION 'The demo workspace was just reset. Wait 10 seconds before resetting it again.'
      USING ERRCODE = '55000';
  END IF;

  -- Keep public paths stable across resets without exposing the Auth user UUID.
  slug_suffix := substr(
    md5(actor_id::text || ':adpadz-river-city-demo'),
    1,
    24
  );
  business_slug := 'river-city-outdoor-living-' || slug_suffix;
  card_slug := business_slug;
  profile_qr_slug := 'river-city-profile-' || slug_suffix;
  campaign_qr_slug := 'river-city-summer-' || slug_suffix;

  -- Deterministic per-account IDs keep every returned public path stable
  -- across resets while remaining unguessable without the private Auth UUID.
  business_id := md5(actor_id::text || ':river-city:business')::uuid;
  card_id := md5(actor_id::text || ':river-city:card')::uuid;
  offer_id := md5(actor_id::text || ':river-city:offer')::uuid;
  consultation_service_id := md5(actor_id::text || ':river-city:service:consultation')::uuid;
  project_service_id := md5(actor_id::text || ':river-city:service:project')::uuid;
  refresh_service_id := md5(actor_id::text || ':river-city:service:refresh')::uuid;
  consultation_placement_id := md5(actor_id::text || ':river-city:placement:consultation')::uuid;
  project_placement_id := md5(actor_id::text || ':river-city:placement:project')::uuid;
  refresh_placement_id := md5(actor_id::text || ':river-city:placement:refresh')::uuid;
  cover_asset_id := md5(actor_id::text || ':river-city:asset:cover')::uuid;
  gallery_asset_id := md5(actor_id::text || ':river-city:asset:gallery')::uuid;
  detail_asset_id := md5(actor_id::text || ':river-city:asset:detail')::uuid;
  campaign_id := md5(actor_id::text || ':river-city:campaign:summer')::uuid;
  scheduled_campaign_id := md5(actor_id::text || ':river-city:campaign:firelight')::uuid;
  profile_qr_id := md5(actor_id::text || ':river-city:qr:profile')::uuid;
  campaign_qr_id := md5(actor_id::text || ':river-city:qr:summer')::uuid;

  -- Delete only rows owned by this registered account. Parent-first cleanup is
  -- deliberately ordered around the final schema: campaigns release output
  -- and primary-resource references, cards cascade through their modules,
  -- QR links cascade through scan history, and the Hub is removed last.
  DELETE FROM public.campaigns
  WHERE owner_id = actor_id;

  DELETE FROM public.interactive_ads
  WHERE owner_user_id = actor_id;

  DELETE FROM public.business_cards
  WHERE owner_user_id = actor_id;

  DELETE FROM public.qr_links
  WHERE owner_user_id = actor_id;

  DELETE FROM public.business_marketing_assets
  WHERE owner_id = actor_id;

  DELETE FROM public.business_services
  WHERE owner_id = actor_id;

  DELETE FROM public.businesses
  WHERE owner_user_id = actor_id;

  INSERT INTO public.businesses (
    id,
    owner_user_id,
    name,
    slug,
    description,
    phone,
    email,
    website,
    address,
    active,
    created_at,
    updated_at
  ) VALUES (
    business_id,
    actor_id,
    'River City Outdoor Living',
    business_slug,
    'River City Outdoor Living is a fictional Adpadz showcase company helping Jacksonville homeowners create patios, outdoor kitchens, lighting plans, and gathering spaces designed for real life.',
    '(904) 555-0148',
    'hello@rivercityoutdoor.example',
    'https://adpadz.co/examples',
    '100 Demo Way, Jacksonville, FL 32202',
    true,
    reset_at - interval '14 months',
    reset_at
  );

  INSERT INTO public.business_cards (
    id,
    owner_user_id,
    business_id,
    business_name,
    slug,
    tagline,
    cover_image_url,
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
    cover_fit,
    cover_position_x,
    cover_position_y,
    cover_zoom,
    cover_overlay_opacity,
    featured_video_enabled,
    booking_enabled,
    booking_mode,
    booking_label,
    booking_provider,
    booking_request_enabled,
    booking_request_title,
    booking_request_description,
    booking_request_button_label,
    lead_form_enabled,
    lead_form_title,
    lead_form_description,
    lead_form_button_label,
    created_at,
    updated_at
  ) VALUES (
    card_id,
    actor_id,
    business_id,
    'River City Outdoor Living',
    card_slug,
    'Thoughtful outdoor spaces, built for the way you live.',
    'https://adpadz.co/demo/river-city-hero.svg',
    '(904) 555-0148',
    'hello@rivercityoutdoor.example',
    'https://adpadz.co/examples',
    '100 Demo Way, Jacksonville, FL 32202',
    'https://www.google.com/maps/search/?api=1&query=Jacksonville%2C+FL',
    'A fictional Adpadz showcase for a premium local outdoor design-and-build company.',
    'fresh-service',
    'home_services',
    '#B6FF00',
    '#14B8A6',
    true,
    'cover',
    50,
    48,
    1.05,
    68,
    false,
    true,
    'request',
    'Plan My Outdoor Space',
    'Adpadz Request',
    true,
    'Request an Outdoor Design Consultation',
    'Tell us how you want to use your outdoor space and choose a preferred time.',
    'Request My Consultation',
    true,
    'Start Your Backyard Story',
    'Share a few details and River City will recommend the best outdoor project next step.',
    'Get My Recommendation',
    reset_at - interval '14 months',
    reset_at
  );

  INSERT INTO public.business_card_links (
    business_card_id,
    label,
    url,
    sort_order,
    is_active
  ) VALUES
    (card_id, 'Design inspiration', 'https://www.houzz.com/', 0, true),
    (card_id, 'Follow the studio', 'https://www.instagram.com/', 1, true),
    (card_id, 'Outdoor living resources', 'https://www.thisoldhouse.com/yards/', 2, true);

  INSERT INTO public.business_card_offers (
    id,
    business_card_id,
    title,
    description,
    claim_url,
    starts_at,
    ends_at,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    offer_id,
    card_id,
    'Complimentary Outdoor Design Consultation',
    'Receive a 30-minute discovery call and a personalized project inspiration board for a qualifying patio or outdoor-kitchen project.',
    NULL,
    reset_at - interval '7 days',
    reset_at + interval '60 days',
    true,
    reset_at - interval '7 days',
    reset_at
  );

  INSERT INTO public.business_card_gallery_items (
    card_id,
    image_url,
    caption,
    sort_order,
    is_active,
    fit,
    position_x,
    position_y,
    zoom
  ) VALUES
    (
      card_id,
      'https://adpadz.co/demo/river-city-hero.svg',
      'A layered entertaining space designed for easy family weekends.',
      0,
      true,
      'cover',
      50,
      50,
      1
    ),
    (
      card_id,
      'https://adpadz.co/demo/river-city-after.svg',
      'Warm wood, soft stone, and durable finishes for indoor-outdoor flow.',
      1,
      true,
      'cover',
      50,
      50,
      1
    ),
    (
      card_id,
      'https://adpadz.co/demo/river-city-before.svg',
      'An outdoor-kitchen material story built around flow and conversation.',
      2,
      true,
      'cover',
      50,
      50,
      1
    );

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
  ) VALUES
    (
      consultation_service_id,
      business_id,
      actor_id,
      'Design Direction Session',
      'A focused in-home or virtual session with a prioritized design plan.',
      75,
      195,
      'USD',
      NULL,
      true,
      0,
      reset_at - interval '10 months',
      reset_at
    ),
    (
      project_service_id,
      business_id,
      actor_id,
      'Patio & Outdoor Kitchen Concept',
      'A complete concept including layout, material direction, gathering zones, and project priorities.',
      120,
      495,
      'USD',
      NULL,
      true,
      1,
      reset_at - interval '9 months',
      reset_at
    ),
    (
      refresh_service_id,
      business_id,
      actor_id,
      'Backyard Possibility Walkthrough',
      'A practical site review with high-impact outdoor recommendations in priority order.',
      60,
      165,
      'USD',
      NULL,
      true,
      2,
      reset_at - interval '8 months',
      reset_at
    );

  INSERT INTO public.business_card_booking_services (
    id,
    card_id,
    owner_id,
    service_id,
    name,
    is_active,
    sort_order
  ) VALUES
    (consultation_placement_id, card_id, actor_id, consultation_service_id, 'Design Direction Session', true, 0),
    (project_placement_id, card_id, actor_id, project_service_id, 'Patio & Outdoor Kitchen Concept', true, 1),
    (refresh_placement_id, card_id, actor_id, refresh_service_id, 'Backyard Possibility Walkthrough', true, 2);

  INSERT INTO public.business_marketing_assets (
    id,
    business_id,
    smart_card_id,
    owner_id,
    asset_type,
    title,
    description,
    file_url,
    thumbnail_url,
    provider,
    sort_order,
    is_active,
    created_at,
    updated_at
  ) VALUES
    (
      cover_asset_id,
      business_id,
      card_id,
      actor_id,
      'cover',
      'River City signature outdoor retreat',
      'Primary campaign and Business Profile image.',
      'https://adpadz.co/demo/river-city-hero.svg',
      'https://adpadz.co/demo/river-city-hero.svg',
      'demo-fixture',
      0,
      true,
      reset_at - interval '6 months',
      reset_at
    ),
    (
      gallery_asset_id,
      business_id,
      card_id,
      actor_id,
      'gallery',
      'Warm modern gathering space',
      'Campaign-ready outdoor-lifestyle image.',
      'https://adpadz.co/demo/river-city-after.svg',
      'https://adpadz.co/demo/river-city-after.svg',
      'demo-fixture',
      1,
      true,
      reset_at - interval '5 months',
      reset_at
    ),
    (
      detail_asset_id,
      business_id,
      card_id,
      actor_id,
      'image',
      'Outdoor-kitchen material story',
      'Secondary image for social and print previews.',
      'https://adpadz.co/demo/river-city-before.svg',
      'https://adpadz.co/demo/river-city-before.svg',
      'demo-fixture',
      2,
      true,
      reset_at - interval '4 months',
      reset_at
    );

  INSERT INTO public.business_card_before_after_items (
    card_id,
    owner_id,
    title,
    description,
    before_image_url,
    after_image_url,
    is_active,
    sort_order,
    created_at,
    updated_at
  ) VALUES (
    card_id,
    actor_id,
    'From overlooked yard to unforgettable gathering space',
    'A fictional example showing how layout, light, planting, and material choices can completely change an outdoor space.',
    'https://adpadz.co/demo/river-city-before.svg',
    'https://adpadz.co/demo/river-city-after.svg',
    true,
    0,
    reset_at - interval '4 months',
    reset_at
  );

  INSERT INTO public.business_card_testimonials (
    card_id,
    owner_id,
    customer_name,
    rating,
    quote,
    source,
    is_active,
    sort_order,
    created_at,
    updated_at
  ) VALUES
    (
      card_id,
      actor_id,
      'Ava M. — fictional homeowner',
      5,
      'The patio plan felt elevated but still completely like us. Every recommendation had a clear reason.',
      'Adpadz showcase',
      true,
      0,
      reset_at - interval '3 months',
      reset_at
    ),
    (
      card_id,
      actor_id,
      'Marcus T. — fictional homeowner',
      5,
      'We stopped second-guessing every decision and finally had a backyard that works for the whole family.',
      'Adpadz showcase',
      true,
      1,
      reset_at - interval '2 months',
      reset_at
    ),
    (
      card_id,
      actor_id,
      'Priya S. — fictional homeowner',
      5,
      'River City found the high-impact changes first, which made the budget go much further.',
      'Adpadz showcase',
      true,
      2,
      reset_at - interval '1 month',
      reset_at
    );

  INSERT INTO public.campaigns (
    id,
    business_id,
    owner_id,
    title,
    headline,
    description,
    offer_title,
    offer_description,
    cta_label,
    cta_url,
    status,
    start_date,
    end_date,
    primary_image_id,
    primary_video_id,
    primary_qr_id,
    created_at,
    updated_at
  ) VALUES (
    campaign_id,
    business_id,
    actor_id,
    'Demo - Summer Patio Transformation',
    'Demo showcase: turn the patio you have into the retreat you want.',
    'A connected local campaign that turns one River City offer into an interactive ad, Business Profile feature, QR landing experience, social copy, email, flyer, and neighborhood mailer.',
    'Complimentary Outdoor Design Consultation',
    'Includes a 30-minute discovery call and a personalized project inspiration board.',
    'Plan My Outdoor Space',
    NULL,
    'active',
    reset_at - interval '7 days',
    reset_at + interval '60 days',
    cover_asset_id,
    NULL,
    NULL,
    reset_at - interval '7 days',
    reset_at
  );

  INSERT INTO public.campaign_outputs (
    campaign_id,
    output_type,
    enabled,
    sort_order,
    metadata
  ) VALUES
    (
      campaign_id,
      'interactive_ad',
      true,
      0,
      jsonb_build_object(
        'format', 'tap_reveal',
        'tone', 'premium-local',
        'secondary_image_url', 'https://adpadz.co/demo/river-city-after.svg'
      )
    ),
    (
      campaign_id,
      'smart_card',
      true,
      1,
      jsonb_build_object(
        'smart_card_id', card_id::text,
        'section', 'promotions',
        'format', 'featured_offer'
      )
    ),
    (campaign_id, 'qr_landing', true, 2, jsonb_build_object('channel', 'qr_landing', 'prepared_from_campaign', true)),
    (campaign_id, 'community_mailer', true, 3, jsonb_build_object('channel', 'community_mailer', 'prepared_from_campaign', true)),
    (campaign_id, 'facebook', true, 4, jsonb_build_object('channel', 'facebook', 'prepared_from_campaign', true)),
    (campaign_id, 'instagram', true, 5, jsonb_build_object('channel', 'instagram', 'prepared_from_campaign', true)),
    (campaign_id, 'email', true, 6, jsonb_build_object('channel', 'email', 'prepared_from_campaign', true)),
    (campaign_id, 'flyer', true, 7, jsonb_build_object('channel', 'flyer', 'prepared_from_campaign', true));

  INSERT INTO public.qr_links (
    id,
    owner_user_id,
    business_id,
    title,
    slug,
    destination_url,
    destination_type,
    destination_id,
    status,
    purpose,
    campaign_name,
    source,
    medium,
    tags,
    style_preset,
    top_ring_text,
    bottom_ring_text,
    center_label,
    foreground_color,
    background_color,
    accent_color,
    created_at,
    updated_at
  ) VALUES
    (
      profile_qr_id,
      actor_id,
      business_id,
      'River City Outdoor Living Profile',
      profile_qr_slug,
      'https://adpadz.co/c/' || card_slug,
      'business_card',
      card_id,
      'active',
      'Business Profile showcase',
      'Always-on Business Profile',
      'demo_showcase',
      'qr',
      ARRAY['demo', 'showcase', 'river-city', 'business-profile']::text[],
      'circular-pad',
      'River City Outdoor Living',
      'Scan • Explore • Start Your Backyard Story',
      'river city',
      '#111111',
      '#F4F4F1',
      '#B6FF00',
      reset_at - interval '6 months',
      reset_at
    ),
    (
      campaign_qr_id,
      actor_id,
      business_id,
      'Summer Patio Transformation Campaign',
      campaign_qr_slug,
      'https://adpadz.co/ad/' || campaign_id::text,
      'campaign',
      campaign_id,
      'active',
      'Summer patio campaign conversion path',
      'Summer Patio Transformation',
      'community_mailer',
      'qr',
      ARRAY['demo', 'showcase', 'river-city', 'summer-refresh']::text[],
      'circular-pad',
      'River City Summer Patio',
      'Scan • Reveal • Plan Your Outdoor Space',
      'adpadz',
      '#111111',
      '#F4F4F1',
      '#14B8A6',
      reset_at - interval '7 days',
      reset_at
    );

  UPDATE public.campaigns
  SET primary_qr_id = campaign_qr_id
  WHERE id = campaign_id
    AND owner_id = actor_id;

  UPDATE public.campaign_outputs AS output
  SET metadata = jsonb_set(
    metadata,
    '{qr_link_id}',
    to_jsonb(campaign_qr_id::text),
    true
  )
  WHERE output.campaign_id = demo_reset.campaign_id
    AND output.output_type = 'qr_landing';

  INSERT INTO public.campaigns (
    id,
    business_id,
    owner_id,
    title,
    headline,
    description,
    offer_title,
    offer_description,
    cta_label,
    status,
    start_date,
    end_date,
    primary_image_id,
    created_at,
    updated_at
  ) VALUES (
    scheduled_campaign_id,
    business_id,
    actor_id,
    'Demo - Firelight Season Preview',
    'Demo showcase: scratch to uncover a warmer way to gather.',
    'A prepared autumn campaign demonstrating the Adpadz scheduling lifecycle and reusable content package.',
    'Free Fire-Feature Planning Session',
    'Explore placement, fuel, finish, seating, and safety options with a project designer.',
    'Reserve a Planning Session',
    'scheduled',
    reset_at + interval '14 days',
    reset_at + interval '90 days',
    detail_asset_id,
    reset_at,
    reset_at
  );

  INSERT INTO public.campaign_outputs (
    campaign_id,
    output_type,
    enabled,
    sort_order,
    metadata
  ) VALUES
    (
      scheduled_campaign_id,
      'interactive_ad',
      true,
      0,
      jsonb_build_object('format', 'scratch', 'tone', 'helpful-expert')
    ),
    (
      scheduled_campaign_id,
      'smart_card',
      true,
      1,
      jsonb_build_object('smart_card_id', card_id::text, 'section', 'promotions')
    ),
    (scheduled_campaign_id, 'facebook', true, 2, jsonb_build_object('channel', 'facebook', 'prepared_from_campaign', true)),
    (scheduled_campaign_id, 'instagram', true, 3, jsonb_build_object('channel', 'instagram', 'prepared_from_campaign', true)),
    (scheduled_campaign_id, 'email', true, 4, jsonb_build_object('channel', 'email', 'prepared_from_campaign', true));

  -- Synthetic leads use reserved example.com addresses and explicit fictional
  -- labels. The existing validation triggers still run and normalize them.
  INSERT INTO public.business_card_leads (
    card_id,
    owner_id,
    name,
    phone,
    email,
    message,
    lead_type,
    source,
    status,
    metadata
  ) VALUES
    (
      card_id,
      actor_id,
      'Ava Morgan — fictional',
      '(904) 555-0101',
      'ava.morgan@example.com',
      'We would like a design consultation for a covered patio and outdoor kitchen.',
      'smart_card_inquiry',
      'smart_card_public',
      'new',
      jsonb_build_object('demo_fixture', fixture_marker, 'lead_order', 1)
    ),
    (
      card_id,
      actor_id,
      'Marcus Turner — fictional',
      '(904) 555-0102',
      'marcus.turner@example.com',
      'Can someone call me about the patio package featured in the QR offer?',
      'smart_card_inquiry',
      'smart_card_public',
      'new',
      jsonb_build_object('demo_fixture', fixture_marker, 'lead_order', 2)
    ),
    (
      card_id,
      actor_id,
      'Priya Shah — fictional',
      '(904) 555-0103',
      'priya.shah@example.com',
      'Looking for a focused plan before we choose pavers and outdoor furniture.',
      'smart_card_inquiry',
      'smart_card_public',
      'new',
      jsonb_build_object('demo_fixture', fixture_marker, 'lead_order', 3)
    ),
    (
      card_id,
      actor_id,
      'Elena Brooks — fictional',
      '(904) 555-0104',
      'elena.brooks@example.com',
      'We need a better gathering layout for a busy family and frequent guests.',
      'smart_card_inquiry',
      'smart_card_public',
      'new',
      jsonb_build_object('demo_fixture', fixture_marker, 'lead_order', 4)
    ),
    (
      card_id,
      actor_id,
      'Noah Williams — fictional',
      '(904) 555-0105',
      'noah.williams@example.com',
      'Interested in a patio and outdoor-kitchen concept for our new home.',
      'smart_card_inquiry',
      'smart_card_public',
      'new',
      jsonb_build_object('demo_fixture', fixture_marker, 'lead_order', 5)
    ),
    (
      card_id,
      actor_id,
      'Sofia Carter — fictional',
      '(904) 555-0106',
      'sofia.carter@example.com',
      'We would like professional direction on lighting and planting before construction.',
      'smart_card_inquiry',
      'smart_card_public',
      'new',
      jsonb_build_object('demo_fixture', fixture_marker, 'lead_order', 6)
    ),
    (
      card_id,
      actor_id,
      'Theo Bennett — fictional',
      '(904) 555-0107',
      'theo.bennett@example.com',
      'A morning virtual consultation would be ideal.',
      'booking_request',
      'smart_card_booking',
      'new',
      jsonb_build_object(
        'demo_fixture', fixture_marker,
        'lead_order', 7,
        'booking_request', true,
        'preferred_date', to_char(current_date + 3, 'YYYY-MM-DD'),
        'preferred_time', '10:30',
        'service_id', consultation_placement_id::text
      )
    ),
    (
      card_id,
      actor_id,
      'Maya Reed — fictional',
      '(904) 555-0108',
      'maya.reed@example.com',
      'We are ready to plan our main outdoor living space.',
      'booking_request',
      'smart_card_booking',
      'new',
      jsonb_build_object(
        'demo_fixture', fixture_marker,
        'lead_order', 8,
        'booking_request', true,
        'preferred_date', to_char(current_date + 6, 'YYYY-MM-DD'),
        'preferred_time', '14:00',
        'service_id', project_placement_id::text
      )
    );

  UPDATE public.business_card_leads AS lead
  SET
    status = CASE (metadata ->> 'lead_order')::integer
      WHEN 1 THEN 'new'
      WHEN 2 THEN 'contacted'
      WHEN 3 THEN 'qualified'
      WHEN 4 THEN 'closed'
      WHEN 5 THEN 'contacted'
      WHEN 6 THEN 'qualified'
      WHEN 7 THEN 'new'
      ELSE 'contacted'
    END,
    created_at = reset_at - make_interval(
      days => ((metadata ->> 'lead_order')::integer * 2),
      hours => ((metadata ->> 'lead_order')::integer % 7)
    )
  WHERE lead.card_id = demo_reset.card_id
    AND lead.metadata ->> 'demo_fixture' = fixture_marker;

  -- Coherent synthetic engagement history. Insert triggers maintain profile,
  -- offer, and QR counters; timestamps are staggered afterward for charts.
  FOR event_index IN 1..52 LOOP
    event_name := CASE
      WHEN event_index <= 24 THEN 'card_view'
      WHEN event_index <= 29 THEN 'website_click'
      WHEN event_index <= 33 THEN 'directions_click'
      WHEN event_index <= 37 THEN 'booking_click'
      WHEN event_index <= 41 THEN 'lead_submit'
      WHEN event_index <= 44 THEN 'offer_view'
      WHEN event_index <= 46 THEN 'offer_claim'
      WHEN event_index = 47 THEN 'save_contact'
      WHEN event_index = 48 THEN 'call_click'
      ELSE 'qr_scan'
    END;

    event_offer_id := CASE
      WHEN event_name IN ('offer_view', 'offer_claim') THEN offer_id
      ELSE NULL
    END;

    event_qr_id := CASE
      WHEN event_name = 'qr_scan' THEN profile_qr_id
      ELSE NULL
    END;

    INSERT INTO public.business_card_events (
      business_card_id,
      qr_link_id,
      offer_id,
      event_type,
      occurred_at,
      user_agent,
      referrer,
      metadata
    ) VALUES (
      card_id,
      event_qr_id,
      event_offer_id,
      event_name,
      reset_at,
      'Adpadz River City fixture ' || event_index::text,
      'https://adpadz.example/showcase/river-city',
      jsonb_strip_nulls(jsonb_build_object(
        'demo_fixture', fixture_marker,
        'demo_sequence', event_index,
        'day_offset', event_index % 28,
        'source', 'showcase_fixture',
        'redemption_code', CASE
          WHEN event_name = 'offer_claim'
            THEN 'ADP-' || upper(substr(md5(event_index::text), 1, 4))
              || '-' || upper(substr(md5(actor_id::text || event_index::text), 1, 6))
          ELSE NULL
        END
      ))
    );
  END LOOP;

  UPDATE public.business_card_events
  SET occurred_at = reset_at - make_interval(
    days => (metadata ->> 'day_offset')::integer,
    hours => ((metadata ->> 'demo_sequence')::integer % 9)
  )
  WHERE business_card_id = card_id
    AND metadata ->> 'demo_fixture' = fixture_marker;

  FOR event_index IN 1..60 LOOP
    event_name := CASE
      WHEN event_index <= 32 THEN 'view'
      WHEN event_index <= 42 THEN 'reveal'
      WHEN event_index <= 50 THEN 'cta_click'
      WHEN event_index <= 55 THEN 'save'
      WHEN event_index <= 58 THEN 'share'
      ELSE 'offer_claim'
    END;

    INSERT INTO public.campaign_events (
      campaign_id,
      business_card_id,
      output_type,
      event_type,
      occurred_at,
      user_agent,
      referrer,
      metadata,
      created_at
    ) VALUES (
      campaign_id,
      card_id,
      'interactive_ad',
      event_name,
      reset_at,
      'Adpadz River City campaign fixture ' || event_index::text,
      'https://adpadz.example/feed',
      jsonb_build_object(
        'demo_fixture', fixture_marker,
        'demo_sequence', event_index,
        'day_offset', event_index % 28,
        'format', 'tap_reveal'
      ),
      reset_at
    );
  END LOOP;

  UPDATE public.campaign_events AS event
  SET
    occurred_at = reset_at - make_interval(
      days => (metadata ->> 'day_offset')::integer,
      hours => ((metadata ->> 'demo_sequence')::integer % 11)
    ),
    created_at = reset_at - make_interval(
      days => (metadata ->> 'day_offset')::integer,
      hours => ((metadata ->> 'demo_sequence')::integer % 11)
    )
  WHERE event.campaign_id = demo_reset.campaign_id
    AND event.metadata ->> 'demo_fixture' = fixture_marker;

  FOR event_index IN 1..22 LOOP
    INSERT INTO public.qr_scan_events (
      qr_link_id,
      scanned_at,
      user_agent,
      referrer,
      device_type,
      browser,
      os,
      country,
      region,
      city,
      ip_hash,
      metadata
    ) VALUES (
      CASE WHEN event_index <= 14 THEN profile_qr_id ELSE campaign_qr_id END,
      reset_at,
      'Adpadz River City QR fixture ' || event_index::text,
      'https://adpadz.example/river-city-mailer',
      CASE WHEN event_index % 4 = 0 THEN 'tablet' ELSE 'mobile' END,
      CASE WHEN event_index % 3 = 0 THEN 'Safari' ELSE 'Chrome' END,
      CASE WHEN event_index % 3 = 0 THEN 'iOS' ELSE 'Android' END,
      'United States',
      'Florida',
      'Jacksonville',
      md5(actor_id::text || ':river-city:' || event_index::text),
      jsonb_build_object(
        'demo_fixture', fixture_marker,
        'demo_sequence', event_index,
        'day_offset', event_index % 28,
        'source', 'community_mailer'
      )
    );
  END LOOP;

  UPDATE public.qr_scan_events
  SET scanned_at = reset_at - make_interval(
    days => (metadata ->> 'day_offset')::integer,
    hours => ((metadata ->> 'demo_sequence')::integer % 10)
  )
  WHERE qr_link_id IN (profile_qr_id, campaign_qr_id)
    AND metadata ->> 'demo_fixture' = fixture_marker;

  UPDATE public.demo_accounts
  SET
    reset_count = reset_count + 1,
    last_reset_at = reset_at,
    updated_at = reset_at
  WHERE user_id = actor_id;

  RETURN jsonb_build_object(
    'fixture_key', fixture_marker,
    'fixture_name', 'River City Outdoor Living',
    'reset_at', reset_at,
    'business_id', business_id,
    'business_slug', business_slug,
    'smart_card_id', card_id,
    'smart_card_slug', card_slug,
    'campaign_id', campaign_id,
    'scheduled_campaign_id', scheduled_campaign_id,
    'profile_qr_id', profile_qr_id,
    'campaign_qr_id', campaign_qr_id,
    'offer_id', offer_id,
    'public_paths', jsonb_build_object(
      'business_profile', '/c/' || card_slug,
      'business_alias', '/business/' || card_slug,
      'interactive_campaign', '/ad/' || campaign_id::text,
      'profile_qr', '/q/' || profile_qr_slug,
      'campaign_qr', '/q/' || campaign_qr_slug,
      'offer', '/redeem/' || offer_id::text
    )
  );
END;
$$;
