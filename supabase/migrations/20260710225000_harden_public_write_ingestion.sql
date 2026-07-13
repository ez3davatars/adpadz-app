-- Harden anonymous/public analytics, QR scans, leads, and booking requests.
--
-- The checks are installed NOT VALID so legacy rows do not block deployment;
-- PostgreSQL still enforces them for every new or updated row. Public-facing
-- triggers normalize server-owned timestamps and suppress short duplicate
-- bursts before the existing counter triggers run.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Bounded, well-shaped payloads
-- ---------------------------------------------------------------------------

ALTER TABLE public.campaign_events
  DROP CONSTRAINT IF EXISTS campaign_events_output_type_check,
  DROP CONSTRAINT IF EXISTS campaign_events_event_type_check,
  DROP CONSTRAINT IF EXISTS campaign_events_output_event_pair_check,
  DROP CONSTRAINT IF EXISTS campaign_events_metadata_object_check,
  DROP CONSTRAINT IF EXISTS campaign_events_payload_size_check;

ALTER TABLE public.campaign_events
  ADD CONSTRAINT campaign_events_output_type_check
    CHECK (output_type IN ('interactive_ad', 'qr_landing')) NOT VALID,
  ADD CONSTRAINT campaign_events_event_type_check
    CHECK (event_type IN ('view', 'reveal', 'cta_click', 'share', 'save', 'offer_claim')) NOT VALID,
  ADD CONSTRAINT campaign_events_output_event_pair_check
    CHECK (
      (output_type = 'interactive_ad'
        AND event_type IN ('view', 'reveal', 'cta_click', 'share', 'save', 'offer_claim'))
      OR (output_type = 'qr_landing' AND event_type = 'view')
    ) NOT VALID,
  ADD CONSTRAINT campaign_events_metadata_object_check
    CHECK (metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object') NOT VALID,
  ADD CONSTRAINT campaign_events_payload_size_check
    CHECK (
      octet_length(metadata::text) <= 8192
      AND char_length(COALESCE(user_agent, '')) <= 1024
      AND char_length(COALESCE(referrer, '')) <= 4096
    ) NOT VALID;

ALTER TABLE public.business_card_events
  DROP CONSTRAINT IF EXISTS business_card_events_metadata_object_check,
  DROP CONSTRAINT IF EXISTS business_card_events_payload_size_check,
  DROP CONSTRAINT IF EXISTS business_card_events_required_fields_check;

ALTER TABLE public.business_card_events
  ADD CONSTRAINT business_card_events_metadata_object_check
    CHECK (metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object') NOT VALID,
  ADD CONSTRAINT business_card_events_payload_size_check
    CHECK (
      octet_length(metadata::text) <= 8192
      AND char_length(COALESCE(user_agent, '')) <= 1024
      AND char_length(COALESCE(referrer, '')) <= 4096
    ) NOT VALID,
  ADD CONSTRAINT business_card_events_required_fields_check
    CHECK (business_card_id IS NOT NULL AND event_type IS NOT NULL AND occurred_at IS NOT NULL) NOT VALID;

ALTER TABLE public.qr_scan_events
  DROP CONSTRAINT IF EXISTS qr_scan_events_metadata_object_check,
  DROP CONSTRAINT IF EXISTS qr_scan_events_payload_size_check,
  DROP CONSTRAINT IF EXISTS qr_scan_events_required_fields_check;

ALTER TABLE public.qr_scan_events
  ADD CONSTRAINT qr_scan_events_metadata_object_check
    CHECK (metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object') NOT VALID,
  ADD CONSTRAINT qr_scan_events_payload_size_check
    CHECK (
      octet_length(metadata::text) <= 8192
      AND char_length(COALESCE(user_agent, '')) <= 1024
      AND char_length(COALESCE(referrer, '')) <= 4096
      AND char_length(COALESCE(device_type, '')) <= 128
      AND char_length(COALESCE(browser, '')) <= 128
      AND char_length(COALESCE(os, '')) <= 128
      AND char_length(COALESCE(country, '')) <= 128
      AND char_length(COALESCE(region, '')) <= 256
      AND char_length(COALESCE(city, '')) <= 256
      AND char_length(COALESCE(ip_hash, '')) <= 256
    ) NOT VALID,
  ADD CONSTRAINT qr_scan_events_required_fields_check
    CHECK (qr_link_id IS NOT NULL AND scanned_at IS NOT NULL) NOT VALID;

ALTER TABLE public.business_card_leads
  DROP CONSTRAINT IF EXISTS business_card_leads_public_shape_check,
  DROP CONSTRAINT IF EXISTS business_card_leads_public_payload_check;

ALTER TABLE public.business_card_leads
  ADD CONSTRAINT business_card_leads_public_shape_check
    CHECK (
      char_length(name) <= 120
      AND char_length(COALESCE(phone, '')) <= 64
      AND char_length(COALESCE(email, '')) <= 320
      AND char_length(lead_type) BETWEEN 1 AND 64
      AND char_length(source) BETWEEN 1 AND 64
    ) NOT VALID,
  ADD CONSTRAINT business_card_leads_public_payload_check
    CHECK (
      char_length(COALESCE(message, '')) <= 4000
      AND metadata IS NOT NULL
      AND jsonb_typeof(metadata) = 'object'
      AND octet_length(metadata::text) <= 8192
    ) NOT VALID;

CREATE INDEX IF NOT EXISTS campaign_events_campaign_time_idx
  ON public.campaign_events(campaign_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS business_card_events_card_time_idx
  ON public.business_card_events(business_card_id, occurred_at DESC);

-- ---------------------------------------------------------------------------
-- Campaign QR output/event compatibility and coherent public ingestion
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adpadz_campaign_event_is_coherent(
  p_campaign_id uuid,
  p_business_card_id uuid,
  p_output_type text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    p_output_type IN ('interactive_ad', 'qr_landing')
    AND public.adpadz_campaign_output_is_public(p_campaign_id, p_output_type)
    AND (
      (p_output_type = 'qr_landing' AND p_business_card_id IS NULL)
      OR (
        p_output_type = 'interactive_ad'
        AND (
          p_business_card_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM public.campaigns AS campaign
            JOIN public.business_cards AS card
              ON card.id = p_business_card_id
             AND card.owner_user_id = campaign.owner_id
             AND card.is_published IS TRUE
             AND (
               campaign.business_id IS NULL
               OR card.business_id = campaign.business_id
             )
            JOIN public.campaign_outputs AS card_output
              ON card_output.campaign_id = campaign.id
             AND card_output.output_type = 'smart_card'
             AND card_output.enabled IS TRUE
             AND public.adpadz_jsonb_uuid(card_output.metadata, 'smart_card_id') = card.id
            WHERE campaign.id = p_campaign_id
              AND public.adpadz_campaign_output_is_public(
                card_output.campaign_id,
                card_output.output_type
              )
          )
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.adpadz_campaign_event_is_coherent(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adpadz_campaign_event_is_coherent(uuid, uuid, text) TO anon, authenticated;

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
        AND EXISTS (
          SELECT 1
          FROM public.qr_links AS qr
          WHERE qr.id = public.adpadz_jsonb_uuid(campaign_events.metadata, 'qr_link_id')
            AND qr.status = 'active'
            AND (qr.expires_at IS NULL OR qr.expires_at > now())
            AND qr.destination_type = 'campaign'
            AND qr.destination_id = campaign_events.campaign_id
        )
      )
    )
    AND public.adpadz_campaign_event_is_coherent(
      campaign_id,
      business_card_id,
      output_type
    )
  );

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
        AND public.adpadz_campaign_output_is_owned(
          output.campaign_id,
          output.output_type,
          output.enabled,
          output.metadata,
          campaign.owner_id
        )
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign QR destination is unavailable or has no coherent QR Landing output'
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
  ELSIF NEW.business_id IS DISTINCT FROM campaign_business THEN
    RAISE EXCEPTION 'QR business must exactly match campaign business'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.adpadz_qr_campaign_destination_guard() FROM PUBLIC;

-- resolve_qr_redirect() intentionally runs as its owner so callers never need
-- raw table write privileges. Because table-owner execution bypasses RLS, the
-- function itself repeats every public/destination/tenant check before it logs
-- the scan or returns a destination.
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
  v_user_agent text;
  v_referrer text;
BEGIN
  IF p_slug IS NULL
     OR char_length(p_slug) > 128
     OR p_slug !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'not_found');
  END IF;

  v_user_agent := NULLIF(btrim(left(COALESCE(p_user_agent, ''), 1024)), '');
  v_referrer := NULLIF(btrim(left(COALESCE(p_referrer, ''), 4096)), '');

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

  IF v_link.destination_type = 'business_card' THEN
    IF v_link.destination_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'status', 'inactive');
    END IF;

    SELECT card.*
    INTO v_card
    FROM public.business_cards AS card
    WHERE card.id = v_link.destination_id
      AND card.is_published IS TRUE
      AND card.owner_user_id = v_link.owner_user_id
      AND card.business_id IS NOT DISTINCT FROM v_link.business_id
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
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'status', 'inactive');
    END IF;
  ELSIF v_link.destination_type = 'campaign' THEN
    IF v_link.destination_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'status', 'inactive');
    END IF;

    SELECT campaign.*
    INTO v_campaign
    FROM public.campaigns AS campaign
    WHERE campaign.id = v_link.destination_id
      AND campaign.owner_id = v_link.owner_user_id
      AND campaign.business_id IS NOT DISTINCT FROM v_link.business_id
      AND public.adpadz_campaign_output_is_public(campaign.id, 'qr_landing')
    LIMIT 1;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'status', 'inactive');
    END IF;
  ELSIF v_link.destination_type <> 'url' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'inactive');
  END IF;

  INSERT INTO public.qr_scan_events (
    qr_link_id,
    user_agent,
    referrer,
    metadata
  ) VALUES (
    v_link.id,
    v_user_agent,
    v_referrer,
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
      v_user_agent,
      v_referrer,
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
      v_user_agent,
      v_referrer,
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

-- ---------------------------------------------------------------------------
-- Detect a PostgREST public request without trusting client-supplied columns.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adpadz_request_uses_public_api_role()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog
AS $$
DECLARE
  request_role text;
  request_claims text;
BEGIN
  request_role := NULLIF(current_setting('request.jwt.claim.role', true), '');

  IF request_role IS NULL THEN
    request_claims := NULLIF(current_setting('request.jwt.claims', true), '');
    IF request_claims IS NOT NULL THEN
      BEGIN
        request_role := request_claims::jsonb ->> 'role';
      EXCEPTION WHEN invalid_text_representation THEN
        request_role := NULL;
      END;
    END IF;
  END IF;

  RETURN COALESCE(request_role, '') IN ('anon', 'authenticated');
END;
$$;

REVOKE ALL ON FUNCTION public.adpadz_request_uses_public_api_role() FROM PUBLIC;

-- ---------------------------------------------------------------------------
-- Analytics and scan normalization, duplicate suppression, and burst caps.
-- Duplicate/rate-limited analytics are dropped quietly so customer navigation
-- and QR redirects never fail merely because telemetry was suppressed.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adpadz_guard_campaign_event_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  server_now timestamptz := clock_timestamp();
  fingerprint text;
  recent_count integer;
BEGIN
  IF NOT public.adpadz_request_uses_public_api_role() THEN
    RETURN NEW;
  END IF;

  NEW.occurred_at := server_now;
  NEW.created_at := server_now;
  NEW.user_agent := NULLIF(btrim(left(COALESCE(NEW.user_agent, ''), 1024)), '');
  NEW.referrer := NULLIF(btrim(left(COALESCE(NEW.referrer, ''), 4096)), '');
  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb);

  fingerprint := encode(
    digest(COALESCE(NEW.user_agent, '') || chr(31) || COALESCE(NEW.referrer, ''), 'sha256'),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'adpadz:campaign-event:' || NEW.campaign_id::text,
    0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'adpadz:campaign-event:' || NEW.campaign_id::text || ':' || NEW.output_type || ':' || NEW.event_type || ':' || fingerprint,
    0
  ));

  IF EXISTS (
    SELECT 1
    FROM public.campaign_events AS event
    WHERE event.campaign_id = NEW.campaign_id
      AND event.business_card_id IS NOT DISTINCT FROM NEW.business_card_id
      AND event.output_type = NEW.output_type
      AND event.event_type = NEW.event_type
      AND event.user_agent IS NOT DISTINCT FROM NEW.user_agent
      AND event.referrer IS NOT DISTINCT FROM NEW.referrer
      AND event.metadata = NEW.metadata
      AND event.occurred_at BETWEEN server_now - interval '750 milliseconds' AND server_now + interval '5 seconds'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT count(*)
  INTO recent_count
  FROM (
    SELECT 1
    FROM public.campaign_events AS event
    WHERE event.campaign_id = NEW.campaign_id
      AND event.user_agent IS NOT DISTINCT FROM NEW.user_agent
      AND event.referrer IS NOT DISTINCT FROM NEW.referrer
      AND event.occurred_at BETWEEN server_now - interval '1 minute' AND server_now + interval '5 seconds'
    LIMIT 300
  ) AS recent;

  IF recent_count >= 300 THEN
    RETURN NULL;
  END IF;

  SELECT count(*)
  INTO recent_count
  FROM (
    SELECT 1
    FROM public.campaign_events AS event
    WHERE event.campaign_id = NEW.campaign_id
      AND event.occurred_at BETWEEN server_now - interval '1 minute' AND server_now + interval '5 seconds'
    LIMIT 3000
  ) AS recent_campaign;

  IF recent_count >= 3000 THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.adpadz_guard_business_card_event_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  server_now timestamptz := clock_timestamp();
  fingerprint text;
  recent_count integer;
BEGIN
  IF NOT public.adpadz_request_uses_public_api_role() THEN
    RETURN NEW;
  END IF;

  NEW.occurred_at := server_now;
  NEW.user_agent := NULLIF(btrim(left(COALESCE(NEW.user_agent, ''), 1024)), '');
  NEW.referrer := NULLIF(btrim(left(COALESCE(NEW.referrer, ''), 4096)), '');
  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb);

  fingerprint := encode(
    digest(COALESCE(NEW.user_agent, '') || chr(31) || COALESCE(NEW.referrer, ''), 'sha256'),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'adpadz:card-event:' || NEW.business_card_id::text,
    0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'adpadz:card-event:' || NEW.business_card_id::text || ':' || NEW.event_type || ':' || fingerprint,
    0
  ));

  -- Claims are intended to be one-time customer actions. Ignore metadata here
  -- so rotating otherwise valid redemption codes cannot inflate the counter.
  IF NEW.event_type = 'offer_claim' AND EXISTS (
    SELECT 1
    FROM public.business_card_events AS event
    WHERE event.business_card_id = NEW.business_card_id
      AND event.offer_id IS NOT DISTINCT FROM NEW.offer_id
      AND event.event_type = 'offer_claim'
      AND event.user_agent IS NOT DISTINCT FROM NEW.user_agent
      AND event.referrer IS NOT DISTINCT FROM NEW.referrer
      AND event.occurred_at BETWEEN server_now - interval '1 minute' AND server_now + interval '5 seconds'
  ) THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.business_card_events AS event
    WHERE event.business_card_id = NEW.business_card_id
      AND event.qr_link_id IS NOT DISTINCT FROM NEW.qr_link_id
      AND event.offer_id IS NOT DISTINCT FROM NEW.offer_id
      AND event.event_type = NEW.event_type
      AND event.user_agent IS NOT DISTINCT FROM NEW.user_agent
      AND event.referrer IS NOT DISTINCT FROM NEW.referrer
      AND event.metadata = NEW.metadata
      AND event.occurred_at BETWEEN server_now - interval '750 milliseconds' AND server_now + interval '5 seconds'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT count(*)
  INTO recent_count
  FROM (
    SELECT 1
    FROM public.business_card_events AS event
    WHERE event.business_card_id = NEW.business_card_id
      AND event.user_agent IS NOT DISTINCT FROM NEW.user_agent
      AND event.referrer IS NOT DISTINCT FROM NEW.referrer
      AND event.occurred_at BETWEEN server_now - interval '1 minute' AND server_now + interval '5 seconds'
    LIMIT 300
  ) AS recent;

  IF recent_count >= 300 THEN
    RETURN NULL;
  END IF;

  SELECT count(*)
  INTO recent_count
  FROM (
    SELECT 1
    FROM public.business_card_events AS event
    WHERE event.business_card_id = NEW.business_card_id
      AND event.occurred_at BETWEEN server_now - interval '1 minute' AND server_now + interval '5 seconds'
    LIMIT 3000
  ) AS recent_card;

  IF recent_count >= 3000 THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.adpadz_guard_qr_scan_event_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  server_now timestamptz := clock_timestamp();
  fingerprint text;
  recent_count integer;
