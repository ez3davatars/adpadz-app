ALTER TABLE public.business_cards
  ADD COLUMN IF NOT EXISTS logo_fit text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS logo_position_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS logo_position_y numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS logo_zoom numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cover_fit text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS cover_position_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_position_y numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_zoom numeric NOT NULL DEFAULT 1;

ALTER TABLE public.business_card_gallery_items
  ADD COLUMN IF NOT EXISTS fit text NOT NULL DEFAULT 'cover',
  ADD COLUMN IF NOT EXISTS position_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS position_y numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS zoom numeric NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_cards_logo_fit_check'
  ) THEN
    ALTER TABLE public.business_cards
      ADD CONSTRAINT business_cards_logo_fit_check
      CHECK (logo_fit IN ('cover', 'contain', 'custom'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_cards_cover_fit_check'
  ) THEN
    ALTER TABLE public.business_cards
      ADD CONSTRAINT business_cards_cover_fit_check
      CHECK (cover_fit IN ('cover', 'contain', 'custom'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'business_card_gallery_items_fit_check'
  ) THEN
    ALTER TABLE public.business_card_gallery_items
      ADD CONSTRAINT business_card_gallery_items_fit_check
      CHECK (fit IN ('cover', 'contain', 'custom'));
  END IF;
END $$;

UPDATE public.business_cards
SET
  logo_fit = COALESCE(NULLIF(logo_fit, ''), 'cover'),
  cover_fit = COALESCE(NULLIF(cover_fit, ''), 'cover'),
  logo_position_x = COALESCE(logo_position_x, 50),
  logo_position_y = COALESCE(logo_position_y, 50),
  logo_zoom = COALESCE(logo_zoom, 1),
  cover_position_x = COALESCE(cover_position_x, 50),
  cover_position_y = COALESCE(cover_position_y, 50),
  cover_zoom = COALESCE(cover_zoom, 1);

UPDATE public.business_card_gallery_items
SET
  fit = COALESCE(NULLIF(fit, ''), 'cover'),
  position_x = COALESCE(position_x, 50),
  position_y = COALESCE(position_y, 50),
  zoom = COALESCE(zoom, 1);
