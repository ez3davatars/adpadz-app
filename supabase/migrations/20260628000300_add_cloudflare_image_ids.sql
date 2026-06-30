-- Cloudflare Images metadata for Smart Cards.
-- Supabase stores delivered URLs and Cloudflare image IDs only, not image binaries.

ALTER TABLE public.business_cards
  ADD COLUMN IF NOT EXISTS logo_image_id text,
  ADD COLUMN IF NOT EXISTS cover_image_id text;

ALTER TABLE public.business_card_gallery_items
  ADD COLUMN IF NOT EXISTS cloudflare_image_id text;
