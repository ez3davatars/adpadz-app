CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  headline text,
  description text,
  offer_title text,
  offer_description text,
  cta_label text,
  cta_url text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'scheduled', 'expired')),
  start_date timestamptz,
  end_date timestamptz,
  primary_image_id uuid NULL,
  primary_video_id uuid NULL,
  primary_qr_id uuid NULL REFERENCES public.qr_links(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_outputs (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  output_type text NOT NULL CHECK (output_type IN ('smart_card', 'interactive_ad', 'community_mailer', 'qr_landing', 'facebook', 'instagram', 'email', 'flyer')),
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, output_type)
);

-- Compatibility bridge only. Do not duplicate campaign content into interactive ads.
ALTER TABLE public.interactive_ads
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaigns_owner_status_idx ON public.campaigns(owner_id, status);
CREATE INDEX IF NOT EXISTS campaigns_business_status_idx ON public.campaigns(business_id, status);
CREATE INDEX IF NOT EXISTS campaign_outputs_type_enabled_idx ON public.campaign_outputs(output_type, enabled, sort_order);
CREATE INDEX IF NOT EXISTS campaign_outputs_metadata_gin_idx ON public.campaign_outputs USING gin(metadata);
CREATE INDEX IF NOT EXISTS interactive_ads_campaign_id_idx ON public.interactive_ads(campaign_id);

DROP TRIGGER IF EXISTS campaigns_set_updated_at ON public.campaigns;
CREATE TRIGGER campaigns_set_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.business_cards_set_updated_at();

DROP TRIGGER IF EXISTS campaign_outputs_set_updated_at ON public.campaign_outputs;
CREATE TRIGGER campaign_outputs_set_updated_at
  BEFORE UPDATE ON public.campaign_outputs
  FOR EACH ROW EXECUTE FUNCTION public.business_cards_set_updated_at();

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "campaigns_owner_select" ON public.campaigns;
CREATE POLICY "campaigns_owner_select" ON public.campaigns
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "campaigns_owner_insert" ON public.campaigns;
CREATE POLICY "campaigns_owner_insert" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "campaigns_owner_update" ON public.campaigns;
CREATE POLICY "campaigns_owner_update" ON public.campaigns
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "campaigns_owner_delete" ON public.campaigns;
CREATE POLICY "campaigns_owner_delete" ON public.campaigns
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "campaign_outputs_owner_select" ON public.campaign_outputs;
CREATE POLICY "campaign_outputs_owner_select" ON public.campaign_outputs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_outputs.campaign_id
        AND campaigns.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "campaign_outputs_owner_insert" ON public.campaign_outputs;
CREATE POLICY "campaign_outputs_owner_insert" ON public.campaign_outputs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_outputs.campaign_id
        AND campaigns.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "campaign_outputs_owner_update" ON public.campaign_outputs;
CREATE POLICY "campaign_outputs_owner_update" ON public.campaign_outputs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_outputs.campaign_id
        AND campaigns.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_outputs.campaign_id
        AND campaigns.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "campaign_outputs_owner_delete" ON public.campaign_outputs;
CREATE POLICY "campaign_outputs_owner_delete" ON public.campaign_outputs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns
      WHERE campaigns.id = campaign_outputs.campaign_id
        AND campaigns.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "campaign_outputs_public_smart_card_select" ON public.campaign_outputs;
CREATE POLICY "campaign_outputs_public_smart_card_select" ON public.campaign_outputs
  FOR SELECT TO anon, authenticated
  USING (
    enabled = true
    AND output_type = 'smart_card'
    AND EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = CASE
        WHEN campaign_outputs.metadata ? 'smart_card_id'
          AND (campaign_outputs.metadata->>'smart_card_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        THEN ((campaign_outputs.metadata->>'smart_card_id')::uuid)
        ELSE NULL
      END
      AND business_cards.is_published = true
    )
  );

DROP POLICY IF EXISTS "campaigns_public_smart_card_select" ON public.campaigns;
CREATE POLICY "campaigns_public_smart_card_select" ON public.campaigns
  FOR SELECT TO anon, authenticated
  USING (
    status IN ('active', 'scheduled')
    AND EXISTS (
      SELECT 1
      FROM public.campaign_outputs
      JOIN public.business_cards
        ON business_cards.id = CASE
          WHEN campaign_outputs.metadata ? 'smart_card_id'
            AND (campaign_outputs.metadata->>'smart_card_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN ((campaign_outputs.metadata->>'smart_card_id')::uuid)
          ELSE NULL
        END
      WHERE campaign_outputs.campaign_id = campaigns.id
        AND campaign_outputs.enabled = true
        AND campaign_outputs.output_type = 'smart_card'
        AND business_cards.is_published = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_outputs TO authenticated;
GRANT SELECT ON public.campaigns TO anon;
GRANT SELECT ON public.campaign_outputs TO anon;