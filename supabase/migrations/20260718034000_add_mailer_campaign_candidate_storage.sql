-- Canonical Campaign assignment, production snapshots, QR associations, and
-- private Production Candidate storage.

ALTER TABLE public.community_card_slots
  ADD COLUMN IF NOT EXISTS campaign_id uuid
    REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS campaign_assigned_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS campaign_assignment_override boolean NOT NULL
    DEFAULT false,
  ADD COLUMN IF NOT EXISTS campaign_assignment_override_reason text,
  ADD COLUMN IF NOT EXISTS campaign_assignment_revision bigint;

CREATE UNIQUE INDEX IF NOT EXISTS community_card_slots_campaign_assignment_idx
  ON public.community_card_slots(id, campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.community_mailer_production_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_card_id uuid NOT NULL REFERENCES public.community_cards(id)
    ON DELETE CASCADE,
  placement_id uuid NOT NULL REFERENCES public.community_card_slots(id)
    ON DELETE CASCADE,
  layout_revision bigint NOT NULL,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  campaign_updated_at timestamptz NOT NULL,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  fingerprint text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (placement_id, layout_revision)
);

CREATE TABLE IF NOT EXISTS public.community_mailer_qr_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_card_id uuid NOT NULL REFERENCES public.community_cards(id)
    ON DELETE CASCADE,
  placement_id uuid NOT NULL REFERENCES public.community_card_slots(id)
    ON DELETE CASCADE,
  qr_link_id uuid NOT NULL REFERENCES public.qr_links(id) ON DELETE RESTRICT,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  layout_revision bigint NOT NULL,
  zone_name text NOT NULL,
  slot_key text NOT NULL,
  destination_url text NOT NULL,
  active boolean NOT NULL,
  expires_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (placement_id, layout_revision),
  UNIQUE (community_card_id, layout_revision, qr_link_id, placement_id)
);

ALTER TABLE public.community_mailer_exports
  ADD COLUMN IF NOT EXISTS storage_prefix text,
  ADD COLUMN IF NOT EXISTS byte_size bigint CHECK (byte_size IS NULL OR byte_size > 0),
  ADD COLUMN IF NOT EXISTS generator_version text,
  ADD COLUMN IF NOT EXISTS printer_certified_at timestamptz,
  ADD COLUMN IF NOT EXISTS printer_certified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS certification_metadata jsonb,
  ADD COLUMN IF NOT EXISTS used_for_print_at timestamptz;

INSERT INTO storage.buckets (id, name, public)
VALUES ('community-mailer-production', 'community-mailer-production', false)
ON CONFLICT (id) DO UPDATE SET public = false;

ALTER TABLE public.community_mailer_production_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_mailer_qr_associations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.community_mailer_production_snapshots,
  public.community_mailer_qr_associations FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS "community mailer production admins manage objects"
  ON storage.objects;
CREATE POLICY "community mailer production admins manage objects"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'community-mailer-production'
    AND public.can_manage_community_mailers(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'community-mailer-production'
    AND public.can_manage_community_mailers(auth.uid())
    AND name ~ '^community-mailers/[0-9a-f-]{36}/revisions/[0-9]+/production-candidate/'
  );

CREATE OR REPLACE FUNCTION public.assign_admin_community_mailer_campaign(
  p_placement_id uuid,
  p_campaign_id uuid,
  p_override_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  slot public.community_card_slots%ROWTYPE;
  campaign public.campaigns%ROWTYPE;
  card public.community_cards%ROWTYPE;
  owner_matches boolean;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer administrator access required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO slot FROM public.community_card_slots
  WHERE id = p_placement_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Placement not found.'; END IF;
  SELECT * INTO card FROM public.community_cards
  WHERE id = slot.community_card_id FOR UPDATE;
  SELECT * INTO campaign FROM public.campaigns
  WHERE id = p_campaign_id;
  IF NOT FOUND OR campaign.status = 'expired' THEN
    RAISE EXCEPTION 'An active or scheduled Campaign is required.';
  END IF;
  IF card.layout_locked IS TRUE OR slot.is_locked IS TRUE THEN
    RAISE EXCEPTION 'Unlock the production revision before changing Campaign assignment.';
  END IF;
  owner_matches := slot.business_id IS NOT NULL
    AND campaign.business_id = slot.business_id;
  IF NOT owner_matches AND NULLIF(btrim(p_override_reason), '') IS NULL THEN
    RAISE EXCEPTION 'Campaign must belong to the placement business or include an override reason.';
  END IF;
  UPDATE public.community_card_slots SET
    campaign_id = campaign.id,
    campaign_assigned_at = now(),
    campaign_assigned_by = auth.uid(),
    campaign_assignment_override = NOT owner_matches,
    campaign_assignment_override_reason = CASE WHEN owner_matches THEN NULL
      ELSE btrim(p_override_reason) END,
    campaign_assignment_revision = card.layout_revision + 1
  WHERE id = slot.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_admin_community_mailer_snapshots(
  p_mailer_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE card public.community_cards%ROWTYPE; snapshot_count integer;
BEGIN
  IF NOT public.can_manage_community_mailers(auth.uid()) THEN
    RAISE EXCEPTION 'Community Mailer administrator access required.'
      USING ERRCODE = '42501';
  END IF;
  SELECT * INTO card FROM public.community_cards
  WHERE id = p_mailer_id FOR UPDATE;
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
  SELECT card.id, slot.id, card.layout_revision, campaign.id,
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
      'side', slot.side
    )),
    encode(extensions.digest(
      card.id::text || ':' || card.layout_revision::text || ':' ||
      slot.id::text || ':' || campaign.id::text || ':' ||
      campaign.updated_at::text, 'sha256'
    ), 'hex'),
    auth.uid()
  FROM public.community_card_slots AS slot
  JOIN public.campaigns AS campaign ON campaign.id = slot.campaign_id
  JOIN public.businesses AS business ON business.id = slot.business_id
  LEFT JOIN public.qr_links AS qr ON qr.id = slot.qr_link_id
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
    layout_revision, zone_name, slot_key, destination_url, active, expires_at,
    created_by
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


CREATE OR REPLACE FUNCTION public.invalidate_mailer_on_placement_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' OR
    ROW(NEW.business_id, NEW.campaign_id, NEW.creative_asset_id,
      NEW.ad_image_url, NEW.qr_link_id, NEW.proof_status, NEW.payment_status,
      NEW.side, NEW.x, NEW.y, NEW.width, NEW.height)
    IS DISTINCT FROM
    ROW(OLD.business_id, OLD.campaign_id, OLD.creative_asset_id,
      OLD.ad_image_url, OLD.qr_link_id, OLD.proof_status, OLD.payment_status,
      OLD.side, OLD.x, OLD.y, OLD.width, OLD.height)
  THEN
    UPDATE public.community_cards SET layout_revision = layout_revision + 1
    WHERE id = COALESCE(NEW.community_card_id, OLD.community_card_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_admin_community_mailer_campaign(
  uuid,uuid,text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_admin_community_mailer_snapshots(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_admin_community_mailer_campaign(
  uuid,uuid,text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_admin_community_mailer_snapshots(uuid)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
