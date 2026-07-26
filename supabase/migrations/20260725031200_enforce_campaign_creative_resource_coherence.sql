-- Keep canonical Creative Workshop references coherent with their render paths.
--
-- Digital destinations may use any active, unexpired QR Studio link owned by the
-- Campaign owner. The effective Mailer QR is stricter because Production
-- snapshots require a Campaign-bound QR from the same business. Asset Library
-- references always belong to the Campaign business and must remain active.

CREATE OR REPLACE FUNCTION public.adpadz_srgb_luminance(p_color text)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
DECLARE
  red_channel double precision;
  green_channel double precision;
  blue_channel double precision;
BEGIN
  IF p_color !~ '^#[0-9a-fA-F]{6}$' THEN
    RETURN NULL;
  END IF;

  red_channel := get_byte(decode(substr(p_color, 2, 2), 'hex'), 0) / 255.0;
  green_channel := get_byte(decode(substr(p_color, 4, 2), 'hex'), 0) / 255.0;
  blue_channel := get_byte(decode(substr(p_color, 6, 2), 'hex'), 0) / 255.0;

  red_channel := CASE
    WHEN red_channel <= 0.03928 THEN red_channel / 12.92
    ELSE power((red_channel + 0.055) / 1.055, 2.4)
  END;
  green_channel := CASE
    WHEN green_channel <= 0.03928 THEN green_channel / 12.92
    ELSE power((green_channel + 0.055) / 1.055, 2.4)
  END;
  blue_channel := CASE
    WHEN blue_channel <= 0.03928 THEN blue_channel / 12.92
    ELSE power((blue_channel + 0.055) / 1.055, 2.4)
  END;

  RETURN red_channel * 0.2126
    + green_channel * 0.7152
    + blue_channel * 0.0722;
END;
$$;

