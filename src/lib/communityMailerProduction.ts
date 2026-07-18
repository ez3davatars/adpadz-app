import type { LayoutPlacement } from "./communityMailerLayout";
import { geometryForMailer } from "./communityMailerProductionContracts";

export const COMMUNITY_MAILER_LIFECYCLE = [
  "draft",
  "selling",
  "building",
  "review",
  "ready_for_print",
  "printed",
  "mailed",
  "published",
  "archived",
] as const;

export type CommunityMailerLifecycle =
  (typeof COMMUNITY_MAILER_LIFECYCLE)[number];
export type PreflightSeverity = "blocking" | "warning";
export type PreflightVerification = "automated" | "manual" | "printer";
export type PreflightCheck = {
  code: string;
  label: string;
  severity: PreflightSeverity;
  verification: PreflightVerification;
  passed: boolean;
  placementId?: string;
  detail: string;
};
export type MailerPreflightInput = {
  mailerId: string;
  format: "postcard_9x12" | "community_card_6x11";
  mailingDate: string | null;
  layoutRevision: number;
  layoutLocked: boolean;
  placements: LayoutPlacement[];
  manual: {
    postalAreaConfirmed: boolean;
    printerSpecsConfirmed: boolean;
    colorProfileConfirmed: boolean;
  };
};
export type MailerPreflightResult = {
  checks: PreflightCheck[];
  blockingCount: number;
  warningCount: number;
  passed: boolean;
  completionPercent: number;
  fingerprint: string;
};

const occupied = (placement: LayoutPlacement) =>
  !["available", "unavailable"].includes(placement.status);
const hasArtwork = (placement: LayoutPlacement) =>
  Boolean(placement.creative_asset_url || placement.ad_image_url);
