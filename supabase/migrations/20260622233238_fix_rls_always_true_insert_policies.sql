
-- Fix analytics_events: only allow inserts referencing an active business
DROP POLICY IF EXISTS "analytics_insert_anon" ON analytics_events;
CREATE POLICY "analytics_insert_anon" ON analytics_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = analytics_events.business_id
        AND businesses.active = true
    )
  );

-- Legacy interactions policy: the original target table was never present in this project.
-- If an interactions table exists in an older environment, point it at interactive_ads safely.
DO $$
BEGIN
  IF to_regclass('public.interactions') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'interactions'
         AND column_name = 'ad_id'
     )
     AND to_regclass('public.interactive_ads') IS NOT NULL THEN
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

-- Fix leads: only allow inserts referencing an active business
DROP POLICY IF EXISTS "leads_insert_anon" ON leads;
CREATE POLICY "leads_insert_anon" ON leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id = leads.business_id
        AND businesses.active = true
    )
  );

-- Fix redemptions: only allow inserts referencing an active offer whose business matches
DROP POLICY IF EXISTS "redemptions_insert_anon" ON redemptions;
CREATE POLICY "redemptions_insert_anon" ON redemptions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM offers
      WHERE offers.id = redemptions.offer_id
        AND offers.active = true
        AND offers.business_id = redemptions.business_id
    )
  );
