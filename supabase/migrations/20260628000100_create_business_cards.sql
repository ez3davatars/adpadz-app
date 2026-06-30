-- Adpadz Smart Cards
-- Digital local-business profiles, public card pages, custom links, offers,
-- events, and QR Studio destination metadata.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.business_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid DEFAULT auth.uid(),
  business_id uuid,
  business_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  tagline text,
  logo_url text,
  cover_image_url text,
  phone text,
  email text,
  website text,
  address text,
  google_maps_url text,
  bio text,
  theme text NOT NULL DEFAULT 'market-pop' CHECK (theme IN ('market-pop', 'neon-local', 'sunset-shop', 'fresh-service')),
  primary_color text NOT NULL DEFAULT '#B6FF00',
  accent_color text NOT NULL DEFAULT '#14B8A6',
  is_published boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_cards_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT business_cards_website_http CHECK (website IS NULL OR website = '' OR website ~* '^https?://'),
  CONSTRAINT business_cards_google_maps_http CHECK (google_maps_url IS NULL OR google_maps_url = '' OR google_maps_url ~* '^https?://')
);

CREATE TABLE IF NOT EXISTS public.business_card_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_card_id uuid NOT NULL REFERENCES public.business_cards(id) ON DELETE CASCADE,
  label text NOT NULL,
  url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_card_links_url_http CHECK (url ~* '^https?://')
);

CREATE TABLE IF NOT EXISTS public.business_card_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_card_id uuid NOT NULL REFERENCES public.business_cards(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  claim_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  claim_count integer NOT NULL DEFAULT 0 CHECK (claim_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_card_offers_claim_url_http CHECK (claim_url IS NULL OR claim_url = '' OR claim_url ~* '^https?://')
);

CREATE TABLE IF NOT EXISTS public.business_card_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_card_id uuid REFERENCES public.business_cards(id) ON DELETE CASCADE,
  qr_link_id uuid REFERENCES public.qr_links(id) ON DELETE SET NULL,
  offer_id uuid REFERENCES public.business_card_offers(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (
    event_type IN (
      'card_view',
      'qr_scan',
      'call_click',
      'text_click',
      'email_click',
      'website_click',
      'directions_click',
      'offer_view',
      'offer_claim',
      'save_contact'
    )
  ),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  referrer text,
  metadata jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE public.qr_links
  ADD COLUMN IF NOT EXISTS destination_type text NOT NULL DEFAULT 'url'
    CHECK (destination_type IN ('url', 'business_card')),
  ADD COLUMN IF NOT EXISTS destination_id uuid;

CREATE INDEX IF NOT EXISTS business_cards_owner_user_id_idx ON public.business_cards(owner_user_id);
CREATE INDEX IF NOT EXISTS business_cards_slug_idx ON public.business_cards(slug);
CREATE INDEX IF NOT EXISTS business_cards_published_idx ON public.business_cards(is_published);
CREATE INDEX IF NOT EXISTS business_card_links_card_sort_idx ON public.business_card_links(business_card_id, sort_order);
CREATE INDEX IF NOT EXISTS business_card_offers_card_active_idx ON public.business_card_offers(business_card_id, is_active);
CREATE INDEX IF NOT EXISTS business_card_events_card_type_time_idx ON public.business_card_events(business_card_id, event_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS business_card_events_qr_link_id_idx ON public.business_card_events(qr_link_id);
CREATE INDEX IF NOT EXISTS qr_links_destination_idx ON public.qr_links(destination_type, destination_id);

CREATE OR REPLACE FUNCTION public.business_cards_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_cards_set_updated_at ON public.business_cards;
CREATE TRIGGER business_cards_set_updated_at
  BEFORE UPDATE ON public.business_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.business_cards_set_updated_at();

DROP TRIGGER IF EXISTS business_card_links_set_updated_at ON public.business_card_links;
CREATE TRIGGER business_card_links_set_updated_at
  BEFORE UPDATE ON public.business_card_links
  FOR EACH ROW
  EXECUTE FUNCTION public.business_cards_set_updated_at();

DROP TRIGGER IF EXISTS business_card_offers_set_updated_at ON public.business_card_offers;
CREATE TRIGGER business_card_offers_set_updated_at
  BEFORE UPDATE ON public.business_card_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.business_cards_set_updated_at();

CREATE OR REPLACE FUNCTION public.business_cards_increment_event_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type = 'card_view' AND NEW.business_card_id IS NOT NULL THEN
    UPDATE public.business_cards
    SET view_count = view_count + 1
    WHERE id = NEW.business_card_id;
  END IF;

  IF NEW.event_type = 'offer_view' AND NEW.offer_id IS NOT NULL THEN
    UPDATE public.business_card_offers
    SET view_count = view_count + 1
    WHERE id = NEW.offer_id;
  END IF;

  IF NEW.event_type = 'offer_claim' AND NEW.offer_id IS NOT NULL THEN
    UPDATE public.business_card_offers
    SET claim_count = claim_count + 1
    WHERE id = NEW.offer_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_card_events_increment_counts ON public.business_card_events;
CREATE TRIGGER business_card_events_increment_counts
  AFTER INSERT ON public.business_card_events
  FOR EACH ROW
  EXECUTE FUNCTION public.business_cards_increment_event_counts();

ALTER TABLE public.business_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_card_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_card_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_card_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_cards_owner_select" ON public.business_cards;
CREATE POLICY "business_cards_owner_select" ON public.business_cards
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "business_cards_public_read_published" ON public.business_cards;
CREATE POLICY "business_cards_public_read_published" ON public.business_cards
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "business_cards_owner_insert" ON public.business_cards;
CREATE POLICY "business_cards_owner_insert" ON public.business_cards
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "business_cards_owner_update" ON public.business_cards;
CREATE POLICY "business_cards_owner_update" ON public.business_cards
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "business_cards_owner_delete" ON public.business_cards;
CREATE POLICY "business_cards_owner_delete" ON public.business_cards
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "business_card_links_public_read" ON public.business_card_links;
CREATE POLICY "business_card_links_public_read" ON public.business_card_links
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_links.business_card_id
        AND business_cards.is_published = true
    )
  );

DROP POLICY IF EXISTS "business_card_links_owner_manage" ON public.business_card_links;
CREATE POLICY "business_card_links_owner_manage" ON public.business_card_links
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_links.business_card_id
        AND business_cards.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_links.business_card_id
        AND business_cards.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "business_card_offers_public_read" ON public.business_card_offers;
CREATE POLICY "business_card_offers_public_read" ON public.business_card_offers
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
    AND EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_offers.business_card_id
        AND business_cards.is_published = true
    )
  );

