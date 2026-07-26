import type {
  QRCenterFrameShape,
  QROrnamentStyle,
  QROuterBackgroundFit,
  QROuterBackgroundType,
  QRRimBandBackgroundType,
  QRRimBandImageFit,
  QRRimDecoration,
  QRStatus,
  QRStylePreset,
} from "./qrTypes";

export type QRStudioVisualArtwork = {
  id: string;
  title: string;
  slug: string;
  style_preset: QRStylePreset;
  top_ring_text: string | null;
  bottom_ring_text: string | null;
  center_label: string | null;
  foreground_color: string;
  background_color: string;
  accent_color: string;
  show_center_label: boolean;
  show_short_url: boolean;
  logo_data_url: string;
  center_frame_shape: QRCenterFrameShape;
  center_frame_stroke_color: string;
  center_frame_fill_color: string;
  rim_decoration: QRRimDecoration;
  rim_band_color: string;
  rim_text_color: string;
  inner_field_color: string;
  outer_border_color: string;
  outer_background_type: QROuterBackgroundType;
  outer_background_color: string;
  outer_background_image_data_url: string;
  outer_background_image_opacity: number;
  outer_background_image_fit: QROuterBackgroundFit;
  outer_background_overlay_color: string;
  rim_band_background_type: QRRimBandBackgroundType;
  rim_band_image_data_url: string;
  rim_band_image_opacity: number;
  rim_band_image_fit: QRRimBandImageFit;
  rim_band_overlay_color: string;
  rim_band_overlay_opacity: number;
  ornament_style: QROrnamentStyle;
  ornament_main_color: string;
  ornament_accent_color: string;
  ornament_shadow_color: string;
  ornament_opacity: number;
};

export type QRStudioProductionArtwork = QRStudioVisualArtwork & {
  destination_url: string;
  status: QRStatus;
  expires_at: string | null;
  updated_at: string;
};

export const MAX_QR_EMBEDDED_ARTWORK_BYTES = 1_048_576;
export const MIN_PRODUCTION_QR_CONTRAST_RATIO = 4.5;

