-- Community Cards are physical distribution campaigns. Each placement can
-- connect to an existing Adpadz campaign and QR link without duplicating its
-- creative or analytics data.

CREATE TABLE IF NOT EXISTS public.community_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  market_name text,
  format text NOT NULL CHECK (format IN ('postcard_9x12', 'community_card_6x11')),
  layout_key text NOT NULL,
  mailing_date date,
  household_count integer CHECK (household_count IS NULL OR household_count > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'selling', 'proof', 'approved', 'mailed', 'archived')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_card_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_card_id uuid NOT NULL REFERENCES public.community_cards(id) ON DELETE CASCADE,
  slot_key text NOT NULL,
  label text NOT NULL,
  placement_type text NOT NULL CHECK (placement_type IN ('featured', 'standard', 'mini', 'adpadz')),
  side text NOT NULL CHECK (side IN ('front', 'back')),
  x numeric(6,3) NOT NULL CHECK (x >= 0 AND x <= 100),
  y numeric(6,3) NOT NULL CHECK (y >= 0 AND y <= 100),
  width numeric(6,3) NOT NULL CHECK (width > 0 AND width <= 100),
  height numeric(6,3) NOT NULL CHECK (height > 0 AND height <= 100),
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  category text,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold', 'intake', 'proof', 'approved')),
  advertiser_name text,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  qr_link_id uuid REFERENCES public.qr_links(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_card_id, slot_key)
);

CREATE INDEX IF NOT EXISTS community_cards_owner_status_idx
  ON public.community_cards(owner_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS community_card_slots_card_status_idx
  ON public.community_card_slots(community_card_id, status);
CREATE INDEX IF NOT EXISTS community_card_slots_campaign_idx
  ON public.community_card_slots(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS community_card_slots_qr_idx
  ON public.community_card_slots(qr_link_id) WHERE qr_link_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.community_cards_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- A category is exclusive once a placement is reserved or farther into the
-- production workflow.  Available inventory can be tagged without blocking
-- a future sale decision.
CREATE OR REPLACE FUNCTION public.community_card_slot_category_is_available()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.category IS NULL
     OR btrim(NEW.category) = ''
     OR NEW.status = 'available' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.community_card_slots AS existing_slot
    WHERE existing_slot.community_card_id = NEW.community_card_id
      AND existing_slot.id IS DISTINCT FROM NEW.id
      AND existing_slot.status <> 'available'
      AND lower(btrim(existing_slot.category)) = lower(btrim(NEW.category))
  ) THEN
    RAISE EXCEPTION 'Category "%" is already reserved on this community card.', NEW.category
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_cards_set_updated_at ON public.community_cards;
CREATE TRIGGER community_cards_set_updated_at
  BEFORE UPDATE ON public.community_cards
  FOR EACH ROW EXECUTE FUNCTION public.community_cards_set_updated_at();

DROP TRIGGER IF EXISTS community_card_slots_set_updated_at ON public.community_card_slots;
CREATE TRIGGER community_card_slots_set_updated_at
  BEFORE UPDATE ON public.community_card_slots
  FOR EACH ROW EXECUTE FUNCTION public.community_cards_set_updated_at();

DROP TRIGGER IF EXISTS community_card_slots_category_exclusivity ON public.community_card_slots;
CREATE TRIGGER community_card_slots_category_exclusivity
  BEFORE INSERT OR UPDATE OF category, status, community_card_id ON public.community_card_slots
  FOR EACH ROW EXECUTE FUNCTION public.community_card_slot_category_is_available();

ALTER TABLE public.community_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_card_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_cards_owner_all" ON public.community_cards;
CREATE POLICY "community_cards_owner_all" ON public.community_cards
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "community_card_slots_owner_all" ON public.community_card_slots;
CREATE POLICY "community_card_slots_owner_all" ON public.community_card_slots
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.community_cards
      WHERE community_cards.id = community_card_slots.community_card_id
        AND community_cards.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.community_cards
      WHERE community_cards.id = community_card_slots.community_card_id
        AND community_cards.owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_card_slots TO authenticated;
