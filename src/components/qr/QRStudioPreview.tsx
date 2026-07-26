import type { QRStudioVisualArtwork } from "../../lib/qr/qrArtwork";
import { buildShortUrl, getPublicAppUrl } from "../../lib/qr/qrUtils";
import CircularPadQR from "./CircularPadQR";

type QRStudioPreviewProps = {
  qr: QRStudioVisualArtwork;
  origin?: string;
  className?: string;
  size?: number;
};

/**
 * Renders a saved QR Studio record without dropping any of its visual fields.
 * Creative destinations should use this adapter instead of rebuilding a basic QR.
 */
export default function QRStudioPreview({
  qr,
  origin,
  className = "block h-auto w-full",
  size = 420,
}: QRStudioPreviewProps) {
  const shortUrl = buildShortUrl(qr.slug, origin ?? getPublicAppUrl());
  const shortLabel = shortUrl.replace(/^https?:\/\//, "");

  return (
    <CircularPadQR
      value={shortUrl}
      title={qr.title}
      topText={qr.top_ring_text ?? ""}
      bottomText={qr.bottom_ring_text ?? ""}
      centerLabel={qr.center_label || "adpadz"}
      shortLabel={shortLabel}
      preset={qr.style_preset}
      foregroundColor={qr.foreground_color}
      backgroundColor={qr.background_color}
      accentColor={qr.accent_color}
      showCenterLabel={qr.show_center_label}
      showShortLabel={qr.show_short_url}
      logoDataUrl={qr.logo_data_url}
      centerFrameShape={qr.center_frame_shape}
      centerFrameStrokeColor={qr.center_frame_stroke_color}
      centerFrameFillColor={qr.center_frame_fill_color}
      rimDecoration={qr.rim_decoration}
      rimBandColor={qr.rim_band_color}
      rimTextColor={qr.rim_text_color}
      innerFieldColor={qr.inner_field_color}
      outerBorderColor={qr.outer_border_color}
      outerBackgroundType={qr.outer_background_type}
      outerBackgroundColor={qr.outer_background_color}
      outerBackgroundImageDataUrl={qr.outer_background_image_data_url}
      outerBackgroundImageOpacity={qr.outer_background_image_opacity}
      outerBackgroundImageFit={qr.outer_background_image_fit}
      outerBackgroundOverlayColor={qr.outer_background_overlay_color}
      rimBandBackgroundType={qr.rim_band_background_type}
      rimBandImageDataUrl={qr.rim_band_image_data_url}
      rimBandImageOpacity={qr.rim_band_image_opacity}
      rimBandImageFit={qr.rim_band_image_fit}
      rimBandOverlayColor={qr.rim_band_overlay_color}
      rimBandOverlayOpacity={qr.rim_band_overlay_opacity}
      ornamentStyle={qr.ornament_style}
      ornamentMainColor={qr.ornament_main_color}
      ornamentAccentColor={qr.ornament_accent_color}
      ornamentShadowColor={qr.ornament_shadow_color}
      ornamentOpacity={qr.ornament_opacity}
      size={size}
      className={className}
    />
  );
}
