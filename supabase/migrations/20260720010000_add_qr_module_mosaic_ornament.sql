-- Allow QR Studio to persist the decorative four-sided QR module mosaic.

ALTER TABLE public.qr_links
  DROP CONSTRAINT IF EXISTS qr_links_ornament_style_check;

ALTER TABLE public.qr_links
  ADD CONSTRAINT qr_links_ornament_style_check
  CHECK (ornament_style IN ('none', 'wave-premium', 'module-mosaic'));