-- Separate in-app Adpadz operator access from customer business accounts.
CREATE TABLE IF NOT EXISTS public.adpadz_staff_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','operator')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.adpadz_staff_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_adpadz_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.adpadz_staff_roles
    WHERE user_id = auth.uid() AND role IN ('admin','operator')
  );
$$;

REVOKE ALL ON public.adpadz_staff_roles FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_adpadz_admin() TO authenticated;

-- Admin roles are intentionally assigned only through the Supabase SQL Editor
-- or service role, never from a browser session. To grant the first role:
-- INSERT INTO public.adpadz_staff_roles(user_id, role)
-- SELECT id, 'admin' FROM auth.users WHERE email = 'YOUR-ADMIN-EMAIL';

DROP POLICY IF EXISTS "card owner manages cards" ON public.community_cards;
CREATE POLICY "card admin manages cards" ON public.community_cards
  FOR ALL TO authenticated
  USING (public.is_adpadz_admin())
  WITH CHECK (public.is_adpadz_admin());

DROP POLICY IF EXISTS "card owner manages slots" ON public.community_card_slots;
CREATE POLICY "card admin manages slots" ON public.community_card_slots
  FOR ALL TO authenticated
  USING (public.is_adpadz_admin())
  WITH CHECK (public.is_adpadz_admin());

DROP POLICY IF EXISTS "buyers see their orders" ON public.community_card_orders;
CREATE POLICY "buyers see their orders" ON public.community_card_orders
  FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid() OR public.is_adpadz_admin());
