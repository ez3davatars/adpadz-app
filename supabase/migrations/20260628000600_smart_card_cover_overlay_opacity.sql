ALTER TABLE public.business_cards
  ADD COLUMN IF NOT EXISTS cover_overlay_opacity numeric NOT NULL DEFAULT 90;

UPDATE public.business_cards
SET cover_overlay_opacity = COALESCE(cover_overlay_opacity, 90);