BEGIN
  IF NOT public.adpadz_request_uses_public_api_role() THEN
    RETURN NEW;
  END IF;

  NEW.scanned_at := server_now;
  NEW.user_agent := NULLIF(btrim(left(COALESCE(NEW.user_agent, ''), 1024)), '');
  NEW.referrer := NULLIF(btrim(left(COALESCE(NEW.referrer, ''), 4096)), '');
  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb);

  fingerprint := encode(
    digest(
      COALESCE(NEW.ip_hash, '') || chr(31) || COALESCE(NEW.user_agent, '') || chr(31) || COALESCE(NEW.referrer, ''),
      'sha256'
    ),
    'hex'
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'adpadz:qr-scan:' || NEW.qr_link_id::text,
    0
  ));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'adpadz:qr-scan:' || NEW.qr_link_id::text || ':' || fingerprint,
    0
  ));

  IF EXISTS (
    SELECT 1
    FROM public.qr_scan_events AS scan
    WHERE scan.qr_link_id = NEW.qr_link_id
      AND scan.ip_hash IS NOT DISTINCT FROM NEW.ip_hash
      AND scan.user_agent IS NOT DISTINCT FROM NEW.user_agent
      AND scan.referrer IS NOT DISTINCT FROM NEW.referrer
      AND scan.metadata = NEW.metadata
      AND scan.scanned_at BETWEEN server_now - interval '750 milliseconds' AND server_now + interval '5 seconds'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT count(*)
  INTO recent_count
  FROM (
    SELECT 1
    FROM public.qr_scan_events AS scan
    WHERE scan.qr_link_id = NEW.qr_link_id
      AND scan.ip_hash IS NOT DISTINCT FROM NEW.ip_hash
      AND scan.user_agent IS NOT DISTINCT FROM NEW.user_agent
      AND scan.referrer IS NOT DISTINCT FROM NEW.referrer
      AND scan.scanned_at BETWEEN server_now - interval '1 minute' AND server_now + interval '5 seconds'
    LIMIT 300
  ) AS recent;

  IF recent_count >= 300 THEN
    RETURN NULL;
  END IF;

  SELECT count(*)
  INTO recent_count
  FROM (
    SELECT 1
    FROM public.qr_scan_events AS scan
    WHERE scan.qr_link_id = NEW.qr_link_id
      AND scan.scanned_at BETWEEN server_now - interval '1 minute' AND server_now + interval '5 seconds'
    LIMIT 3000
  ) AS recent_link;

  IF recent_count >= 3000 THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_events_guard_public_insert ON public.campaign_events;
CREATE TRIGGER campaign_events_guard_public_insert
  BEFORE INSERT ON public.campaign_events
  FOR EACH ROW EXECUTE FUNCTION public.adpadz_guard_campaign_event_insert();

DROP TRIGGER IF EXISTS business_card_events_guard_public_insert ON public.business_card_events;
CREATE TRIGGER business_card_events_guard_public_insert
  BEFORE INSERT ON public.business_card_events
  FOR EACH ROW EXECUTE FUNCTION public.adpadz_guard_business_card_event_insert();

DROP TRIGGER IF EXISTS qr_scan_events_guard_public_insert ON public.qr_scan_events;
CREATE TRIGGER qr_scan_events_guard_public_insert
  BEFORE INSERT ON public.qr_scan_events
  FOR EACH ROW EXECUTE FUNCTION public.adpadz_guard_qr_scan_event_insert();

REVOKE ALL ON FUNCTION public.adpadz_guard_campaign_event_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adpadz_guard_business_card_event_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.adpadz_guard_qr_scan_event_insert() FROM PUBLIC;

-- QR scans are produced only by resolve_qr_redirect(). Its SECURITY DEFINER
-- implementation retains insert access while callers can no longer forge raw
-- scan rows or bypass destination checks.
REVOKE INSERT ON public.qr_scan_events FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Lead and booking-request validation plus contact/card throttles
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adpadz_guard_business_card_lead_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  server_now timestamptz := clock_timestamp();
  card_owner uuid;
  lead_form_available boolean;
  booking_request_available boolean;
  booking_mode_value text;
  requested_type text;
  contact_key text;
  qr_id uuid;
  service_id_value uuid;
  service_name_value text;
  preferred_date_text text;
  preferred_date_value date;
  preferred_time_text text;
  recent_count integer;
BEGIN
  IF NOT public.adpadz_request_uses_public_api_role() THEN
    RETURN NEW;
  END IF;

  NEW.name := btrim(COALESCE(NEW.name, ''));
  NEW.phone := NULLIF(btrim(COALESCE(NEW.phone, '')), '');
  NEW.email := lower(NULLIF(btrim(COALESCE(NEW.email, '')), ''));
  NEW.message := NULLIF(btrim(COALESCE(NEW.message, '')), '');
  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb);
  NEW.status := 'new';
  NEW.created_at := server_now;

  IF jsonb_typeof(NEW.metadata) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Lead metadata must be a JSON object';
  END IF;

  IF NEW.name = '' OR (NEW.phone IS NULL AND NEW.email IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A name and phone number or email address are required';
  END IF;

  IF char_length(NEW.name) > 120
     OR char_length(COALESCE(NEW.phone, '')) > 64
     OR char_length(COALESCE(NEW.email, '')) > 320
     OR char_length(COALESCE(NEW.message, '')) > 4000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'One or more lead fields are too long';
  END IF;

  IF NEW.phone IS NOT NULL
     AND char_length(regexp_replace(NEW.phone, '[^0-9]', '', 'g')) NOT BETWEEN 7 AND 20 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A valid phone number is required';
  END IF;

  IF NEW.email IS NOT NULL
     AND NEW.email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A valid email address is required';
  END IF;

  SELECT
    card.owner_user_id,
    card.lead_form_enabled,
    card.booking_request_enabled,
    card.booking_mode
  INTO
    card_owner,
    lead_form_available,
    booking_request_available,
    booking_mode_value
  FROM public.business_cards AS card
  WHERE card.id = NEW.card_id
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
    );

  IF NOT FOUND OR card_owner IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'This Smart Card is not accepting requests';
  END IF;

  NEW.owner_id := card_owner;
  requested_type := lower(COALESCE(NULLIF(btrim(NEW.lead_type), ''), 'smart_card_inquiry'));
  IF requested_type = 'general' THEN
    requested_type := 'smart_card_inquiry';
  END IF;

  -- Retain only a coherent QR attribution. A stale or hand-edited query string
  -- must not make an otherwise legitimate form submission fail.
  qr_id := public.adpadz_jsonb_uuid(NEW.metadata, 'qr_link_id');
  IF qr_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.qr_links AS qr
    WHERE qr.id = qr_id
      AND qr.status = 'active'
      AND (qr.expires_at IS NULL OR qr.expires_at > server_now)
      AND qr.destination_type = 'business_card'
      AND qr.destination_id = NEW.card_id
      AND qr.owner_user_id = card_owner
  ) THEN
    NEW.metadata := jsonb_set(NEW.metadata, '{qr_link_id}', to_jsonb(qr_id::text), true);
  ELSE
    qr_id := NULL;
    NEW.metadata := NEW.metadata - 'qr_link_id';
  END IF;

  IF NEW.metadata ? 'path' THEN
    IF jsonb_typeof(NEW.metadata -> 'path') = 'string' THEN
      NEW.metadata := jsonb_set(
        NEW.metadata,
        '{path}',
        to_jsonb(left(NEW.metadata ->> 'path', 512)),
        true
      );
    ELSE
      NEW.metadata := NEW.metadata - 'path';
    END IF;
  END IF;

  IF requested_type = 'booking_request' THEN
    IF booking_mode_value IS DISTINCT FROM 'request' OR booking_request_available IS NOT TRUE THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'This Smart Card is not accepting booking requests';
    END IF;

    preferred_date_text := NEW.metadata ->> 'preferred_date';
    preferred_time_text := NEW.metadata ->> 'preferred_time';

    IF preferred_date_text IS NULL OR preferred_date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A valid preferred booking date is required';
    END IF;

    BEGIN
      preferred_date_value := preferred_date_text::date;
    EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A valid preferred booking date is required';
    END;

    IF to_char(preferred_date_value, 'YYYY-MM-DD') <> preferred_date_text
       OR preferred_date_value < current_date - 1
       OR preferred_date_value > current_date + 730 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Preferred booking date is outside the supported booking window';
    END IF;

    IF preferred_time_text IS NULL
       OR preferred_time_text !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'A valid preferred booking time is required';
    END IF;

    IF NEW.metadata ? 'service_id' AND NEW.metadata -> 'service_id' <> 'null'::jsonb THEN
      service_id_value := public.adpadz_jsonb_uuid(NEW.metadata, 'service_id');
      IF service_id_value IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'The selected booking service is invalid';
      END IF;

      SELECT service.name
      INTO service_name_value
      FROM public.business_card_booking_services AS service
      WHERE service.id = service_id_value
        AND service.card_id = NEW.card_id
        AND service.is_active IS TRUE;

      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'The selected booking service is unavailable';
      END IF;

      NEW.metadata := jsonb_set(NEW.metadata, '{service_id}', to_jsonb(service_id_value::text), true);
      NEW.metadata := jsonb_set(NEW.metadata, '{service_name}', to_jsonb(service_name_value), true);
    ELSE
      NEW.metadata := NEW.metadata - 'service_id' - 'service_name';
    END IF;

    NEW.metadata := jsonb_set(NEW.metadata, '{booking_request}', 'true'::jsonb, true);
    NEW.lead_type := 'booking_request';
    NEW.source := 'smart_card_booking';
  ELSIF requested_type = 'smart_card_inquiry' THEN
    IF lead_form_available IS NOT TRUE THEN
      RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'This Smart Card is not accepting inquiries';
    END IF;

    NEW.metadata := NEW.metadata
      - 'booking_request'
      - 'preferred_date'
      - 'preferred_time'
      - 'service_id'
      - 'service_name';
    NEW.lead_type := 'smart_card_inquiry';
    NEW.source := CASE WHEN qr_id IS NULL THEN 'smart_card_public' ELSE 'smart_card_qr' END;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Unsupported Smart Card request type';
  END IF;

  IF octet_length(NEW.metadata::text) > 8192 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Lead metadata is too large';
  END IF;

  contact_key := COALESCE(
    NEW.email,
    regexp_replace(COALESCE(NEW.phone, ''), '[^0-9]', '', 'g')
  );

  -- Lock card first and contact second consistently to make both limits safe
  -- under concurrent PostgREST requests.
  PERFORM pg_advisory_xact_lock(hashtextextended('adpadz:lead-card:' || NEW.card_id::text, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'adpadz:lead-contact:' || NEW.card_id::text || ':' || NEW.lead_type || ':' || contact_key,
    0
  ));

  IF EXISTS (
    SELECT 1
    FROM public.business_card_leads AS lead
    WHERE lead.card_id = NEW.card_id
      AND lead.lead_type = NEW.lead_type
      AND (
        (
          NEW.email IS NOT NULL
          AND lower(COALESCE(lead.email, '')) = NEW.email
        )
        OR (
          NEW.phone IS NOT NULL
          AND regexp_replace(COALESCE(lead.phone, ''), '[^0-9]', '', 'g')
              = regexp_replace(NEW.phone, '[^0-9]', '', 'g')
        )
      )
      AND lead.created_at BETWEEN server_now - interval '1 minute' AND server_now + interval '5 seconds'
  ) THEN
    RETURN NULL;
  END IF;

  SELECT count(*)
  INTO recent_count
  FROM (
    SELECT 1
    FROM public.business_card_leads AS lead
    WHERE lead.card_id = NEW.card_id
      AND lead.lead_type = NEW.lead_type
      AND (
        (
          NEW.email IS NOT NULL
          AND lower(COALESCE(lead.email, '')) = NEW.email
        )
        OR (
          NEW.phone IS NOT NULL
          AND regexp_replace(COALESCE(lead.phone, ''), '[^0-9]', '', 'g')
              = regexp_replace(NEW.phone, '[^0-9]', '', 'g')
        )
      )
      AND lead.created_at BETWEEN server_now - interval '15 minutes' AND server_now + interval '5 seconds'
    LIMIT 5
  ) AS recent_contact;

  IF recent_count >= 5 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'Too many recent requests for this contact; please try again later';
  END IF;

  SELECT count(*)
  INTO recent_count
  FROM (
    SELECT 1
    FROM public.business_card_leads AS lead
    WHERE lead.card_id = NEW.card_id
      AND lead.created_at BETWEEN server_now - interval '1 minute' AND server_now + interval '5 seconds'
    LIMIT 60
  ) AS recent_card;

  IF recent_count >= 60 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'This Smart Card is receiving too many requests; please try again shortly';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_card_leads_validate_and_throttle ON public.business_card_leads;
