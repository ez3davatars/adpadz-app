-- Public Campaign destinations may render the exact active Asset Library image
-- selected for Discovery or QR without opening direct public reads on unrelated
-- Mailer or Social creative references.

CREATE OR REPLACE FUNCTION public.get_public_campaign_creative_assets(
  p_campaign_ids uuid[]
)
RETURNS TABLE (
  campaign_id uuid,
  destination text,
  asset jsonb
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
      'title', creative_asset.title,
      'asset_type', creative_asset.asset_type,
      'file_url', creative_asset.file_url,
      'external_url', creative_asset.external_url,
      'thumbnail_url', creative_asset.thumbnail_url
    ) AS asset
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
  JOIN public.business_marketing_assets AS creative_asset
    ON creative_asset.id = public.adpadz_jsonb_uuid(
      reference.settings,
      'imageAssetId'
    )
  WHERE COALESCE(cardinality(p_campaign_ids), 0) BETWEEN 1 AND 50
    AND campaign.id = ANY(p_campaign_ids)
    AND public.adpadz_campaign_output_is_public(
      campaign.id,
      'interactive_ad'
    )
    AND jsonb_typeof(reference.settings) = 'object'
    AND campaign.business_id IS NOT NULL
    AND creative_asset.owner_id = campaign.owner_id
    AND creative_asset.business_id = campaign.business_id
    AND creative_asset.is_active IS TRUE
  ORDER BY campaign.id, reference.destination;
$$;

REVOKE ALL ON FUNCTION public.get_public_campaign_creative_assets(uuid[])
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_campaign_creative_assets(uuid[])
  TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_campaign_creative_assets(uuid[]) IS
  'Returns whitelisted active Asset Library image data referenced by effective Discovery or QR creative on currently public interactive Campaigns.';
