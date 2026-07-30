import type { CampaignTemplateKey, NormalizedBox } from "../features/campaign-templates/types";
import { resolveCreativeTemplateLayout } from "../features/campaign-templates/templateRegistry";
import type { CommunityCardFormat } from "./communityCards";
import {
  COMMUNITY_MAILER_ROW_GRID,
  canonicalCommunityMailerCreativePlacement,
  geometryForMailer,
} from "./communityMailerProductionContracts";
import type { QRStylePreset } from "./qr/qrTypes";

export type CommunityMailerQrSafeBounds = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type CommunityMailerQrGeometrySettings = {
  template: CampaignTemplateKey;
  showQr: boolean;
  qrEmphasis?: "standard" | "prominent";
};

export type CommunityMailerQrGeometryArtwork = {
  style_preset: QRStylePreset;
};

export type CommunityMailerQrPrintBox = {
  box: NormalizedBox;
  moduleFieldInches: number;
  adjusted: boolean;
};

export type CommunityMailerQrGeometryInput = {
  pageFormat: CommunityCardFormat;
  placementWidthPercent: number;
  placementHeightPercent: number;
  settings: CommunityMailerQrGeometrySettings;
  artwork: CommunityMailerQrGeometryArtwork | null;
  safeBounds: CommunityMailerQrSafeBounds;
};

/**
 * Resolves the physical QR wrapper used by both Creative Director previews and
 * Community Mailer production candidates. The returned box includes the
 * prominent-card padding/caption while moduleFieldInches measures only the
 * square QR artwork field inside that wrapper.
 */
export function resolveCommunityMailerQrPrintBox({
  pageFormat,
  placementWidthPercent,
  placementHeightPercent,
  settings,
  artwork,
  safeBounds,
}: CommunityMailerQrGeometryInput): CommunityMailerQrPrintBox | null {
  if (!settings.showQr || !artwork) return null;
  if (
    !isPositiveFinite(placementWidthPercent)
    || !isPositiveFinite(placementHeightPercent)
    || !isSafeBounds(safeBounds)
  ) return null;

  const geometry = geometryForMailer(pageFormat);
  const layout = resolveCreativeTemplateLayout(
    settings.template,
    settings.qrEmphasis,
  ).qr;
  const moduleFieldRatio = artwork.style_preset === "standard" ? 0.72 : 0.54;
  const placementWidthInches =
    geometry.finishedWidthInches * placementWidthPercent / 100;
  const placementHeightInches =
    geometry.finishedHeightInches * placementHeightPercent / 100;
  if (!isPositiveFinite(placementWidthInches) || !isPositiveFinite(placementHeightInches)) {
    return null;
  }

  const wrapperInsets = qrWrapperInsets(
    settings.qrEmphasis,
    placementWidthInches,
  );
  const minimumArtworkInches = geometry.qrMinimumInches / moduleFieldRatio;
  const width = Math.max(
    layout.width,
    (minimumArtworkInches + wrapperInsets.horizontal) / placementWidthInches,
  );
  const height = Math.max(
    layout.height,
    (minimumArtworkInches + wrapperInsets.vertical) / placementHeightInches,
  );
  const safeWidth = 1 - safeBounds.left - safeBounds.right;
  const safeHeight = 1 - safeBounds.top - safeBounds.bottom;
  if (
    !isPositiveFinite(width)
    || !isPositiveFinite(height)
    || width > safeWidth + 1e-6
    || height > safeHeight + 1e-6
  ) return null;

  const centerX = layout.x + layout.width / 2;
  const centerY = layout.y + layout.height / 2;
  const x = Math.min(
    1 - safeBounds.right - width,
    Math.max(safeBounds.left, centerX - width / 2),
  );
  const y = Math.min(
    1 - safeBounds.bottom - height,
    Math.max(safeBounds.top, centerY - height / 2),
  );
  const artworkWidthInches = Math.max(
    0,
    width * placementWidthInches - wrapperInsets.horizontal,
  );
  const artworkHeightInches = Math.max(
    0,
    height * placementHeightInches - wrapperInsets.vertical,
  );
  const moduleFieldInches = Math.min(
    artworkWidthInches,
    artworkHeightInches,
  ) * moduleFieldRatio;
  if (moduleFieldInches + 1e-6 < geometry.qrMinimumInches) return null;

  return {
    box: { x, y, width, height },
    moduleFieldInches,
    adjusted: width > layout.width + 1e-6 || height > layout.height + 1e-6,
  };
}

export type CommunityMailerPreviewFormat = "standard" | "combined" | "featured";

export type CommunityMailerPreviewQrGeometryInput = {
  formatKey?: string | null;
  settings: CommunityMailerQrGeometrySettings;
  artwork: CommunityMailerQrGeometryArtwork | null;
  safeBounds: CommunityMailerQrSafeBounds;
};

/**
 * Uses the locked 9x12 row-grid geometry represented by the three Creative
 * Director Mailer formats. Unknown destination formats fail closed.
 */
export function resolveCommunityMailerPreviewQrPrintBox({
  formatKey,
  settings,
  artwork,
  safeBounds,
}: CommunityMailerPreviewQrGeometryInput): CommunityMailerQrPrintBox | null {
  const placement = canonicalCommunityMailerCreativePlacement(formatKey);
  if (!placement) return null;

  return resolveCommunityMailerQrPrintBox({
    pageFormat: COMMUNITY_MAILER_ROW_GRID.mailerFormat,
    placementWidthPercent: placement.widthPercent,
    placementHeightPercent: placement.heightPercent,
    settings,
    artwork,
    safeBounds,
  });
}

function qrWrapperInsets(
  qrEmphasis: "standard" | "prominent" | undefined,
  placementWidthInches: number,
) {
  if (qrEmphasis !== "prominent") {
    return { horizontal: 0, vertical: 0 };
  }

  // Mirrors CampaignTemplateRenderer exactly:
  // p-[.8cqw], gap-[.4cqw], and a 1.15cqw caption with a 6pt minimum.
  const paddingInches = placementWidthInches * 0.008;
  const captionGapInches = placementWidthInches * 0.004;
  const captionFontInches = Math.max(
    placementWidthInches * 0.0115,
    6 / 72,
  );
  const captionLineInches = captionFontInches * 1.5;
  return {
    horizontal: paddingInches * 2,
    vertical: paddingInches * 2 + captionGapInches + captionLineInches,
  };
}

function isPositiveFinite(value: number) {
  return Number.isFinite(value) && value > 0;
}

function isSafeBounds(bounds: CommunityMailerQrSafeBounds) {
  const values = [bounds.top, bounds.right, bounds.bottom, bounds.left];
  return values.every(value => Number.isFinite(value) && value >= 0 && value < 1)
    && bounds.left + bounds.right < 1
    && bounds.top + bounds.bottom < 1;
}