const checksum = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export function runCommunityMailerPreflight(
  input: MailerPreflightInput,
): MailerPreflightResult {
  const checks: PreflightCheck[] = [];
  const add = (check: PreflightCheck) => checks.push(check);
  add({
    code: "mailing_date",
    label: "Mailing date",
    severity: "blocking",
    verification: "automated",
    passed: Boolean(input.mailingDate),
    detail: input.mailingDate
      ? `Scheduled for ${input.mailingDate}.`
      : "A mailing date is required.",
  });
  add({
    code: "layout_lock",
    label: "Production lock",
    severity: "blocking",
    verification: "automated",
    passed: input.layoutLocked,
    detail: input.layoutLocked
      ? `Layout revision ${input.layoutRevision} is locked.`
      : "Lock the layout before final preflight.",
  });
  for (const placement of input.placements.filter(occupied)) {
    add({
      code: "placement_campaign",
      label: `${placement.label}: business assigned`,
      severity: "blocking",
      verification: "automated",
      passed: Boolean(placement.campaign_id),
      placementId: placement.id,
      detail: placement.business_id
        ? "The purchasing business is assigned."
        : "Assign the purchased placement to its business.",
    });
    add({
      code: "placement_artwork",
      label: `${placement.label}: artwork`,
      severity: "blocking",
      verification: "automated",
      passed: hasArtwork(placement),
      placementId: placement.id,
      detail: hasArtwork(placement)
        ? "Artwork asset is attached."
        : "Attach approved artwork from the Asset Library.",
    });
    add({
      code: "placement_payment",
      label: `${placement.label}: payment`,
      severity: "blocking",
      verification: "automated",
      passed: ["paid", "waived"].includes(placement.payment_status ?? ""),
      placementId: placement.id,
      detail: "Payment must be paid or explicitly waived.",
    });
    add({
      code: "placement_proof",
      label: `${placement.label}: proof approval`,
      severity: "blocking",
      verification: "automated",
      passed: placement.proof_status === "approved",
      placementId: placement.id,
      detail: "The customer proof must be approved.",
    });
    add({
      code: "placement_qr",
      label: `${placement.label}: QR destination`,
      severity: "warning",
      verification: "automated",
      passed: Boolean(placement.qr_destination_url),
      placementId: placement.id,
      detail: placement.qr_destination_url
        ? "A canonical QR destination is connected."
        : "No QR destination is connected; confirm this is intentional.",
    });
  }
  [
    ["postal_area", "Postal area", input.manual.postalAreaConfirmed,
      "manual" as const, "Confirm the protected postal area is unobstructed."],
    ["printer_specs", "Printer specifications",
      input.manual.printerSpecsConfirmed, "printer" as const,
      "The selected printer must confirm trim, bleed, marks, and delivery profile."],
    ["color_profile", "Color profile", input.manual.colorProfileConfirmed,
      "printer" as const,
      "Color space and ICC conversion require printer confirmation."],
  ].forEach(([code, label, passed, verification, detail]) =>
    add({
      code: String(code),
      label: String(label),
      severity: "blocking",
      verification: verification as PreflightVerification,
      passed: Boolean(passed),
      detail: String(detail),
    })
  );
  const blockingCount = checks.filter((check) =>
    !check.passed && check.severity === "blocking"
  ).length;
  const warningCount = checks.filter((check) =>
    !check.passed && check.severity === "warning"
  ).length;
  const passedCount = checks.filter((check) => check.passed).length;
  const canonical = JSON.stringify({
    mailerId: input.mailerId,
    format: input.format,
    mailingDate: input.mailingDate,
    layoutRevision: input.layoutRevision,
    advertiserManifest: input.placements.filter(occupied).map((placement) => ({ id: placement.id, businessId: placement.business_id ?? null, advertiserName: placement.business_name ?? placement.advertiser_name ?? null })),
    qrManifest: input.placements.filter(occupied).map((placement) => ({ placementId: placement.id, slotKey: placement.slot_key, qrLinkId: placement.qr_link_id ?? null, destinationUrl: placement.qr_destination_url ?? null })),
    placements: input.placements.map((placement) => ({
      id: placement.id,
      side: placement.side,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      businessId: placement.business_id ?? null,
      campaignId: placement.campaign_id ?? null,
      asset: placement.creative_asset_id ?? placement.ad_image_url ?? null,
      qr: placement.qr_link_id ?? null,
      proof: placement.proof_status ?? null,
    })).sort((left, right) => left.id.localeCompare(right.id)),
  });
  return {
    checks,
    blockingCount,
    warningCount,
    passed: blockingCount === 0,
    completionPercent: checks.length === 0
      ? 100
      : Math.round(passedCount / checks.length * 100),
    fingerprint: `cm-${input.layoutRevision}-${checksum(canonical)}`,
  };
}

export function buildCommunityMailerExportManifest(
  input: MailerPreflightInput,
  result: MailerPreflightResult,
  generatedAt = new Date().toISOString(),
) {
  return {
    schema: "adpadz.community-mailer.print-package.v1",
    generatedAt,
    mailerId: input.mailerId,
    format: input.format,
    layoutRevision: input.layoutRevision,
    preflightFingerprint: result.fingerprint,
    preflightPassed: result.passed,
    geometry: geometryForMailer(input.format),

    caveats: [
      "Browser artwork metadata cannot prove effective DPI, embedded fonts, or color space.",
      "CMYK/ICC conversion and final postal/printer acceptance require external verification.",
    ],
    advertiserManifest: input.placements.filter(occupied).map((placement) => ({ id: placement.id, businessId: placement.business_id ?? null, advertiserName: placement.business_name ?? placement.advertiser_name ?? null })),
    qrManifest: input.placements.filter(occupied).map((placement) => ({ placementId: placement.id, slotKey: placement.slot_key, qrLinkId: placement.qr_link_id ?? null, destinationUrl: placement.qr_destination_url ?? null })),
    placements: input.placements.map((placement) => ({
      id: placement.id,
      side: placement.side,
      geometryPercent: {
        x: placement.x,
        y: placement.y,
        width: placement.width,
        height: placement.height,
      },
      assetId: placement.creative_asset_id ?? null,
      qrLinkId: placement.qr_link_id ?? null,
    })),
  };
}
