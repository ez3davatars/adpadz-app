-- Adpadz Smart Cards v3: Business Marketing Hub
-- Safe additive schema for marketing assets, documents, tours, before/after,
-- testimonials, lead capture, booking links, and expanded analytics events.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.business_cards
  ADD COLUMN IF NOT EXISTS featured_video_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_video_url text,
  ADD COLUMN IF NOT EXISTS featured_video_title text DEFAULT 'Local Spotlight',
  ADD COLUMN IF NOT EXISTS booking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_url text,
  ADD COLUMN IF NOT EXISTS booking_label text NOT NULL DEFAULT 'Book Now',
  ADD COLUMN IF NOT EXISTS booking_provider text,
  ADD COLUMN IF NOT EXISTS lead_form_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_form_title text NOT NULL DEFAULT 'Request Information',
  ADD COLUMN IF NOT EXISTS lead_form_description text,
  ADD COLUMN IF NOT EXISTS lead_form_button_label text NOT NULL DEFAULT 'Send Request';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_card_events_event_type_check') THEN
    ALTER TABLE public.business_card_events DROP CONSTRAINT business_card_events_event_type_check;
  END IF;
END $$;

ALTER TABLE public.business_card_events
  ADD CONSTRAINT business_card_events_event_type_check
  CHECK (event_type IN (
    'card_view','qr_scan','call_click','text_click','email_click','website_click','directions_click',
    'offer_view','offer_claim','save_contact','document_view','document_click','virtual_tour_view',
    'virtual_tour_click','before_after_view','before_after_interaction','testimonial_view','lead_submit',
    'booking_click','media_click'
  ));

CREATE TABLE IF NOT EXISTS public.business_marketing_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  smart_card_id uuid REFERENCES public.business_cards(id) ON DELETE CASCADE,
  owner_id uuid DEFAULT auth.uid(),
  asset_type text NOT NULL CHECK (asset_type IN (
    'image','logo','cover','gallery','video','brochure','menu','virtual_tour','before_after',
    'testimonial','coupon','document','other'
  )),
  title text NOT NULL,
  description text,
  file_url text,
  external_url text,
  thumbnail_url text,
  provider text,
  provider_asset_id text,
  mime_type text,
  file_size_bytes bigint,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_marketing_assets_file_url_http CHECK (file_url IS NULL OR file_url = '' OR file_url ~* '^https?://'),
  CONSTRAINT business_marketing_assets_external_url_http CHECK (external_url IS NULL OR external_url = '' OR external_url ~* '^https?://'),
  CONSTRAINT business_marketing_assets_thumbnail_url_http CHECK (thumbnail_url IS NULL OR thumbnail_url = '' OR thumbnail_url ~* '^https?://')
);

CREATE TABLE IF NOT EXISTS public.business_card_before_after_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.business_cards(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  before_image_url text NOT NULL,
  after_image_url text NOT NULL,
  before_image_id text,
  after_image_id text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_card_before_after_before_url_http CHECK (before_image_url ~* '^https?://'),
  CONSTRAINT business_card_before_after_after_url_http CHECK (after_image_url ~* '^https?://')
);

CREATE TABLE IF NOT EXISTS public.business_card_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.business_cards(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  customer_name text NOT NULL,
  rating integer CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  quote text NOT NULL,
  image_url text,
  video_url text,
  source text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_card_testimonials_image_url_http CHECK (image_url IS NULL OR image_url = '' OR image_url ~* '^https?://'),
  CONSTRAINT business_card_testimonials_video_url_http CHECK (video_url IS NULL OR video_url = '' OR video_url ~* '^https?://')
);

