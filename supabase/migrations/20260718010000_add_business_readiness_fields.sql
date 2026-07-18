-- Permanent discovery information belongs to Business Hub and is reused by
-- Campaign Readiness, Consumer Discovery, mailers, and future destinations.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS service_area text;

COMMENT ON COLUMN public.businesses.category IS
  'Business Hub category reused by campaign discovery and distribution readiness.';
COMMENT ON COLUMN public.businesses.service_area IS
  'Business Hub city, neighborhood, or service area reused by campaign destinations.';
