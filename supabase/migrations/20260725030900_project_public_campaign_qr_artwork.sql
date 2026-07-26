-- Public Campaign destinations may render the exact QR Studio design selected
-- by the Campaign owner without opening direct public reads on qr_links.

-- Keep embedded artwork bounded. NOT VALID leaves legacy rows in place while
-- enforcing this limit on every new or updated QR link.
ALTER TABLE public.qr_links
  DROP CONSTRAINT IF EXISTS qr_links_embedded_artwork_size_check;
ALTER TABLE public.qr_links
  ADD CONSTRAINT qr_links_embedded_artwork_size_check
  CHECK (
    octet_length(COALESCE(logo_data_url, ''))
    + octet_length(COALESCE(outer_background_image_data_url, ''))
    + octet_length(COALESCE(rim_band_image_data_url, ''))
    <= 1048576
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.get_public_campaign_qr_artwork(
  p_campaign_ids uuid[]
)
RETURNS TABLE (
  campaign_id uuid,
  destination text,
  qr_artwork jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
ROWS 100
AS $$
  SELECT
    campaign.id AS campaign_id,
    reference.destination,
    jsonb_build_object(
      'slug', qr.slug,
      'style_preset', qr.style_preset,
      'top_ring_text', qr.top_ring_text,
      'bottom_ring_text', qr.bottom_ring_text,
      'center_label', qr.center_label,
      'foreground_color', qr.foreground_color,
      'background_color', qr.background_color,
      'accent_color', qr.accent_color,
      'show_center_label', qr.show_center_label,
      'show_short_url', qr.show_short_url,
      'logo_data_url', qr.logo_data_url,
      'center_frame_shape', qr.center_frame_shape,
      'center_frame_stroke_color', qr.center_frame_stroke_color,
      'center_frame_fill_color', qr.center_frame_fill_color,
      'rim_decoration', qr.rim_decoration,
      'rim_band_color', qr.rim_band_color,
      'rim_text_color', qr.rim_text_color,
      'inner_field_color', qr.inner_field_color,
      'outer_border_color', qr.outer_border_color,
      'outer_background_type', qr.outer_background_type,
      'outer_background_color', qr.outer_background_color,
      'outer_background_image_data_url', qr.outer_background_image_data_url,
      'outer_background_image_opacity', qr.outer_background_image_opacity,
      'outer_background_image_fit', qr.outer_background_image_fit,
      'outer_background_overlay_color', qr.outer_background_overlay_color,
      'rim_band_background_type', qr.rim_band_background_type,
      'rim_band_image_data_url', qr.rim_band_image_data_url,
      'rim_band_image_opacity', qr.rim_band_image_opacity,
      'rim_band_image_fit', qr.rim_band_image_fit,
      'rim_band_overlay_color', qr.rim_band_overlay_color,
      'rim_band_overlay_opacity', qr.rim_band_overlay_opacity,
      'ornament_style', qr.ornament_style,
      'ornament_main_color', qr.ornament_main_color,
      'ornament_accent_color', qr.ornament_accent_color,
      'ornament_shadow_color', qr.ornament_shadow_color,
      'ornament_opacity', qr.ornament_opacity
    ) AS qr_artwork
  FROM public.campaigns AS campaign
  JOIN public.campaign_outputs AS output
    ON output.campaign_id = campaign.id
   AND output.output_type = 'interactive_ad'
   AND output.enabled IS TRUE
  CROSS JOIN LATERAL (
    VALUES
      (
        'discovery'::text,
        COALESCE(
          output.metadata #> ARRAY['creative_workshop', 'overrides', 'discovery'],
          output.metadata #> ARRAY['creative_workshop', 'global']
        )
      ),
      (
        'qr'::text,
        COALESCE(
          output.metadata #> ARRAY['creative_workshop', 'overrides', 'qr'],
          output.metadata #> ARRAY['creative_workshop', 'global']
        )
      )
  ) AS reference(destination, settings)
  JOIN public.qr_links AS qr
    ON qr.id = public.adpadz_jsonb_uuid(reference.settings, 'qrId')
  WHERE COALESCE(cardinality(p_campaign_ids), 0) BETWEEN 1 AND 50
    AND campaign.id = ANY(p_campaign_ids)
    AND public.adpadz_campaign_output_is_public(
      campaign.id,
      'interactive_ad'
    )
    AND jsonb_typeof(reference.settings) = 'object'
    AND reference.settings -> 'showQr' = 'true'::jsonb
    AND qr.owner_user_id = campaign.owner_id
    AND qr.status = 'active'
    AND (qr.expires_at IS NULL OR qr.expires_at > now())
    AND octet_length(COALESCE(qr.logo_data_url, ''))
      + octet_length(COALESCE(qr.outer_background_image_data_url, ''))
      + octet_length(COALESCE(qr.rim_band_image_data_url, ''))
      <= 1048576
  ORDER BY campaign.id, reference.destination;
$$;

REVOKE ALL ON FUNCTION public.get_public_campaign_qr_artwork(uuid[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_campaign_qr_artwork(uuid[])
  TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_campaign_qr_artwork(uuid[]) IS
  'Returns whitelisted visual data for active QR Studio designs referenced by effective Discovery or QR creative on currently public interactive Campaigns.';
