-- Reconcile databases that applied the original 20260713193000 migration
-- before its table definition was expanded in repository history.
-- Keep zone_name as the canonical mailing-zone field; market_name remains
-- only as a legacy source for the one-time data backfill.

ALTER TABLE public.community_cards
  ADD COLUMN IF NOT EXISTS zone_name text,
  ADD COLUMN IF NOT EXISTS public_slug text,
  ADD COLUMN IF NOT EXISTS sales_open boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false;

UPDATE public.community_cards
SET zone_name = NULLIF(btrim(market_name), '')
WHERE zone_name IS NULL
  AND NULLIF(btrim(market_name), '') IS NOT NULL;

UPDATE public.community_cards
SET public_slug = lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
WHERE public_slug IS NULL OR btrim(public_slug) = '';

ALTER TABLE public.community_cards
  ALTER COLUMN public_slug SET DEFAULT lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  ALTER COLUMN public_slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS community_cards_public_slug_uidx
  ON public.community_cards(public_slug);

COMMENT ON COLUMN public.community_cards.zone_name IS
  'Canonical mailing-zone label. Backfilled from legacy market_name.';
COMMENT ON COLUMN public.community_cards.market_name IS
  'Legacy mailing-zone field retained for compatibility; use zone_name.';

ALTER TABLE public.community_card_slots
  ADD COLUMN IF NOT EXISTS ad_image_url text,
  ADD COLUMN IF NOT EXISTS buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- The original schema required placement_type, while the fixed-layout model
-- derives placement geometry from layout_key and slot_key.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'community_card_slots'
      AND column_name = 'placement_type'
  ) THEN
    ALTER TABLE public.community_card_slots
      ALTER COLUMN placement_type SET DEFAULT 'standard';
  END IF;
END;
$$;

ALTER TABLE public.community_card_slots
  ALTER COLUMN price_cents SET DEFAULT 25000;

CREATE TABLE IF NOT EXISTS public.community_card_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_card_id uuid NOT NULL REFERENCES public.community_cards(id) ON DELETE CASCADE,
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_ids uuid[] NOT NULL,
  quantity integer NOT NULL CHECK (quantity IN (1, 2)),
  amount_cents integer NOT NULL CHECK (amount_cents IN (25000, 50000)),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending_payment', 'paid', 'cancelled', 'expired', 'proof_pending', 'approved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(slot_ids) = quantity),
  CHECK (amount_cents = quantity * 25000)
);

CREATE INDEX IF NOT EXISTS community_card_orders_buyer_idx
  ON public.community_card_orders(buyer_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.community_cards_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_card_orders_set_updated_at
  ON public.community_card_orders;
CREATE TRIGGER community_card_orders_set_updated_at
  BEFORE UPDATE ON public.community_card_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.community_cards_set_updated_at();

ALTER TABLE public.community_card_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "published cards are visible" ON public.community_cards;
CREATE POLICY "published cards are visible"
  ON public.community_cards
  FOR SELECT
  TO anon, authenticated
  USING (is_published IS TRUE);

DROP POLICY IF EXISTS "published card slots are visible" ON public.community_card_slots;
CREATE POLICY "published card slots are visible"
  ON public.community_card_slots
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.community_cards AS card
      WHERE card.id = community_card_id
        AND card.is_published IS TRUE
    )
  );

DROP POLICY IF EXISTS "buyers see their orders" ON public.community_card_orders;
CREATE POLICY "buyers see their orders"
  ON public.community_card_orders
  FOR SELECT
  TO authenticated
  USING (buyer_user_id = auth.uid());

DROP POLICY IF EXISTS "buyers start orders" ON public.community_card_orders;
CREATE POLICY "buyers start orders"
  ON public.community_card_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (buyer_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.reserve_community_card_spaces(
  p_card_id uuid,
  p_slot_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_order_id uuid;
  v_count integer := cardinality(p_slot_ids);
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before reserving an ad space.';
  END IF;
  IF v_count NOT IN (1, 2)
     OR cardinality(ARRAY(SELECT DISTINCT unnest(p_slot_ids))) <> v_count THEN
    RAISE EXCEPTION 'Choose one or two unique ad spaces.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.community_cards
    WHERE id = p_card_id
      AND is_published IS TRUE
      AND sales_open IS TRUE
  ) THEN
    RAISE EXCEPTION 'This mailing zone is not currently open for sales.';
  END IF;

  PERFORM 1
  FROM public.community_card_slots
  WHERE id = ANY(p_slot_ids)
    AND community_card_id = p_card_id
  FOR UPDATE;

  IF (
    SELECT count(*)
    FROM public.community_card_slots
    WHERE id = ANY(p_slot_ids)
      AND community_card_id = p_card_id
      AND status = 'available'
  ) <> v_count THEN
    RAISE EXCEPTION 'One or more selected spaces just filled. Please choose another space.';
  END IF;

  INSERT INTO public.community_card_orders (
    community_card_id,
    buyer_user_id,
    slot_ids,
    quantity,
    amount_cents,
    status
  )
  VALUES (
    p_card_id,
    v_user_id,
    p_slot_ids,
    v_count,
    v_count * 25000,
    'pending_payment'
  )
  RETURNING id INTO v_order_id;

  UPDATE public.community_card_slots
  SET status = 'reserved',
      buyer_user_id = v_user_id
  WHERE id = ANY(p_slot_ids)
    AND community_card_id = p_card_id;

  RETURN v_order_id;
END;
$$;

DROP POLICY IF EXISTS "published cards are visible" ON public.community_cards;
DROP POLICY IF EXISTS "published card slots are visible" ON public.community_card_slots;
DROP POLICY IF EXISTS "buyers start orders" ON public.community_card_orders;
REVOKE ALL ON TABLE public.community_cards, public.community_card_slots,
  public.community_card_orders FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.community_card_orders TO authenticated;
REVOKE ALL ON FUNCTION public.reserve_community_card_spaces(uuid, uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_community_card_spaces(uuid, uuid[])
  TO authenticated;

NOTIFY pgrst, 'reload schema';
