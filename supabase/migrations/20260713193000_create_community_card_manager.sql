-- Community Appreciation Cards: fixed 2.75 x 3.5 inch inventory and public booking.
CREATE TABLE IF NOT EXISTS public.community_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL, market_name text, zone_name text, public_slug text NOT NULL UNIQUE DEFAULT lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  format text NOT NULL CHECK (format IN ('postcard_9x12','community_card_6x11')), layout_key text NOT NULL,
  mailing_date date, household_count integer CHECK (household_count IS NULL OR household_count > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','selling','proof','approved','mailed','archived')),
  sales_open boolean NOT NULL DEFAULT false, is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.community_card_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_card_id uuid NOT NULL REFERENCES public.community_cards(id) ON DELETE CASCADE,
  slot_key text NOT NULL, label text NOT NULL, side text NOT NULL CHECK (side IN ('front','back')),
  x numeric(6,3) NOT NULL CHECK (x >= 0 AND x <= 100), y numeric(6,3) NOT NULL CHECK (y >= 0 AND y <= 100),
  width numeric(6,3) NOT NULL CHECK (width > 0 AND width <= 100), height numeric(6,3) NOT NULL CHECK (height > 0 AND height <= 100),
  price_cents integer NOT NULL DEFAULT 25000 CHECK (price_cents = 25000),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','sold','proof','approved')),
  advertiser_name text, ad_image_url text, buyer_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(community_card_id, slot_key)
);
CREATE TABLE IF NOT EXISTS public.community_card_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), community_card_id uuid NOT NULL REFERENCES public.community_cards(id) ON DELETE CASCADE,
  buyer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, slot_ids uuid[] NOT NULL,
  quantity integer NOT NULL CHECK (quantity IN (1,2)), amount_cents integer NOT NULL CHECK (amount_cents IN (25000,50000)),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending_payment','paid','cancelled','expired','proof_pending','approved')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), CHECK (cardinality(slot_ids) = quantity), CHECK (amount_cents = quantity * 25000)
);
CREATE INDEX IF NOT EXISTS community_card_slots_card_status_idx ON public.community_card_slots(community_card_id,status);
CREATE INDEX IF NOT EXISTS community_card_orders_buyer_idx ON public.community_card_orders(buyer_user_id, created_at DESC);
CREATE OR REPLACE FUNCTION public.community_cards_set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.reserve_community_card_spaces(p_card_id uuid, p_slot_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_order_id uuid; v_count integer := cardinality(p_slot_ids); v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sign in before reserving an ad space.'; END IF;
  IF v_count NOT IN (1,2) OR cardinality(ARRAY(SELECT DISTINCT unnest(p_slot_ids))) <> v_count THEN RAISE EXCEPTION 'Choose one or two unique ad spaces.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_cards WHERE id=p_card_id AND is_published AND sales_open) THEN RAISE EXCEPTION 'This mailing zone is not currently open for sales.'; END IF;
  PERFORM 1 FROM public.community_card_slots WHERE id = ANY(p_slot_ids) AND community_card_id=p_card_id FOR UPDATE;
  IF (SELECT count(*) FROM public.community_card_slots WHERE id=ANY(p_slot_ids) AND community_card_id=p_card_id AND status='available') <> v_count THEN RAISE EXCEPTION 'One or more selected spaces just filled. Please choose another space.'; END IF;
  INSERT INTO public.community_card_orders(community_card_id,buyer_user_id,slot_ids,quantity,amount_cents,status) VALUES(p_card_id,v_user_id,p_slot_ids,v_count,v_count*25000,'pending_payment') RETURNING id INTO v_order_id;
  UPDATE public.community_card_slots SET status='reserved', buyer_user_id=v_user_id WHERE id=ANY(p_slot_ids);
  RETURN v_order_id;
END; $$;
DROP TRIGGER IF EXISTS community_cards_set_updated_at ON public.community_cards; CREATE TRIGGER community_cards_set_updated_at BEFORE UPDATE ON public.community_cards FOR EACH ROW EXECUTE FUNCTION public.community_cards_set_updated_at();
DROP TRIGGER IF EXISTS community_card_slots_set_updated_at ON public.community_card_slots; CREATE TRIGGER community_card_slots_set_updated_at BEFORE UPDATE ON public.community_card_slots FOR EACH ROW EXECUTE FUNCTION public.community_cards_set_updated_at();
DROP TRIGGER IF EXISTS community_card_orders_set_updated_at ON public.community_card_orders; CREATE TRIGGER community_card_orders_set_updated_at BEFORE UPDATE ON public.community_card_orders FOR EACH ROW EXECUTE FUNCTION public.community_cards_set_updated_at();
ALTER TABLE public.community_cards ENABLE ROW LEVEL SECURITY; ALTER TABLE public.community_card_slots ENABLE ROW LEVEL SECURITY; ALTER TABLE public.community_card_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "card owner manages cards" ON public.community_cards FOR ALL TO authenticated USING (owner_id=auth.uid()) WITH CHECK(owner_id=auth.uid());
CREATE POLICY "published cards are visible" ON public.community_cards FOR SELECT TO anon, authenticated USING (is_published=true);
CREATE POLICY "card owner manages slots" ON public.community_card_slots FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.community_cards c WHERE c.id=community_card_id AND c.owner_id=auth.uid())) WITH CHECK(EXISTS(SELECT 1 FROM public.community_cards c WHERE c.id=community_card_id AND c.owner_id=auth.uid()));
CREATE POLICY "published card slots are visible" ON public.community_card_slots FOR SELECT TO anon, authenticated USING (EXISTS(SELECT 1 FROM public.community_cards c WHERE c.id=community_card_id AND c.is_published=true));
CREATE POLICY "buyers see their orders" ON public.community_card_orders FOR SELECT TO authenticated USING (buyer_user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.community_cards c WHERE c.id=community_card_id AND c.owner_id=auth.uid()));
CREATE POLICY "buyers start orders" ON public.community_card_orders FOR INSERT TO authenticated WITH CHECK (buyer_user_id=auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_cards, public.community_card_slots TO authenticated;
GRANT SELECT ON public.community_cards, public.community_card_slots TO anon;
GRANT SELECT, INSERT ON public.community_card_orders TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_community_card_spaces(uuid,uuid[]) TO authenticated;