CREATE TRIGGER business_card_leads_validate_and_throttle
  BEFORE INSERT ON public.business_card_leads
  FOR EACH ROW EXECUTE FUNCTION public.adpadz_guard_business_card_lead_insert();

REVOKE ALL ON FUNCTION public.adpadz_guard_business_card_lead_insert() FROM PUBLIC;

DROP POLICY IF EXISTS business_card_leads_public_insert ON public.business_card_leads;
CREATE POLICY business_card_leads_public_insert ON public.business_card_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'new'
    AND created_at BETWEEN now() - interval '1 minute' AND now() + interval '1 minute'
    AND EXISTS (
      SELECT 1
      FROM public.business_cards AS card
      WHERE card.id = business_card_leads.card_id
        AND card.owner_user_id = business_card_leads.owner_id
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

-- Add timestamp and redemption-code checks to the existing association guards.
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
            SELECT 1 FROM public.businesses AS business
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
        AND EXISTS (
          SELECT 1
          FROM public.qr_links AS qr
          JOIN public.business_cards AS card
            ON card.id = business_card_events.business_card_id
          WHERE qr.id = business_card_events.qr_link_id
            AND qr.status = 'active'
            AND (qr.expires_at IS NULL OR qr.expires_at > now())
            AND qr.destination_type = 'business_card'
            AND qr.destination_id = business_card_events.business_card_id
            AND qr.owner_user_id = card.owner_user_id
            AND (qr.business_id IS NULL OR card.business_id = qr.business_id)
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

COMMENT ON FUNCTION public.adpadz_guard_campaign_event_insert() IS
  'Normalizes public campaign event timestamps and quietly suppresses exact duplicates and abusive bursts.';
COMMENT ON FUNCTION public.adpadz_guard_business_card_event_insert() IS
  'Normalizes public Smart Card event timestamps and quietly suppresses exact duplicates and abusive bursts.';
COMMENT ON FUNCTION public.adpadz_guard_qr_scan_event_insert() IS
  'Normalizes redirect-produced QR scan timestamps and quietly suppresses exact duplicates and abusive bursts.';
COMMENT ON FUNCTION public.adpadz_guard_business_card_lead_insert() IS
  'Validates public inquiry/booking shapes, derives trusted ownership and attribution, and throttles duplicate submissions.';
