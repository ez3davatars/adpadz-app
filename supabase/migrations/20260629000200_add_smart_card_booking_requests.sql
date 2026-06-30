ALTER TABLE public.business_cards
  ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'external',
  ADD COLUMN IF NOT EXISTS booking_request_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_request_title text NOT NULL DEFAULT 'Request an Appointment',
  ADD COLUMN IF NOT EXISTS booking_request_description text,
  ADD COLUMN IF NOT EXISTS booking_request_button_label text NOT NULL DEFAULT 'Request Booking';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_cards_booking_mode_check'
      AND conrelid = 'public.business_cards'::regclass
  ) THEN
    ALTER TABLE public.business_cards
      ADD CONSTRAINT business_cards_booking_mode_check
      CHECK (booking_mode IN ('external', 'request'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.business_card_booking_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES public.business_cards(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  duration_minutes integer,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_card_booking_services_duration_check CHECK (duration_minutes IS NULL OR duration_minutes > 0)
);

CREATE INDEX IF NOT EXISTS business_card_booking_services_card_sort_idx
  ON public.business_card_booking_services(card_id, sort_order);
CREATE INDEX IF NOT EXISTS business_card_booking_services_owner_idx
  ON public.business_card_booking_services(owner_id);

CREATE OR REPLACE FUNCTION public.business_card_booking_services_set_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  SELECT owner_user_id INTO v_owner
  FROM public.business_cards
  WHERE id = NEW.card_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Smart Card owner not found';
  END IF;

  NEW.owner_id = v_owner;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS business_card_booking_services_set_owner ON public.business_card_booking_services;
CREATE TRIGGER business_card_booking_services_set_owner
  BEFORE INSERT ON public.business_card_booking_services
  FOR EACH ROW EXECUTE FUNCTION public.business_card_booking_services_set_owner();

DROP TRIGGER IF EXISTS business_card_booking_services_set_updated_at ON public.business_card_booking_services;
CREATE TRIGGER business_card_booking_services_set_updated_at
  BEFORE UPDATE ON public.business_card_booking_services
  FOR EACH ROW EXECUTE FUNCTION public.business_cards_set_updated_at();

ALTER TABLE public.business_card_booking_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "business_card_booking_services_owner_manage" ON public.business_card_booking_services;
CREATE POLICY "business_card_booking_services_owner_manage" ON public.business_card_booking_services
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "business_card_booking_services_public_read" ON public.business_card_booking_services;
CREATE POLICY "business_card_booking_services_public_read" ON public.business_card_booking_services
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_booking_services.card_id
        AND business_cards.is_published = true
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_card_booking_services TO authenticated;
GRANT SELECT ON public.business_card_booking_services TO anon;

ALTER TABLE public.business_card_events
  DROP CONSTRAINT IF EXISTS business_card_events_event_type_check;

ALTER TABLE public.business_card_events
  ADD CONSTRAINT business_card_events_event_type_check CHECK (
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
      'save_contact',
      'document_view',
      'document_click',
      'virtual_tour_view',
      'virtual_tour_click',
      'before_after_view',
      'before_after_interaction',
      'testimonial_view',
      'lead_submit',
      'booking_click',
      'booking_request_submit',
      'media_click'
    )
  );

DROP POLICY IF EXISTS "business_card_leads_public_insert" ON public.business_card_leads;
CREATE POLICY "business_card_leads_public_insert" ON public.business_card_leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.business_cards
      WHERE business_cards.id = business_card_leads.card_id
        AND business_cards.is_published = true
        AND (
          business_cards.lead_form_enabled = true
          OR business_cards.booking_request_enabled = true
        )
    )
  );