CREATE TABLE IF NOT EXISTS public.business_card_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.business_cards(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  message text,
  lead_type text NOT NULL DEFAULT 'general',
  source text NOT NULL DEFAULT 'smart_card',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','closed','archived')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_card_leads_contact_required CHECK (COALESCE(NULLIF(phone, ''), NULLIF(email, '')) IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS business_marketing_assets_owner_idx ON public.business_marketing_assets(owner_id);
CREATE INDEX IF NOT EXISTS business_marketing_assets_card_type_idx ON public.business_marketing_assets(smart_card_id, asset_type, sort_order);
CREATE INDEX IF NOT EXISTS business_card_before_after_card_sort_idx ON public.business_card_before_after_items(card_id, sort_order);
CREATE INDEX IF NOT EXISTS business_card_testimonials_card_sort_idx ON public.business_card_testimonials(card_id, sort_order);
CREATE INDEX IF NOT EXISTS business_card_leads_card_created_idx ON public.business_card_leads(card_id, created_at DESC);
CREATE INDEX IF NOT EXISTS business_card_leads_owner_status_idx ON public.business_card_leads(owner_id, status);

DROP TRIGGER IF EXISTS business_marketing_assets_set_updated_at ON public.business_marketing_assets;
CREATE TRIGGER business_marketing_assets_set_updated_at
  BEFORE UPDATE ON public.business_marketing_assets
  FOR EACH ROW EXECUTE FUNCTION public.business_cards_set_updated_at();

DROP TRIGGER IF EXISTS business_card_before_after_set_updated_at ON public.business_card_before_after_items;
CREATE TRIGGER business_card_before_after_set_updated_at
  BEFORE UPDATE ON public.business_card_before_after_items
  FOR EACH ROW EXECUTE FUNCTION public.business_cards_set_updated_at();

DROP TRIGGER IF EXISTS business_card_testimonials_set_updated_at ON public.business_card_testimonials;
CREATE TRIGGER business_card_testimonials_set_updated_at
  BEFORE UPDATE ON public.business_card_testimonials
  FOR EACH ROW EXECUTE FUNCTION public.business_cards_set_updated_at();

CREATE OR REPLACE FUNCTION public.business_card_leads_set_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT owner_user_id INTO v_owner FROM public.business_cards WHERE id = NEW.card_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Smart Card owner not found';
  END IF;
  NEW.owner_id = v_owner;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_card_leads_set_owner ON public.business_card_leads;
CREATE TRIGGER business_card_leads_set_owner
  BEFORE INSERT ON public.business_card_leads
  FOR EACH ROW EXECUTE FUNCTION public.business_card_leads_set_owner();

ALTER TABLE public.business_marketing_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_card_before_after_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_card_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_card_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_marketing_assets_owner_manage" ON public.business_marketing_assets;
CREATE POLICY "business_marketing_assets_owner_manage" ON public.business_marketing_assets
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "business_marketing_assets_public_read" ON public.business_marketing_assets;
CREATE POLICY "business_marketing_assets_public_read" ON public.business_marketing_assets
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND smart_card_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_marketing_assets.smart_card_id
        AND business_cards.is_published = true
    )
  );

DROP POLICY IF EXISTS "business_card_before_after_owner_manage" ON public.business_card_before_after_items;
CREATE POLICY "business_card_before_after_owner_manage" ON public.business_card_before_after_items
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "business_card_before_after_public_read" ON public.business_card_before_after_items;
CREATE POLICY "business_card_before_after_public_read" ON public.business_card_before_after_items
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_before_after_items.card_id
        AND business_cards.is_published = true
    )
  );

DROP POLICY IF EXISTS "business_card_testimonials_owner_manage" ON public.business_card_testimonials;
CREATE POLICY "business_card_testimonials_owner_manage" ON public.business_card_testimonials
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "business_card_testimonials_public_read" ON public.business_card_testimonials;
CREATE POLICY "business_card_testimonials_public_read" ON public.business_card_testimonials
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_testimonials.card_id
        AND business_cards.is_published = true
    )
  );

DROP POLICY IF EXISTS "business_card_leads_owner_select" ON public.business_card_leads;
CREATE POLICY "business_card_leads_owner_select" ON public.business_card_leads
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "business_card_leads_public_insert" ON public.business_card_leads;
CREATE POLICY "business_card_leads_public_insert" ON public.business_card_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_leads.card_id
        AND business_cards.is_published = true
        AND business_cards.lead_form_enabled = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_marketing_assets TO authenticated;
GRANT SELECT ON public.business_marketing_assets TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_card_before_after_items TO authenticated;
GRANT SELECT ON public.business_card_before_after_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_card_testimonials TO authenticated;
GRANT SELECT ON public.business_card_testimonials TO anon;
GRANT SELECT ON public.business_card_leads TO authenticated;
GRANT INSERT ON public.business_card_leads TO anon, authenticated;
