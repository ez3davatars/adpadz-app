-- Adpadz QR Studio
-- Creates dynamic short links, circular Pad QR styling metadata, scan events,
-- and future attachment records for offers, campaigns, mailers, and profiles.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.qr_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid DEFAULT auth.uid(),
  business_id uuid,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  destination_url text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  purpose text,
  campaign_name text,
  source text,
  medium text DEFAULT 'qr',
  tags text[] NOT NULL DEFAULT '{}',
  style_preset text NOT NULL DEFAULT 'circular-pad' CHECK (style_preset IN ('standard', 'circular-pad', 'digital-pad')),
  top_ring_text text DEFAULT 'Adpadz Local Advertising Cooperative',
  bottom_ring_text text DEFAULT 'Support Local - Save Local - Discover More',
  center_label text DEFAULT 'adpadz',
  foreground_color text NOT NULL DEFAULT '#111111',
  background_color text NOT NULL DEFAULT '#f4f4f1',
  accent_color text NOT NULL DEFAULT '#76C943',
  show_center_label boolean NOT NULL DEFAULT true,
  show_short_url boolean NOT NULL DEFAULT true,
  scan_count integer NOT NULL DEFAULT 0 CHECK (scan_count >= 0),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qr_links_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT qr_links_destination_url_http CHECK (destination_url ~* '^https?://')
);

CREATE TABLE IF NOT EXISTS public.qr_scan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_link_id uuid NOT NULL REFERENCES public.qr_links(id) ON DELETE CASCADE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  referrer text,
  device_type text,
  browser text,
  os text,
  country text,
  region text,
  city text,
  ip_hash text,
  metadata jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS public.qr_link_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_link_id uuid NOT NULL REFERENCES public.qr_links(id) ON DELETE CASCADE,
  object_type text NOT NULL,
  object_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qr_link_attachments_object_type_format CHECK (object_type ~ '^[a-z0-9_]+$')
);

CREATE INDEX IF NOT EXISTS qr_links_owner_user_id_idx ON public.qr_links(owner_user_id);
CREATE INDEX IF NOT EXISTS qr_links_business_id_idx ON public.qr_links(business_id);
CREATE INDEX IF NOT EXISTS qr_links_status_idx ON public.qr_links(status);
CREATE INDEX IF NOT EXISTS qr_links_campaign_name_idx ON public.qr_links(campaign_name);
CREATE INDEX IF NOT EXISTS qr_scan_events_qr_link_id_scanned_at_idx ON public.qr_scan_events(qr_link_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS qr_link_attachments_qr_link_id_idx ON public.qr_link_attachments(qr_link_id);
CREATE INDEX IF NOT EXISTS qr_link_attachments_object_idx ON public.qr_link_attachments(object_type, object_id);

CREATE OR REPLACE FUNCTION public.qr_studio_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qr_links_set_updated_at ON public.qr_links;
CREATE TRIGGER qr_links_set_updated_at
  BEFORE UPDATE ON public.qr_links
  FOR EACH ROW
  EXECUTE FUNCTION public.qr_studio_set_updated_at();

CREATE OR REPLACE FUNCTION public.qr_studio_increment_scan_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.qr_links
  SET scan_count = scan_count + 1
  WHERE id = NEW.qr_link_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qr_scan_events_increment_count ON public.qr_scan_events;
CREATE TRIGGER qr_scan_events_increment_count
  AFTER INSERT ON public.qr_scan_events
  FOR EACH ROW
  EXECUTE FUNCTION public.qr_studio_increment_scan_count();

ALTER TABLE public.qr_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_link_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qr_links_owner_select" ON public.qr_links;
CREATE POLICY "qr_links_owner_select" ON public.qr_links
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "qr_links_public_read_active" ON public.qr_links;
CREATE POLICY "qr_links_public_read_active" ON public.qr_links
  FOR SELECT TO anon, authenticated
  USING (status = 'active' AND (expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS "qr_links_owner_insert" ON public.qr_links;
CREATE POLICY "qr_links_owner_insert" ON public.qr_links
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "qr_links_owner_update" ON public.qr_links;
CREATE POLICY "qr_links_owner_update" ON public.qr_links
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "qr_links_owner_delete" ON public.qr_links;
CREATE POLICY "qr_links_owner_delete" ON public.qr_links
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "qr_scan_events_public_insert" ON public.qr_scan_events;
CREATE POLICY "qr_scan_events_public_insert" ON public.qr_scan_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.qr_links
      WHERE qr_links.id = qr_scan_events.qr_link_id
        AND qr_links.status = 'active'
        AND (qr_links.expires_at IS NULL OR qr_links.expires_at > now())
    )
  );

DROP POLICY IF EXISTS "qr_scan_events_owner_select" ON public.qr_scan_events;
CREATE POLICY "qr_scan_events_owner_select" ON public.qr_scan_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.qr_links
      WHERE qr_links.id = qr_scan_events.qr_link_id
        AND qr_links.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "qr_link_attachments_owner_manage" ON public.qr_link_attachments;
CREATE POLICY "qr_link_attachments_owner_manage" ON public.qr_link_attachments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.qr_links
      WHERE qr_links.id = qr_link_attachments.qr_link_id
        AND qr_links.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.qr_links
      WHERE qr_links.id = qr_link_attachments.qr_link_id
        AND qr_links.owner_user_id = auth.uid()
    )
  );

GRANT SELECT ON public.qr_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.qr_links TO authenticated;
GRANT INSERT ON public.qr_scan_events TO anon, authenticated;
GRANT SELECT ON public.qr_scan_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_link_attachments TO authenticated;