export function qrContrastRatio(
  foreground: string | null | undefined,
  background: string | null | undefined,
): number | null {
  const foregroundLuminance = colorLuminance(foreground);
  const backgroundLuminance = colorLuminance(background);
  if (foregroundLuminance === null || backgroundLuminance === null) return null;
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getQrEmbeddedArtworkBytes(value: {
  logo_data_url?: unknown;
  outer_background_image_data_url?: unknown;
  rim_band_image_data_url?: unknown;
}): number {
  const encoder = new TextEncoder();
  let total = 0;
  for (const item of [
    value.logo_data_url,
    value.outer_background_image_data_url,
    value.rim_band_image_data_url,
  ]) {
    if (typeof item === "string") total += encoder.encode(item).byteLength;
  }
  return total;
}

const stylePresets = ["standard", "circular-pad", "digital-pad"] as const;
const statuses = ["active", "paused", "archived"] as const;
const frameShapes = ["rounded-rect", "circle"] as const;
const outerBackgroundTypes = ["none", "solid", "gradient", "image", "pattern"] as const;
const outerBackgroundFits = ["cover", "contain"] as const;
const rimBackgroundTypes = ["solid", "image", "gradient", "pattern"] as const;
const rimImageFits = ["cover", "contain"] as const;
const ornamentStyles = ["none", "wave-premium", "module-mosaic"] as const;

export function normalizeQRStudioVisualArtwork(value: unknown): QRStudioVisualArtwork | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const id = requiredString(input.id);
  const title = requiredString(input.title);
  const slug = requiredString(input.slug);
  const stylePreset = choice(input.style_preset, stylePresets);
  const centerFrameShape = choice(input.center_frame_shape, frameShapes);
  const outerBackgroundType = choice(input.outer_background_type, outerBackgroundTypes);
  const outerBackgroundFit = choice(input.outer_background_image_fit, outerBackgroundFits);
  const rimBackgroundType = choice(input.rim_band_background_type, rimBackgroundTypes);
  const rimImageFit = choice(input.rim_band_image_fit, rimImageFits);
  const ornamentStyle = choice(input.ornament_style, ornamentStyles);
  const colors = [
    input.foreground_color,
    input.background_color,
    input.accent_color,
    input.center_frame_stroke_color,
    input.center_frame_fill_color,
    input.rim_band_color,
    input.rim_text_color,
    input.inner_field_color,
    input.outer_border_color,
    input.outer_background_color,
    input.ornament_main_color,
    input.ornament_accent_color,
    input.ornament_shadow_color,
  ].map(color);
  const booleans = [
    input.show_center_label,
    input.show_short_url,
  ].map(booleanValue);
  const unitValues = [
    input.outer_background_image_opacity,
    input.rim_band_image_opacity,
    input.rim_band_overlay_opacity,
    input.ornament_opacity,
  ].map(unitNumber);
  const imageDataValues = [
    input.logo_data_url,
    input.outer_background_image_data_url,
    input.rim_band_image_data_url,
  ].map(optionalImageDataUrl);
  const overlayColors = [
    input.outer_background_overlay_color,
    input.rim_band_overlay_color,
  ].map(overlayColor);

  if (
    !id || !title || !slug || !stylePreset
    || !centerFrameShape || !outerBackgroundType
    || !outerBackgroundFit || !rimBackgroundType || !rimImageFit
    || !ornamentStyle || colors.some(item => item === null)
    || booleans.some(item => item === null)
    || unitValues.some(item => item === null)
    || imageDataValues.some(item => item === null)
    || getQrEmbeddedArtworkBytes(input) > MAX_QR_EMBEDDED_ARTWORK_BYTES
    || overlayColors.some(item => item === null)
    || input.rim_decoration !== "none"
  ) return null;

  return {
    id,
    title,
    slug,
    style_preset: stylePreset,
    top_ring_text: nullableString(input.top_ring_text),
    bottom_ring_text: nullableString(input.bottom_ring_text),
    center_label: nullableString(input.center_label),
    foreground_color: colors[0]!,
    background_color: colors[1]!,
    accent_color: colors[2]!,
    show_center_label: booleans[0]!,
    show_short_url: booleans[1]!,
    logo_data_url: imageDataValues[0]!,
    center_frame_shape: centerFrameShape,
    center_frame_stroke_color: colors[3]!,
    center_frame_fill_color: colors[4]!,
    rim_decoration: "none",
    rim_band_color: colors[5]!,
    rim_text_color: colors[6]!,
    inner_field_color: colors[7]!,
    outer_border_color: colors[8]!,
    outer_background_type: outerBackgroundType,
    outer_background_color: colors[9]!,
    outer_background_image_data_url: imageDataValues[1]!,
    outer_background_image_opacity: unitValues[0]!,
    outer_background_image_fit: outerBackgroundFit,
    outer_background_overlay_color: overlayColors[0]!,
    rim_band_background_type: rimBackgroundType,
    rim_band_image_data_url: imageDataValues[2]!,
    rim_band_image_opacity: unitValues[1]!,
    rim_band_image_fit: rimImageFit,
    rim_band_overlay_color: overlayColors[1]!,
    rim_band_overlay_opacity: unitValues[2]!,
    ornament_style: ornamentStyle,
    ornament_main_color: colors[10]!,
    ornament_accent_color: colors[11]!,
    ornament_shadow_color: colors[12]!,
    ornament_opacity: unitValues[3]!,
  };
}

export function normalizeQRStudioProductionArtwork(
  value: unknown,
): QRStudioProductionArtwork | null {
  const visual = normalizeQRStudioVisualArtwork(value);
  if (!visual || !value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const destinationUrl = httpUrl(input.destination_url);
  const status = choice(input.status, statuses);
  const updatedAt = requiredString(input.updated_at);
  if (!destinationUrl || !status || !updatedAt) return null;
  return {
    ...visual,
    destination_url: destinationUrl,
    status,
    expires_at: nullableString(input.expires_at),
    updated_at: updatedAt,
  };
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function choice<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && allowed.includes(value as T) ? value as T : null;
}

function color(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

function colorLuminance(value: string | null | undefined): number | null {
  const match = /^#([0-9a-f]{6})$/i.exec(value ?? "");
  if (!match) return null;
  const channels = [0, 2, 4]
    .map(index => Number.parseInt(match[1].slice(index, index + 2), 16) / 255)
    .map(channel => channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function overlayColor(value: unknown): string | null {
  return value === "transparent" ? value : color(value);
}

function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function unitNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

function optionalImageDataUrl(value: unknown): string | null {
  return typeof value === "string" && (!value || /^data:image\//i.test(value)) ? value : null;
}

function httpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}
