-- Freeze the canonical template choice and controlled presentation settings
-- alongside campaign copy when a mailer production revision is snapshotted.
CREATE OR REPLACE FUNCTION public.create_admin_community_mailer_snapshots(p_mailer_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE card public.community_cards%ROWTYPE; snapshot_count integer;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer administrator access required.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO card FROM public.community_cards WHERE id = p_mailer_id FOR UPDATE;
  IF NOT FOUND OR card.layout_locked IS NOT TRUE THEN
    RAISE EXCEPTION 'A locked Community Mailer revision is required.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.community_card_slots AS slot
    WHERE slot.community_card_id = card.id
      AND slot.placement_type NOT IN ('brand','adpadz')
      AND slot.status NOT IN ('available','unavailable')
      AND slot.campaign_id IS NULL
  ) THEN RAISE EXCEPTION 'Every occupied placement requires a Campaign.'; END IF;

  INSERT INTO public.community_mailer_production_snapshots (
    community_card_id, placement_id, layout_revision, campaign_id,
    campaign_updated_at, snapshot, fingerprint, created_by
  )
  SELECT card.id, slot.id, card.layout_revision, campaign.id, campaign.updated_at,
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
      'template_settings', template_output.metadata -> 'template_settings',
      'template_contract_version', 1
    )),
    encode(extensions.digest(
      card.id::text || ':' || card.layout_revision::text || ':' ||
      slot.id::text || ':' || campaign.id::text || ':' ||
      campaign.updated_at::text || ':' ||
      COALESCE((template_output.metadata -> 'template_settings')::text, '{}'), 'sha256'
    ), 'hex'),
    auth.uid()
  FROM public.community_card_slots AS slot
  JOIN public.campaigns AS campaign ON campaign.id = slot.campaign_id
  JOIN public.businesses AS business ON business.id = slot.business_id
  LEFT JOIN public.qr_links AS qr ON qr.id = slot.qr_link_id
  LEFT JOIN public.campaign_outputs AS template_output
    ON template_output.campaign_id = campaign.id
    AND template_output.output_type = 'interactive_ad'
    AND template_output.enabled IS TRUE
  LEFT JOIN LATERAL (
    SELECT business_card.logo_url, business_card.primary_color
    FROM public.business_cards AS business_card
    WHERE business_card.business_id = business.id
    ORDER BY business_card.updated_at DESC LIMIT 1
  ) AS profile ON true
  WHERE slot.community_card_id = card.id
    AND slot.placement_type NOT IN ('brand','adpadz')
    AND slot.status NOT IN ('available','unavailable')
  ON CONFLICT (placement_id, layout_revision) DO NOTHING;
  GET DIAGNOSTICS snapshot_count = ROW_COUNT;

  INSERT INTO public.community_mailer_qr_associations (
    community_card_id, placement_id, qr_link_id, campaign_id, business_id,
    layout_revision, zone_name, slot_key, destination_url, active, expires_at, created_by
  )
  SELECT card.id, slot.id, qr.id, campaign.id, business.id,
    card.layout_revision, card.zone_name, slot.slot_key, qr.destination_url,
    qr.status = 'active' AND (qr.expires_at IS NULL OR qr.expires_at > now()),
    qr.expires_at, auth.uid()
  FROM public.community_card_slots AS slot
  JOIN public.campaigns AS campaign ON campaign.id = slot.campaign_id
  JOIN public.businesses AS business ON business.id = slot.business_id
  JOIN public.qr_links AS qr ON qr.id = slot.qr_link_id
    AND qr.business_id = business.id
    AND qr.destination_type = 'campaign'
    AND qr.destination_id = campaign.id
  WHERE slot.community_card_id = card.id
    AND slot.status NOT IN ('available','unavailable')
  ON CONFLICT (placement_id, layout_revision) DO NOTHING;
  RETURN snapshot_count;
END;
$$;
