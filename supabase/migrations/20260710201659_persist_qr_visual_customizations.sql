-- Persist every visual control exposed by QR Studio so saved designs reload exactly.

ALTER TABLE public.qr_links
  ADD COLUMN IF NOT EXISTS logo_data_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS center_frame_shape text NOT NULL DEFAULT 'rounded-rect'
    CHECK (center_frame_shape IN ('rounded-rect', 'circle')),
  ADD COLUMN IF NOT EXISTS center_frame_stroke_color text NOT NULL DEFAULT '#111111',
  ADD COLUMN IF NOT EXISTS center_frame_fill_color text NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS rim_decoration text NOT NULL DEFAULT 'none'
    CHECK (rim_decoration IN ('none')),
  ADD COLUMN IF NOT EXISTS rim_band_color text,
  ADD COLUMN IF NOT EXISTS rim_text_color text NOT NULL DEFAULT '#111111',
  ADD COLUMN IF NOT EXISTS inner_field_color text NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS outer_border_color text NOT NULL DEFAULT '#111111',
  ADD COLUMN IF NOT EXISTS outer_background_type text NOT NULL DEFAULT 'none'
    CHECK (outer_background_type IN ('none', 'solid', 'gradient', 'image', 'pattern')),
  ADD COLUMN IF NOT EXISTS outer_background_color text NOT NULL DEFAULT '#f1f1ef',
  ADD COLUMN IF NOT EXISTS outer_background_image_data_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS outer_background_image_opacity double precision NOT NULL DEFAULT 0.65
    CHECK (outer_background_image_opacity BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS outer_background_image_fit text NOT NULL DEFAULT 'cover'
    CHECK (outer_background_image_fit IN ('cover', 'contain')),
  ADD COLUMN IF NOT EXISTS outer_background_overlay_color text NOT NULL DEFAULT 'transparent',
  ADD COLUMN IF NOT EXISTS rim_band_background_type text NOT NULL DEFAULT 'solid'
    CHECK (rim_band_background_type IN ('solid', 'image', 'gradient', 'pattern')),
  ADD COLUMN IF NOT EXISTS rim_band_image_data_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS rim_band_image_opacity double precision NOT NULL DEFAULT 1
    CHECK (rim_band_image_opacity BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS rim_band_image_fit text NOT NULL DEFAULT 'cover'
    CHECK (rim_band_image_fit IN ('cover', 'contain')),
  ADD COLUMN IF NOT EXISTS rim_band_overlay_color text NOT NULL DEFAULT '#ffffff',
  ADD COLUMN IF NOT EXISTS rim_band_overlay_opacity double precision NOT NULL DEFAULT 0.15
    CHECK (rim_band_overlay_opacity BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS ornament_style text NOT NULL DEFAULT 'wave-premium'
    CHECK (ornament_style IN ('none', 'wave-premium')),
  ADD COLUMN IF NOT EXISTS ornament_main_color text NOT NULL DEFAULT '#111111',
  ADD COLUMN IF NOT EXISTS ornament_accent_color text NOT NULL DEFAULT '#8EDB39',
  ADD COLUMN IF NOT EXISTS ornament_shadow_color text NOT NULL DEFAULT '#D8D8D2',
  ADD COLUMN IF NOT EXISTS ornament_opacity double precision NOT NULL DEFAULT 1
    CHECK (ornament_opacity BETWEEN 0 AND 1);

-- Before these columns existed, QR Studio derived an edited link's rim from
-- background_color. Preserve that appearance for rows present at migration time.
UPDATE public.qr_links
SET rim_band_color = background_color
WHERE rim_band_color IS NULL;

ALTER TABLE public.qr_links
  ALTER COLUMN rim_band_color SET DEFAULT '#f1f1ef',
  ALTER COLUMN rim_band_color SET NOT NULL;
