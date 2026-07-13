-- The demo fixture inserts analytics and QR scan records as an authenticated
-- user. Those inserts invoke these SECURITY DEFINER normalization triggers,
-- whose SHA-256 fingerprints are provided by pgcrypto in Supabase's extensions
-- schema.
ALTER FUNCTION public.adpadz_guard_campaign_event_insert()
  SET search_path = pg_catalog, public, extensions;

ALTER FUNCTION public.adpadz_guard_business_card_event_insert()
  SET search_path = pg_catalog, public, extensions;

ALTER FUNCTION public.adpadz_guard_qr_scan_event_insert()
  SET search_path = pg_catalog, public, extensions;
