CREATE OR REPLACE FUNCTION public.get_admin_campaign_readiness_inputs(limit_count integer DEFAULT 50)
RETURNS TABLE (
  id uuid, business_id uuid, owner_id uuid, title text, headline text, description text,
  offer_title text, offer_description text, cta_label text, cta_url text, status text,
  start_date timestamptz, end_date timestamptz, primary_image_id uuid, primary_qr_id uuid,
  business_name text, business_logo_url text, business_category text, business_location text,
  business_website text, business_phone text, business_active boolean, profile_published boolean,
  campaign_image_url text, qr_destination_url text, qr_status text, qr_slug text, outputs jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_adpadz_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Active Mission Control access is required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT campaign.id, campaign.business_id, campaign.owner_id, campaign.title, campaign.headline,
    campaign.description, campaign.offer_title, campaign.offer_description, campaign.cta_label,
    campaign.cta_url, campaign.status, campaign.start_date, campaign.end_date,
    campaign.primary_image_id, campaign.primary_qr_id, business.name, card.logo_url,
    business.category, COALESCE(business.service_area, business.address), business.website,
    business.phone, business.active, COALESCE(card.is_published, false),
    COALESCE(asset.file_url, asset.thumbnail_url, asset.external_url, card.cover_image_url),
    qr.destination_url, qr.status, qr.slug, COALESCE(output_rows.outputs, '[]'::jsonb)
  FROM public.campaigns AS campaign
  LEFT JOIN public.businesses AS business ON business.id = campaign.business_id
  LEFT JOIN LATERAL (
    SELECT business_card.logo_url, business_card.cover_image_url, business_card.is_published
    FROM public.business_cards AS business_card
    WHERE business_card.business_id = campaign.business_id AND business_card.owner_user_id = campaign.owner_id
    ORDER BY business_card.updated_at DESC LIMIT 1
  ) AS card ON true
  LEFT JOIN public.business_marketing_assets AS asset ON asset.id = campaign.primary_image_id AND asset.owner_id = campaign.owner_id
  LEFT JOIN public.qr_links AS qr ON qr.id = campaign.primary_qr_id AND qr.owner_user_id = campaign.owner_id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object(
      'campaign_id', campaign_output.campaign_id, 'output_type', campaign_output.output_type,
      'enabled', campaign_output.enabled, 'sort_order', campaign_output.sort_order,
      'metadata', campaign_output.metadata
    ) ORDER BY campaign_output.sort_order) AS outputs
    FROM public.campaign_outputs AS campaign_output WHERE campaign_output.campaign_id = campaign.id
  ) AS output_rows ON true
  ORDER BY CASE campaign.status WHEN 'active' THEN 0 WHEN 'scheduled' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
    campaign.updated_at DESC
  LIMIT LEAST(GREATEST(COALESCE(limit_count, 50), 1), 100);
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_campaign_readiness_inputs(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_campaign_readiness_inputs(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_campaign_readiness_inputs(integer) TO authenticated;

COMMENT ON FUNCTION public.get_admin_campaign_readiness_inputs(integer) IS
  'Admin-only source projection for computed campaign readiness; tenant table RLS remains unchanged.';