DROP POLICY IF EXISTS "business_card_offers_owner_manage" ON public.business_card_offers;
CREATE POLICY "business_card_offers_owner_manage" ON public.business_card_offers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_offers.business_card_id
        AND business_cards.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_offers.business_card_id
        AND business_cards.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "business_card_events_public_insert" ON public.business_card_events;
CREATE POLICY "business_card_events_public_insert" ON public.business_card_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    business_card_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_events.business_card_id
        AND business_cards.is_published = true
    )
  );

DROP POLICY IF EXISTS "business_card_events_owner_select" ON public.business_card_events;
CREATE POLICY "business_card_events_owner_select" ON public.business_card_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_events.business_card_id
        AND business_cards.owner_user_id = auth.uid()
    )
  );

GRANT SELECT ON public.business_cards TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_cards TO authenticated;
GRANT SELECT ON public.business_card_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_card_links TO authenticated;
GRANT SELECT ON public.business_card_offers TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.business_card_offers TO authenticated;
GRANT INSERT ON public.business_card_events TO anon, authenticated;
GRANT SELECT ON public.business_card_events TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_qr_redirect(
  p_slug text,
  p_user_agent text DEFAULT NULL,
  p_referrer text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.qr_links%ROWTYPE;
  v_card public.business_cards%ROWTYPE;
BEGIN
  IF p_slug IS NULL OR p_slug !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'not_found');
  END IF;

  SELECT *
  INTO v_link
  FROM public.qr_links
  WHERE slug = lower(p_slug)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'status', 'not_found');
  END IF;

  IF v_link.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'inactive');
  END IF;

  IF v_link.expires_at IS NOT NULL AND v_link.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'status', 'expired');
  END IF;

  INSERT INTO public.qr_scan_events (
    qr_link_id,
    user_agent,
    referrer,
    metadata
  ) VALUES (
    v_link.id,
    p_user_agent,
    p_referrer,
    jsonb_build_object(
      'source', 'php_redirect',
      'slug', v_link.slug,
      'destination_type', v_link.destination_type
    )
  );

  IF v_link.destination_type = 'business_card' AND v_link.destination_id IS NOT NULL THEN
    SELECT *
    INTO v_card
    FROM public.business_cards
    WHERE id = v_link.destination_id
      AND is_published = true
    LIMIT 1;

    IF FOUND THEN
      INSERT INTO public.business_card_events (
        business_card_id,
        qr_link_id,
        event_type,
        user_agent,
        referrer,
        metadata
      ) VALUES (
        v_card.id,
        v_link.id,
        'qr_scan',
        p_user_agent,
        p_referrer,
        jsonb_build_object(
          'source', 'php_redirect',
          'slug', v_link.slug
        )
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'status', 'ok',
    'destination_url', v_link.destination_url
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_qr_redirect(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_qr_redirect(text, text, text) TO anon, authenticated;
