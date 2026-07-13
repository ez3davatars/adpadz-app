-- A published Business Profile is public only while it belongs to its owner's
-- active Business Hub. Centralizing this rule keeps every child projection in
-- sync and prevents deactivated or unassigned legacy profiles from leaking a
-- partial public experience.

CREATE OR REPLACE FUNCTION public.adpadz_business_card_is_public(p_card_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_cards AS card
    JOIN public.businesses AS business
      ON business.id = card.business_id
     AND business.owner_user_id = card.owner_user_id
    WHERE card.id = p_card_id
      AND card.is_published IS TRUE
      AND card.business_id IS NOT NULL
      AND business.active IS TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.adpadz_business_card_is_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adpadz_business_card_is_public(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS business_cards_public_read_published ON public.business_cards;
CREATE POLICY business_cards_public_read_published ON public.business_cards
  FOR SELECT TO anon, authenticated
  USING (public.adpadz_business_card_is_public(id));

DROP POLICY IF EXISTS business_card_links_public_read ON public.business_card_links;
CREATE POLICY business_card_links_public_read ON public.business_card_links
  FOR SELECT TO anon, authenticated
  USING (
    is_active IS TRUE
    AND public.adpadz_business_card_is_public(business_card_id)
  );

DROP POLICY IF EXISTS business_card_offers_public_read ON public.business_card_offers;
CREATE POLICY business_card_offers_public_read ON public.business_card_offers
  FOR SELECT TO anon, authenticated
  USING (
    is_active IS TRUE
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
    AND public.adpadz_business_card_is_public(business_card_id)
  );

DROP POLICY IF EXISTS business_card_gallery_public_read ON public.business_card_gallery_items;
CREATE POLICY business_card_gallery_public_read ON public.business_card_gallery_items
  FOR SELECT TO anon, authenticated
  USING (
    is_active IS TRUE
    AND public.adpadz_business_card_is_public(card_id)
  );

DROP POLICY IF EXISTS business_card_booking_services_public_read
  ON public.business_card_booking_services;
CREATE POLICY business_card_booking_services_public_read
  ON public.business_card_booking_services
  FOR SELECT TO anon, authenticated
  USING (
    is_active IS TRUE
    AND service_is_active IS TRUE
    AND public.adpadz_business_card_is_public(card_id)
    AND EXISTS (
      SELECT 1
      FROM public.business_cards AS card
      WHERE card.id = business_card_booking_services.card_id
        AND card.owner_user_id = business_card_booking_services.owner_id
    )
  );

DROP POLICY IF EXISTS business_card_before_after_public_read
  ON public.business_card_before_after_items;
CREATE POLICY business_card_before_after_public_read
  ON public.business_card_before_after_items
  FOR SELECT TO anon, authenticated
  USING (
    is_active IS TRUE
    AND public.adpadz_business_card_is_public(card_id)
    AND EXISTS (
      SELECT 1
      FROM public.business_cards AS card
      WHERE card.id = business_card_before_after_items.card_id
        AND card.owner_user_id = business_card_before_after_items.owner_id
    )
  );

DROP POLICY IF EXISTS business_card_testimonials_public_read
  ON public.business_card_testimonials;
CREATE POLICY business_card_testimonials_public_read
  ON public.business_card_testimonials
  FOR SELECT TO anon, authenticated
  USING (
    is_active IS TRUE
    AND public.adpadz_business_card_is_public(card_id)
    AND EXISTS (
      SELECT 1
      FROM public.business_cards AS card
      WHERE card.id = business_card_testimonials.card_id
        AND card.owner_user_id = business_card_testimonials.owner_id
    )
  );

DROP POLICY IF EXISTS business_marketing_assets_public_read
  ON public.business_marketing_assets;
CREATE POLICY business_marketing_assets_public_read
  ON public.business_marketing_assets
  FOR SELECT TO anon, authenticated
  USING (
    is_active IS TRUE
    AND owner_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1
        FROM public.business_cards AS card
        WHERE card.id = business_marketing_assets.smart_card_id
          AND card.owner_user_id = business_marketing_assets.owner_id
          AND card.business_id = business_marketing_assets.business_id
          AND public.adpadz_business_card_is_public(card.id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.campaigns AS campaign
        WHERE (
            campaign.primary_image_id = business_marketing_assets.id
            OR campaign.primary_video_id = business_marketing_assets.id
          )
          AND campaign.owner_id = business_marketing_assets.owner_id
          AND campaign.business_id = business_marketing_assets.business_id
          AND public.adpadz_campaign_is_public(campaign.id)
      )
    )
  );

DROP POLICY IF EXISTS business_card_leads_public_insert ON public.business_card_leads;
CREATE POLICY business_card_leads_public_insert ON public.business_card_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'new'
    AND created_at BETWEEN now() - interval '1 minute' AND now() + interval '1 minute'
    AND public.adpadz_business_card_is_public(card_id)
    AND EXISTS (
      SELECT 1
      FROM public.business_cards AS card
      WHERE card.id = business_card_leads.card_id
        AND card.owner_user_id = business_card_leads.owner_id
        AND (
          (business_card_leads.lead_type = 'smart_card_inquiry' AND card.lead_form_enabled IS TRUE)
          OR (
            business_card_leads.lead_type = 'booking_request'
            AND card.booking_mode = 'request'
            AND card.booking_request_enabled IS TRUE
            AND business_card_leads.metadata -> 'booking_request' = 'true'::jsonb
          )
        )
    )
  );

DROP POLICY IF EXISTS business_card_events_public_insert ON public.business_card_events;
CREATE POLICY business_card_events_public_insert ON public.business_card_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    business_card_id IS NOT NULL
    AND occurred_at BETWEEN now() - interval '1 minute' AND now() + interval '1 minute'
    AND public.adpadz_business_card_is_public(business_card_id)
    AND EXISTS (
      SELECT 1
      FROM public.business_cards AS card
      WHERE card.id = business_card_events.business_card_id
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

COMMENT ON FUNCTION public.adpadz_business_card_is_public(uuid) IS
  'True only for a published Business Profile attached to its owner active Business Hub.';
