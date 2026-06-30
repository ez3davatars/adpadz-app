-- Obsolete legacy bridge:
-- This project never had the legacy table. Smart Card placement now lives in campaign_outputs.
-- Keep a lightweight interactive_ads table for interactive-ad rendering compatibility only.
CREATE TABLE IF NOT EXISTS public.interactive_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  published boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interactive_ads_owner_user_id_idx
  ON public.interactive_ads(owner_user_id);

DROP TRIGGER IF EXISTS interactive_ads_set_updated_at ON public.interactive_ads;
CREATE TRIGGER interactive_ads_set_updated_at
  BEFORE UPDATE ON public.interactive_ads
  FOR EACH ROW EXECUTE FUNCTION public.business_cards_set_updated_at();

ALTER TABLE public.interactive_ads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interactive_ads_owner_select" ON public.interactive_ads;
CREATE POLICY "interactive_ads_owner_select" ON public.interactive_ads
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "interactive_ads_owner_insert" ON public.interactive_ads;
CREATE POLICY "interactive_ads_owner_insert" ON public.interactive_ads
  FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "interactive_ads_owner_update" ON public.interactive_ads;
CREATE POLICY "interactive_ads_owner_update" ON public.interactive_ads
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

DROP POLICY IF EXISTS "interactive_ads_owner_delete" ON public.interactive_ads;
CREATE POLICY "interactive_ads_owner_delete" ON public.interactive_ads
  FOR DELETE TO authenticated
  USING (owner_user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.interactive_ads TO authenticated;

-- Optional compatibility for older interaction tracking tables.
DO $$
BEGIN
  IF to_regclass('public.interactions') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'interactions'
         AND column_name = 'ad_id'
     ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "interactions_insert_anon" ON public.interactions';
    EXECUTE $policy$
      CREATE POLICY "interactions_insert_anon" ON public.interactions
        FOR INSERT TO anon, authenticated
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.interactive_ads
            WHERE interactive_ads.id = interactions.ad_id
              AND interactive_ads.published = true
          )
        )
    $policy$;
  END IF;
END $$;