-- Freeze the exact effective Creative Workshop treatment used by Community
-- Mailer production. Historical snapshots remain immutable; this function
-- affects only snapshots created for future layout revisions.

CREATE OR REPLACE FUNCTION public.bind_community_mailer_creative_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  bound_version public.campaign_creative_versions%ROWTYPE;
  effective_mailer_settings jsonb := '{}'::jsonb;
  effective_mailer_format text := 'standard';
BEGIN
  SELECT
    COALESCE(
      CASE
        WHEN jsonb_typeof(
          output.metadata #> ARRAY[
            'creative_workshop',
            'overrides',
            'mailer'
          ]
        ) = 'object'
          THEN output.metadata #> ARRAY[
            'creative_workshop',
            'overrides',
            'mailer'
          ]
      END,
      CASE
        WHEN jsonb_typeof(
          output.metadata #> ARRAY['creative_workshop', 'global']
        ) = 'object'
          THEN output.metadata #> ARRAY['creative_workshop', 'global']
      END,
      CASE
        WHEN jsonb_typeof(output.metadata -> 'template_settings') = 'object'
          THEN output.metadata -> 'template_settings'
      END,
      '{}'::jsonb
    ),
    COALESCE(
      NULLIF(
        output.metadata #>> ARRAY[
          'creative_workshop',
          'formats',
          'mailer'
        ],
        ''
      ),
      'standard'
    )
  INTO effective_mailer_settings, effective_mailer_format
  FROM public.campaign_outputs AS output
  WHERE output.campaign_id = NEW.campaign_id
    AND output.output_type = 'interactive_ad';

  effective_mailer_settings := COALESCE(
    effective_mailer_settings,
    '{}'::jsonb
  );
  effective_mailer_format := COALESCE(
    NULLIF(effective_mailer_format, ''),
    'standard'
  );

  SELECT version.*
  INTO bound_version
  FROM public.campaign_creative_versions AS version
  WHERE version.campaign_id = NEW.campaign_id
    AND (
      NEW.creative_version_id IS NULL
      OR version.id = NEW.creative_version_id
    )
    AND COALESCE(
      version.settings_snapshot #> ARRAY['overrides', 'mailer'],
      version.settings_snapshot -> 'global'
    ) IS NOT DISTINCT FROM effective_mailer_settings
    AND COALESCE(
      version.settings_snapshot #>> ARRAY['formats', 'mailer'],
      'standard'
    ) IS NOT DISTINCT FROM effective_mailer_format
  -- Event metadata does not determine production compatibility. Prefer a
  -- Mailer-authored row, then the newest exactly equivalent projection.
  ORDER BY
    (version.destination = 'mailer') DESC,
    version.created_at DESC,
    version.id DESC
  LIMIT 1;

  IF NEW.creative_version_id IS NOT NULL AND NOT FOUND THEN
    RAISE EXCEPTION
      'Production creative version must match the Campaign Mailer treatment and format.';
  END IF;

  NEW.creative_version_id := bound_version.id;
  NEW.snapshot := NEW.snapshot || jsonb_build_object(
    'creative_settings', effective_mailer_settings,
    -- Retain the established key for older candidate consumers.
    'template_settings', effective_mailer_settings,
    'creative_format_key', effective_mailer_format,
    'creative_snapshot_contract_version', 2
  );

  IF NEW.creative_version_id IS NOT NULL THEN
    NEW.snapshot := NEW.snapshot || jsonb_build_object(
      'creative_version_id', bound_version.id,
      'creative_settings_fingerprint', bound_version.settings_fingerprint
    );
  ELSE
    NEW.snapshot := NEW.snapshot
      - 'creative_version_id'
      - 'creative_settings_fingerprint';
  END IF;

  -- Bind the exact settings, Mailer format, and immutable version evidence to
  -- the snapshot fingerprint. The original base fingerprint remains part of
  -- the payload so all established campaign/layout inputs remain covered.
  NEW.fingerprint := encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'base_fingerprint', NEW.fingerprint,
          'effective_mailer_settings', effective_mailer_settings,
          'mailer_format_key', effective_mailer_format,
          'creative_version_id', NEW.creative_version_id,
          'creative_settings_fingerprint',
            bound_version.settings_fingerprint
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.bind_community_mailer_creative_version()
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_admin_community_mailer_snapshots(
  p_mailer_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  card public.community_cards%ROWTYPE;
  snapshot_count integer;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer administrator access required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO card
  FROM public.community_cards
  WHERE id = p_mailer_id
  FOR UPDATE;

  IF NOT FOUND OR card.layout_locked IS NOT TRUE THEN
    RAISE EXCEPTION 'A locked Community Mailer revision is required.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.community_card_slots AS slot
    WHERE slot.community_card_id = card.id
      AND slot.placement_type NOT IN ('brand', 'adpadz')
      AND slot.status NOT IN ('available', 'unavailable')
      AND slot.campaign_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Every occupied placement requires a Campaign.';
  END IF;

  INSERT INTO public.community_mailer_production_snapshots (
    community_card_id,
    placement_id,
    layout_revision,
    campaign_id,
    campaign_updated_at,
    snapshot,
    fingerprint,
    created_by
  )
  SELECT
    card.id,
    slot.id,
    card.layout_revision,
    campaign.id,
    campaign.updated_at,
    jsonb_strip_nulls(jsonb_build_object(
      'campaign_id', campaign.id,
      'campaign_updated_at', campaign.updated_at,
      'business_name', business.name,
      'logo_asset_id', profile.logo_url,
      'primary_creative_asset_id', slot.creative_asset_id,
      'headline', campaign.headline,
      'offer', COALESCE(campaign.offer_title, slot.offer_text),
      'offer_description', campaign.offer_description,
      'cta', campaign.cta_label,
      'phone', business.phone,
      'website', business.website,
      'expiration', campaign.end_date,
      'qr_destination', qr.destination_url,
      'brand_color', profile.primary_color,
      'category', slot.category,
      'placement_id', slot.id,
      'slot_key', slot.slot_key,
      'side', slot.side,
      'creative_settings', creative.effective_mailer_settings,
      -- Keep this compatibility key equal to the effective Mailer treatment.
      'template_settings', creative.effective_mailer_settings,
      'creative_format_key', creative.effective_mailer_format,
      'creative_snapshot_contract_version', 2
    )),
    encode(
      extensions.digest(
        convert_to(
          jsonb_build_object(
            'contract', 'adpadz.community-mailer.creative-snapshot.v2',
            'community_card_id', card.id,
            'layout_revision', card.layout_revision,
            'placement_id', slot.id,
            'campaign_id', campaign.id,
            'campaign_updated_at', campaign.updated_at,
            'effective_mailer_settings',
              creative.effective_mailer_settings,
            'mailer_format_key', creative.effective_mailer_format
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ),
    auth.uid()
  FROM public.community_card_slots AS slot
  JOIN public.campaigns AS campaign
    ON campaign.id = slot.campaign_id
  JOIN public.businesses AS business
    ON business.id = slot.business_id
  LEFT JOIN public.qr_links AS qr
    ON qr.id = slot.qr_link_id
  LEFT JOIN public.campaign_outputs AS template_output
    ON template_output.campaign_id = campaign.id
    AND template_output.output_type = 'interactive_ad'
  LEFT JOIN LATERAL (
    SELECT
      COALESCE(
        CASE
          WHEN jsonb_typeof(
            template_output.metadata #> ARRAY[
              'creative_workshop',
              'overrides',
              'mailer'
            ]
          ) = 'object'
            THEN template_output.metadata #> ARRAY[
              'creative_workshop',
              'overrides',
              'mailer'
            ]
        END,
        CASE
          WHEN jsonb_typeof(
            template_output.metadata #> ARRAY[
              'creative_workshop',
              'global'
            ]
          ) = 'object'
            THEN template_output.metadata #> ARRAY[
              'creative_workshop',
              'global'
            ]
        END,
        CASE
          WHEN jsonb_typeof(
            template_output.metadata -> 'template_settings'
          ) = 'object'
            THEN template_output.metadata -> 'template_settings'
        END,
        '{}'::jsonb
      ) AS effective_mailer_settings,
      COALESCE(
        NULLIF(
          template_output.metadata #>> ARRAY[
            'creative_workshop',
            'formats',
            'mailer'
          ],
          ''
        ),
        'standard'
      ) AS effective_mailer_format
  ) AS creative ON true
  LEFT JOIN LATERAL (
    SELECT business_card.logo_url, business_card.primary_color
    FROM public.business_cards AS business_card
    WHERE business_card.business_id = business.id
    ORDER BY business_card.updated_at DESC
    LIMIT 1
  ) AS profile ON true
  WHERE slot.community_card_id = card.id
    AND slot.placement_type NOT IN ('brand', 'adpadz')
    AND slot.status NOT IN ('available', 'unavailable')
  ON CONFLICT (placement_id, layout_revision) DO NOTHING;

  GET DIAGNOSTICS snapshot_count = ROW_COUNT;

  INSERT INTO public.community_mailer_qr_associations (
    community_card_id,
    placement_id,
    qr_link_id,
    campaign_id,
    business_id,
    layout_revision,
    zone_name,
    slot_key,
    destination_url,
    active,
    expires_at,
    created_by
  )
  SELECT
    card.id,
    slot.id,
    qr.id,
    campaign.id,
    business.id,
    card.layout_revision,
    card.zone_name,
    slot.slot_key,
    qr.destination_url,
    qr.status = 'active'
      AND (qr.expires_at IS NULL OR qr.expires_at > now()),
    qr.expires_at,
    auth.uid()
  FROM public.community_card_slots AS slot
  JOIN public.campaigns AS campaign
    ON campaign.id = slot.campaign_id
  JOIN public.businesses AS business
    ON business.id = slot.business_id
  JOIN public.qr_links AS qr
    ON qr.id = slot.qr_link_id
    AND qr.business_id = business.id
    AND qr.destination_type = 'campaign'
    AND qr.destination_id = campaign.id
  WHERE slot.community_card_id = card.id
    AND slot.status NOT IN ('available', 'unavailable')
  ON CONFLICT (placement_id, layout_revision) DO NOTHING;

  RETURN snapshot_count;
END;
$$;

REVOKE ALL ON FUNCTION public.create_admin_community_mailer_snapshots(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_admin_community_mailer_snapshots(uuid)
  TO authenticated;

COMMENT ON FUNCTION public.create_admin_community_mailer_snapshots(uuid) IS
  'Creates immutable revision snapshots with the exact effective Mailer Workshop settings, format, and version evidence.';

NOTIFY pgrst, 'reload schema';
