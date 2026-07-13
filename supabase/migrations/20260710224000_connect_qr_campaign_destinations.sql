-- Connect QR Studio directly to Campaign Engine records.

ALTER TABLE public.qr_links
  DROP CONSTRAINT IF EXISTS qr_links_destination_type_check;

ALTER TABLE public.qr_links
  ADD CONSTRAINT qr_links_destination_type_check
  CHECK (destination_type IN ('url', 'business_card', 'campaign'));

CREATE OR REPLACE FUNCTION public.adpadz_qr_campaign_destination_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  campaign_owner uuid;
  campaign_business uuid;
BEGIN
  IF NEW.destination_type <> 'campaign' THEN
    RETURN NEW;
  END IF;

  IF NEW.destination_id IS NULL THEN
    RAISE EXCEPTION 'Campaign QR destinations require destination_id'
      USING ERRCODE = '23502';
  END IF;

  SELECT campaign.owner_id, campaign.business_id
  INTO campaign_owner, campaign_business
  FROM public.campaigns AS campaign
  WHERE campaign.id = NEW.destination_id
    AND campaign.status IN ('active', 'scheduled')
    AND EXISTS (
      SELECT 1
      FROM public.campaign_outputs AS output
      WHERE output.campaign_id = campaign.id
        AND output.output_type = 'qr_landing'
        AND output.enabled IS TRUE
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign QR destination is unavailable or has no enabled QR Landing output'
      USING ERRCODE = '23503';
  END IF;

  IF campaign_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Campaign QR destination is owned by another tenant'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.owner_user_id IS DISTINCT FROM campaign_owner THEN
    RAISE EXCEPTION 'QR owner must match campaign owner'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.business_id IS NULL THEN
    NEW.business_id := campaign_business;
  ELSIF campaign_business IS NOT NULL AND NEW.business_id IS DISTINCT FROM campaign_business THEN
    RAISE EXCEPTION 'QR business must match campaign business'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qr_links_campaign_destination_guard ON public.qr_links;
CREATE TRIGGER qr_links_campaign_destination_guard
  BEFORE INSERT OR UPDATE OF owner_user_id, business_id, destination_type, destination_id
  ON public.qr_links
  FOR EACH ROW
  EXECUTE FUNCTION public.adpadz_qr_campaign_destination_guard();

CREATE OR REPLACE FUNCTION public.resolve_qr_redirect(
  p_slug text,
  p_user_agent text DEFAULT NULL,
  p_referrer text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_link public.qr_links%ROWTYPE;
  v_card public.business_cards%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'not_found');
  END IF;

  SELECT *
  INTO v_link
  FROM public.qr_links
  WHERE slug = lower(p_slug)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', 'not_found');
  END IF;

  IF v_link.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'inactive');
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'status', 'expired');
  END IF;

  IF v_link.destination_type = 'business_card' AND v_link.destination_id IS NOT NULL THEN
    SELECT *
    INTO v_card
    FROM public.business_cards
    WHERE id = v_link.destination_id
      AND is_published IS TRUE
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'status', 'inactive');
    END IF;
  ELSIF v_link.destination_type = 'campaign' AND v_link.destination_id IS NOT NULL THEN
    SELECT *
    INTO v_campaign
    FROM public.campaigns
    WHERE id = v_link.destination_id
      AND status IN ('active', 'scheduled')
      AND (start_date IS NULL OR start_date <= now())
      AND (end_date IS NULL OR end_date >= now())
      AND EXISTS (
        SELECT 1
        FROM public.campaign_outputs
        WHERE campaign_id = v_link.destination_id
          AND output_type = 'qr_landing'
          AND enabled IS TRUE
      )
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'status', 'inactive');
    END IF;
  END IF;

  INSERT INTO public.qr_scan_events (
    qr_link_id,
    user_agent,
    referrer,
    metadata
  ) VALUES (
    v_link.id,
    p_user_agent,
    p_referrer,
    jsonb_build_object(
      'source', 'qr_redirect',
      'slug', v_link.slug,
      'destination_type', v_link.destination_type
    )
  );

  IF v_link.destination_type = 'business_card' AND v_card.id IS NOT NULL THEN
    INSERT INTO public.business_card_events (
      business_card_id,
      qr_link_id,
      event_type,
      user_agent,
      referrer,
      metadata
    ) VALUES (
      v_card.id,
      v_link.id,
      'qr_scan',
      p_user_agent,
      p_referrer,
      jsonb_build_object('source', 'qr_redirect', 'slug', v_link.slug)
    );
  ELSIF v_link.destination_type = 'campaign' AND v_campaign.id IS NOT NULL THEN
    INSERT INTO public.campaign_events (
      campaign_id,
      business_card_id,
      output_type,
      event_type,
      user_agent,
      referrer,
      metadata
    ) VALUES (
      v_campaign.id,
      NULL,
      'qr_landing',
      'view',
      p_user_agent,
      p_referrer,
      jsonb_build_object(
        'source', 'qr_redirect',
        'action', 'qr_scan',
        'qr_link_id', v_link.id,
        'slug', v_link.slug
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'ok',
    'destination_url', v_link.destination_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_qr_redirect(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_qr_redirect(text, text, text) TO anon, authenticated;
