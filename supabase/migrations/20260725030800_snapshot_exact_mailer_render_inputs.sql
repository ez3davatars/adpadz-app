-- Bind the exact Asset Library and QR Studio records used by the saved Mailer
-- treatment. The existing v2 creative snapshot contract still owns effective
-- settings/version binding; creative_render_contract_version identifies the
-- additional immutable renderer inputs required by Candidate generator 2.x.

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

  WITH render_rows AS (
    SELECT
      slot.id AS placement_id,
      campaign.id AS campaign_id,
      campaign.updated_at AS campaign_updated_at,
      jsonb_strip_nulls(jsonb_build_object(
        'campaign_id', campaign.id,
        'campaign_updated_at', campaign.updated_at,
        'business_name', business.name,
        'business_logo_url', profile.logo_url,
        'primary_color', profile.primary_color,
        'accent_color', profile.accent_color,
        'headline', campaign.headline,
        'description', campaign.description,
        'offer', COALESCE(campaign.offer_title, slot.offer_text),
        'offer_description', campaign.offer_description,
        'cta', campaign.cta_label,
        'phone', business.phone,
        'website', business.website,
        'expiration', campaign.end_date,
        'brand_color', profile.primary_color,
        'category', slot.category,
        'placement_id', slot.id,
        'slot_key', slot.slot_key,
        'side', slot.side,
        'creative_settings', creative.effective_mailer_settings,
        'template_settings', creative.effective_mailer_settings,
        'creative_format_key', creative.effective_mailer_format,
        'creative_snapshot_contract_version', 2,
        'creative_render_contract_version', 1,
        'creative_asset', CASE
          WHEN render_asset.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', render_asset.id,
            'url', COALESCE(
              render_asset.file_url,
              render_asset.thumbnail_url,
              render_asset.external_url
            ),
            'updated_at', render_asset.updated_at
          )
        END,
        'qr_studio_artwork', CASE
          WHEN render_qr.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', render_qr.id,
            'title', render_qr.title,
            'slug', render_qr.slug,
            'destination_url', render_qr.destination_url,
            'status', render_qr.status,
            'expires_at', render_qr.expires_at,
            'updated_at', render_qr.updated_at,
            'style_preset', render_qr.style_preset,
            'top_ring_text', render_qr.top_ring_text,
            'bottom_ring_text', render_qr.bottom_ring_text,
            'center_label', render_qr.center_label,
            'foreground_color', render_qr.foreground_color,
            'background_color', render_qr.background_color,
            'accent_color', render_qr.accent_color,
            'show_center_label', render_qr.show_center_label,
            'show_short_url', render_qr.show_short_url,
            'logo_data_url', render_qr.logo_data_url,
            'center_frame_shape', render_qr.center_frame_shape,
            'center_frame_stroke_color',
              render_qr.center_frame_stroke_color,
            'center_frame_fill_color', render_qr.center_frame_fill_color,
            'rim_decoration', render_qr.rim_decoration,
            'rim_band_color', render_qr.rim_band_color,
            'rim_text_color', render_qr.rim_text_color,
            'inner_field_color', render_qr.inner_field_color,
            'outer_border_color', render_qr.outer_border_color,
            'outer_background_type', render_qr.outer_background_type,
            'outer_background_color', render_qr.outer_background_color,
            'outer_background_image_data_url',
              render_qr.outer_background_image_data_url,
            'outer_background_image_opacity',
              render_qr.outer_background_image_opacity,
            'outer_background_image_fit',
              render_qr.outer_background_image_fit,
            'outer_background_overlay_color',
              render_qr.outer_background_overlay_color,
            'rim_band_background_type',
              render_qr.rim_band_background_type,
            'rim_band_image_data_url', render_qr.rim_band_image_data_url,
            'rim_band_image_opacity', render_qr.rim_band_image_opacity,
            'rim_band_image_fit', render_qr.rim_band_image_fit,
            'rim_band_overlay_color', render_qr.rim_band_overlay_color,
            'rim_band_overlay_opacity',
              render_qr.rim_band_overlay_opacity,
            'ornament_style', render_qr.ornament_style,
            'ornament_main_color', render_qr.ornament_main_color,
            'ornament_accent_color', render_qr.ornament_accent_color,
            'ornament_shadow_color', render_qr.ornament_shadow_color,
            'ornament_opacity', render_qr.ornament_opacity
          )
        END
      )) AS render_snapshot
    FROM public.community_card_slots AS slot
    JOIN public.campaigns AS campaign
      ON campaign.id = slot.campaign_id
    JOIN public.businesses AS business
      ON business.id = slot.business_id
    LEFT JOIN public.campaign_outputs AS template_output
      ON template_output.campaign_id = campaign.id
      AND template_output.output_type = 'interactive_ad'
    LEFT JOIN LATERAL (
      SELECT
        COALESCE(
          CASE
            WHEN jsonb_typeof(
              template_output.metadata #> ARRAY[
                'creative_workshop', 'overrides', 'mailer'
              ]
            ) = 'object'
              THEN template_output.metadata #> ARRAY[
                'creative_workshop', 'overrides', 'mailer'
              ]
          END,
          CASE
            WHEN jsonb_typeof(
              template_output.metadata #> ARRAY[
                'creative_workshop', 'global'
              ]
            ) = 'object'
              THEN template_output.metadata #> ARRAY[
                'creative_workshop', 'global'
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
              'creative_workshop', 'formats', 'mailer'
            ],
            ''
          ),
          'standard'
        ) AS effective_mailer_format
    ) AS creative ON true
    LEFT JOIN public.business_marketing_assets AS render_asset
      ON render_asset.id::text = COALESCE(
        NULLIF(creative.effective_mailer_settings ->> 'imageAssetId', ''),
        slot.creative_asset_id::text
      )
      AND render_asset.business_id = business.id
      AND render_asset.is_active IS TRUE
    LEFT JOIN public.qr_links AS render_qr
      ON render_qr.id::text = COALESCE(
        NULLIF(creative.effective_mailer_settings ->> 'qrId', ''),
        slot.qr_link_id::text
      )
      AND render_qr.business_id = business.id
      AND render_qr.destination_type = 'campaign'
      AND render_qr.destination_id = campaign.id
      AND octet_length(COALESCE(render_qr.logo_data_url, ''))
        + octet_length(COALESCE(render_qr.outer_background_image_data_url, ''))
        + octet_length(COALESCE(render_qr.rim_band_image_data_url, ''))
        <= 1048576
    LEFT JOIN LATERAL (
      SELECT
        business_card.logo_url,
        business_card.primary_color,
        business_card.accent_color
      FROM public.business_cards AS business_card
      WHERE business_card.business_id = business.id
      ORDER BY business_card.updated_at DESC
      LIMIT 1
    ) AS profile ON true
    WHERE slot.community_card_id = card.id
      AND slot.placement_type NOT IN ('brand', 'adpadz')
      AND slot.status NOT IN ('available', 'unavailable')
  )
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
    row.placement_id,
    card.layout_revision,
    row.campaign_id,
    row.campaign_updated_at,
    row.render_snapshot,
    encode(
      extensions.digest(
        convert_to(
          jsonb_build_object(
            'contract',
              'adpadz.community-mailer.creative-render-snapshot.v1',
            'community_card_id', card.id,
            'layout_revision', card.layout_revision,
            'render_snapshot', row.render_snapshot
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    ),
    auth.uid()
  FROM render_rows AS row
  ON CONFLICT (placement_id, layout_revision) DO NOTHING;

  GET DIAGNOSTICS snapshot_count = ROW_COUNT;

  IF EXISTS (
    SELECT 1
    FROM public.community_mailer_production_snapshots AS production_snapshot
    JOIN public.community_card_slots AS slot
      ON slot.id = production_snapshot.placement_id
    LEFT JOIN public.qr_links AS assigned_qr
      ON assigned_qr.id = slot.qr_link_id
    WHERE production_snapshot.community_card_id = card.id
      AND production_snapshot.layout_revision = card.layout_revision
      AND (
        production_snapshot.snapshot
          ->> 'creative_render_contract_version' IS DISTINCT FROM '1'
        OR production_snapshot.snapshot #>> ARRAY[
          'creative_asset', 'id'
        ] IS NULL
        OR production_snapshot.snapshot #>> ARRAY[
          'qr_studio_artwork', 'id'
        ] IS DISTINCT FROM slot.qr_link_id::text
        OR production_snapshot.snapshot #>> ARRAY[
          'qr_studio_artwork', 'destination_url'
        ] IS DISTINCT FROM assigned_qr.destination_url
      )
  ) THEN
    RAISE EXCEPTION
      'Exact Mailer asset/QR render inputs do not match the production placement. Save the Workshop QR assignment and start a new layout revision.';
  END IF;
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
  'Creates immutable Mailer snapshots with effective Workshop settings, exact Asset Library references, and sanitized QR Studio artwork.';

NOTIFY pgrst, 'reload schema';