CREATE OR REPLACE FUNCTION public.adpadz_qr_contrast_ratio(
  p_foreground text,
  p_background text
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog, public
AS $$
DECLARE
  foreground_luminance double precision;
  background_luminance double precision;
BEGIN
  foreground_luminance := public.adpadz_srgb_luminance(p_foreground);
  background_luminance := public.adpadz_srgb_luminance(p_background);
  IF foreground_luminance IS NULL OR background_luminance IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (GREATEST(foreground_luminance, background_luminance) + 0.05)
    / (LEAST(foreground_luminance, background_luminance) + 0.05);
END;
$$;

REVOKE ALL ON FUNCTION public.adpadz_srgb_luminance(text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.adpadz_qr_contrast_ratio(text, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enforce_campaign_creative_resource_coherence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  campaign_owner_id uuid;
  campaign_business_id uuid;
  workshop jsonb;
  global_settings jsonb;
  overrides jsonb;
  old_workshop jsonb;
  old_global_settings jsonb;
  old_overrides jsonb;
  old_effective_mailer_settings jsonb;
  effective_mailer_settings jsonb;
  settings_entry record;
  referenced_asset_id uuid;
  referenced_qr_id uuid;
  write_boundary text := current_setting(
    'adpadz.creative_write_authorized',
    true
  );
BEGIN
  IF NEW.output_type IS DISTINCT FROM 'interactive_ad'
     OR NOT (COALESCE(NEW.metadata, '{}'::jsonb) ? 'creative_workshop') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.metadata -> 'creative_workshop'
       IS NOT DISTINCT FROM NEW.metadata -> 'creative_workshop'
     AND write_boundary IS DISTINCT FROM 'creative_workshop' THEN
    RETURN NEW;
  END IF;

  workshop := NEW.metadata -> 'creative_workshop';
  IF jsonb_typeof(workshop) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Creative Workshop settings must be an object.'
      USING ERRCODE = '23514';
  END IF;

  SELECT campaign.owner_id, campaign.business_id
  INTO campaign_owner_id, campaign_business_id
  FROM public.campaigns AS campaign
  WHERE campaign.id = NEW.campaign_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creative Workshop Campaign is unavailable.'
      USING ERRCODE = '23503';
  END IF;

  global_settings := CASE
    WHEN jsonb_typeof(workshop -> 'global') = 'object'
      THEN workshop -> 'global'
    ELSE '{}'::jsonb
  END;
  overrides := CASE
    WHEN jsonb_typeof(workshop -> 'overrides') = 'object'
      THEN workshop -> 'overrides'
    ELSE '{}'::jsonb
  END;

  FOR settings_entry IN
    SELECT 'global'::text AS destination, global_settings AS settings
    UNION ALL
    SELECT override_item.key, override_item.value
    FROM jsonb_each(overrides) AS override_item(key, value)
  LOOP
    IF jsonb_typeof(settings_entry.settings) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'Creative Workshop destination settings must be objects.'
        USING ERRCODE = '23514';
    END IF;

    IF settings_entry.settings ? 'imageAssetId'
       AND jsonb_typeof(settings_entry.settings -> 'imageAssetId')
         IS DISTINCT FROM 'null' THEN
      referenced_asset_id := public.adpadz_jsonb_uuid(
        settings_entry.settings,
        'imageAssetId'
      );
      IF referenced_asset_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.business_marketing_assets AS asset
        WHERE asset.id = referenced_asset_id
          AND asset.owner_id = campaign_owner_id
          AND asset.business_id = campaign_business_id
          AND asset.is_active IS TRUE
      ) THEN
        RAISE EXCEPTION
          'Creative images must be active Asset Library items for the Campaign business.'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF settings_entry.settings ? 'qrId'
       AND jsonb_typeof(settings_entry.settings -> 'qrId')
         IS DISTINCT FROM 'null' THEN
      referenced_qr_id := public.adpadz_jsonb_uuid(
        settings_entry.settings,
        'qrId'
      );
      IF referenced_qr_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.qr_links AS qr
        WHERE qr.id = referenced_qr_id
          AND qr.owner_user_id = campaign_owner_id
          AND qr.status = 'active'
          AND (qr.expires_at IS NULL OR qr.expires_at > now())
      ) THEN
        RAISE EXCEPTION
          'Creative QR links must be active, unexpired, and owned by the Campaign owner.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END LOOP;

  effective_mailer_settings := CASE
    WHEN jsonb_typeof(overrides -> 'mailer') = 'object'
      THEN overrides -> 'mailer'
    ELSE global_settings
  END;

  IF TG_OP = 'UPDATE' THEN
    old_workshop := COALESCE(
      OLD.metadata -> 'creative_workshop',
      '{}'::jsonb
    );
    old_global_settings := CASE
      WHEN jsonb_typeof(old_workshop -> 'global') = 'object'
        THEN old_workshop -> 'global'
      ELSE '{}'::jsonb
    END;
    old_overrides := CASE
      WHEN jsonb_typeof(old_workshop -> 'overrides') = 'object'
        THEN old_workshop -> 'overrides'
      ELSE '{}'::jsonb
    END;
    old_effective_mailer_settings := CASE
      WHEN jsonb_typeof(old_overrides -> 'mailer') = 'object'
        THEN old_overrides -> 'mailer'
      ELSE old_global_settings
    END;
  END IF;

  -- Do not make a digital-only edit repair a legacy Mailer binding. The
  -- canonical save RPC already determines whether the effective Mailer
  -- treatment changed; mirror that projection boundary here.
  IF (
       TG_OP = 'INSERT'
       OR old_effective_mailer_settings
         IS DISTINCT FROM effective_mailer_settings
     )
     AND effective_mailer_settings ? 'qrId'
     AND jsonb_typeof(effective_mailer_settings -> 'qrId')
       IS DISTINCT FROM 'null' THEN
    referenced_qr_id := public.adpadz_jsonb_uuid(
      effective_mailer_settings,
      'qrId'
    );
    IF referenced_qr_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.qr_links AS qr
      WHERE qr.id = referenced_qr_id
        AND qr.owner_user_id = campaign_owner_id
        AND qr.business_id = campaign_business_id
        AND qr.destination_type = 'campaign'
        AND qr.destination_id = NEW.campaign_id
        AND qr.status = 'active'
        AND (qr.expires_at IS NULL OR qr.expires_at > now())
        AND octet_length(COALESCE(qr.logo_data_url, ''))
          + octet_length(COALESCE(qr.outer_background_image_data_url, ''))
          + octet_length(COALESCE(qr.rim_band_image_data_url, ''))
          <= 1048576
        AND COALESCE(public.adpadz_qr_contrast_ratio(
          qr.foreground_color,
          qr.inner_field_color
        ), 0) >= 4.5
    ) THEN
      RAISE EXCEPTION
        'The Mailer QR must be active, Campaign-bound, and have at least 4.5:1 contrast.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_campaign_creative_resource_coherence()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS campaign_outputs_validate_creative_resources
  ON public.campaign_outputs;
CREATE TRIGGER campaign_outputs_validate_creative_resources
  BEFORE INSERT OR UPDATE OF metadata ON public.campaign_outputs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_campaign_creative_resource_coherence();

COMMENT ON FUNCTION public.enforce_campaign_creative_resource_coherence() IS
  'Rejects canonical Creative Workshop asset and QR references that cannot be rendered safely for their Campaign destination.';

NOTIFY pgrst, 'reload schema';
