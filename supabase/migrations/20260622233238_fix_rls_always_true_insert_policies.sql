
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

-- Fix interactions: only allow inserts referencing a published ad
DROP POLICY IF EXISTS "interactions_insert_anon" ON interactions;
CREATE POLICY "interactions_insert_anon" ON interactions
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ads
      WHERE ads.id = interactions.ad_id
        AND ads.published = true
    )
  );

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
