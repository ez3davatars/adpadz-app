import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { geometryForMailer } from "./communityMailerProductionContracts";
import type { CommunityCardFormat } from "./communityCards";

export const COMMUNITY_MAILER_CANDIDATE_GENERATOR_VERSION = "1.0.0";

export type CandidatePlacement = {
  id: string;
  slotKey: string;
  side: "front" | "back";
  x: number;
  y: number;
  width: number;
  height: number;
  campaignId: string;
  businessId: string;
  businessName: string;
  headline: string;
  offer?: string | null;
  cta?: string | null;
  phone?: string | null;
  website?: string | null;
  creativeAssetId: string;
  creativeUrl: string;
  qrLinkId: string;
  qrDestination: string;
  qrForegroundColor?: string | null;
  qrBackgroundColor?: string | null;
  snapshotFingerprint: string;
};

export type CandidateInput = {
  mailerId: string;
  title: string;
  zoneName: string;
  format: CommunityCardFormat;
  layoutRevision: number;
  preflightRunId: string;
  preflightFingerprint: string;
  generatedAt: string;
  confirmations: Record<string, boolean | number | string | null>;
  preflightReport: unknown;
  placements: CandidatePlacement[];
};

export type CandidateFile = {
  name: string;
  contentType: string;
  bytes: Uint8Array;
  checksum: string;
};

export type CandidatePackage = {
  files: CandidateFile[];
  checksum: string;
  storagePrefix: string;
  manifest: Record<string, unknown>;
};

export type CandidateDependencies = {
  fetchAsset: (url: string) => Promise<Uint8Array>;
  renderPreview: (
    input: CandidateInput,
    side: "front" | "back",
  ) => Promise<Uint8Array>;
};

const encoder = new TextEncoder();
const occupiedForSide = (input: CandidateInput, side: "front" | "back") =>
  input.placements.filter((placement) => placement.side === side);

export async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function candidateEligibility(input: CandidateInput) {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!input.preflightFingerprint) blockers.push("Current preflight is missing.");
  if (!input.placements.length) blockers.push("No occupied placements exist.");
  for (const placement of input.placements) {
    if (!placement.campaignId) {
      blockers.push(`${placement.slotKey} has no Campaign assignment.`);
    }
    if (!placement.creativeUrl || !placement.creativeAssetId) {
      blockers.push(`${placement.slotKey} has no immutable creative reference.`);
    }
    if (!placement.qrLinkId || !placement.qrDestination) {
      blockers.push(`${placement.slotKey} has no complete QR association.`);
    }
    if (!placement.qrForegroundColor || !placement.qrBackgroundColor) {
      warnings.push(`${placement.slotKey} QR contrast metadata is unavailable.`);
    } else if ((qrContrastRatio(placement.qrForegroundColor, placement.qrBackgroundColor) || 0) < 4.5) {
      blockers.push(`${placement.slotKey} QR contrast is below 4.5:1.`);
    }
    if (!placement.snapshotFingerprint) {
      blockers.push(`${placement.slotKey} has no production snapshot.`);
    }
    if (placement.headline.length > 120) {
      blockers.push(`${placement.slotKey} headline exceeds the production limit.`);
    }
  }
  return { eligible: blockers.length === 0, blockers, warnings };
}

function hexColor(value: string | null | undefined, fallback: string) {
  const normalized = value?.match(/^#([0-9a-f]{6})$/i)?.[1] ??
    fallback.slice(1);
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) / 255,
    g: Number.parseInt(normalized.slice(2, 4), 16) / 255,
    b: Number.parseInt(normalized.slice(4, 6), 16) / 255,
  };
}

export function qrContrastRatio(
  foreground: string | null | undefined,
  background: string | null | undefined,
) {
  if (!foreground || !background) return null;
  const luminance = (color: string) => {
    const { r, g, b } = hexColor(color, "#000000");
    const channel = (value: number) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    return 0.2126 * channel(r) + 0.7152 * channel(g) +
      0.0722 * channel(b);
  };
  const first = luminance(foreground), second = luminance(background);
  return (Math.max(first, second) + 0.05) /
    (Math.min(first, second) + 0.05);
}

async function composePdf(
  input: CandidateInput,
  side: "front" | "back",
  fetchAsset: CandidateDependencies["fetchAsset"],
) {
  const document = await PDFDocument.create();
  document.setTitle(`${input.title} ${side} Production Candidate`);
  document.setProducer(
    `Adpadz Community Mailer ${COMMUNITY_MAILER_CANDIDATE_GENERATOR_VERSION}`,
  );
  document.setCreationDate(new Date(input.generatedAt));
  const geometry = geometryForMailer(input.format);
  const pageWidth = geometry.bleedWidthInches * 72;
  const pageHeight = geometry.bleedHeightInches * 72;
  const page = document.addPage([pageWidth, pageHeight]);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageWidth,
    height: pageHeight,
    color: rgb(1, 1, 1),
  });
  for (const placement of occupiedForSide(input, side)) {
    const x = placement.x / 100 * pageWidth;
    const y = pageHeight - (placement.y + placement.height) / 100 * pageHeight;
    const width = placement.width / 100 * pageWidth;
    const height = placement.height / 100 * pageHeight;
    page.drawRectangle({
      x,
      y,
      width,
      height,
      borderWidth: 0.5,
      borderColor: rgb(0.15, 0.18, 0.22),
      color: rgb(0.98, 0.98, 0.97),
    });
    const assetBytes = await fetchAsset(placement.creativeUrl);
    const image = assetBytes[0] === 137 && assetBytes[1] === 80 &&
        assetBytes[2] === 78 && assetBytes[3] === 71
      ? await document.embedPng(assetBytes)
      : await document.embedJpg(assetBytes);
    const imageRatio = image.width / image.height;
    const boxRatio = width / height;
    const imageWidth = imageRatio > boxRatio ? width : height * imageRatio;
    const imageHeight = imageRatio > boxRatio ? width / imageRatio : height;
    page.drawImage(image, {
      x: x + (width - imageWidth) / 2,
      y: y + (height - imageHeight) / 2,
      width: imageWidth,
      height: imageHeight,
    });
    page.drawRectangle({
      x,
      y,
      width,
      height: Math.min(38, height * 0.28),
      color: rgb(1, 1, 1),
      opacity: 0.92,
    });
    page.drawText(placement.businessName.slice(0, 55), {
      x: x + 5,
      y: y + Math.min(27, height * 0.19),
      size: Math.min(10, width / 24),
      font: bold,
      maxWidth: width - 50,
    });
    page.drawText(placement.headline.slice(0, 120), {
      x: x + 5,
      y: y + 7,
      size: Math.min(7, width / 32),
      font,
      maxWidth: width - 50,
    });
    const qr = QRCode.create(placement.qrDestination, {
      errorCorrectionLevel: "H",
    });
    const qrSize = Math.min(Math.max(54, Math.min(width, height) * 0.22), width - 8, height - 8);
    const moduleSize = qrSize / qr.modules.size;
    const qrX = x + width - qrSize - 4;
    const qrY = y + 3;
    const foreground = hexColor(placement.qrForegroundColor, "#000000");
    page.drawRectangle({
      x: qrX - 2,
      y: qrY - 2,
      width: qrSize + 4,
      height: qrSize + 4,
      color: rgb(1, 1, 1),
    });
    for (let row = 0; row < qr.modules.size; row += 1) {
      for (let column = 0; column < qr.modules.size; column += 1) {
        if (qr.modules.get(row, column)) {
          page.drawRectangle({
            x: qrX + column * moduleSize,
            y: qrY + (qr.modules.size - row - 1) * moduleSize,
            width: moduleSize + 0.01,
            height: moduleSize + 0.01,
            color: rgb(foreground.r, foreground.g, foreground.b),
          });
        }
      }
    }
  }
  page.drawText(
    `PRODUCTION CANDIDATE · NOT PRINTER CERTIFIED · revision ${input.layoutRevision}`,
    { x: 8, y: 3, size: 5, font, color: rgb(0.35, 0.35, 0.35) },
  );
  return document.save({ useObjectStreams: false });
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function generateCommunityMailerCandidate(
  input: CandidateInput,
  dependencies: CandidateDependencies,
): Promise<CandidatePackage> {
  const eligibility = candidateEligibility(input);
  if (!eligibility.eligible) throw new Error(eligibility.blockers.join(" "));
  const manifest = {
    schema: "adpadz.community-mailer.production-candidate.v1",
    generatorVersion: COMMUNITY_MAILER_CANDIDATE_GENERATOR_VERSION,
    generatedAt: input.generatedAt,
    mailerId: input.mailerId,
    zoneName: input.zoneName,
    format: input.format,
    layoutRevision: input.layoutRevision,
    preflightRunId: input.preflightRunId,
    preflightFingerprint: input.preflightFingerprint,
    geometry: geometryForMailer(input.format),
    classification: "Production Candidate",
    printerCertified: false,
    caveats: [
      "Not printer certified.",
      "Printer must confirm embedded fonts, color conversion, postal compliance, and final imposition.",
    ],
  };
  const placementManifest = input.placements.map((placement) => ({
    placementId: placement.id,
    slotKey: placement.slotKey,
    side: placement.side,
    campaignId: placement.campaignId,
    businessId: placement.businessId,
    creativeAssetId: placement.creativeAssetId,
    snapshotFingerprint: placement.snapshotFingerprint,
  }));
  const qrManifest = input.placements.map((placement) => ({
    placementId: placement.id,
    slotKey: placement.slotKey,
    campaignId: placement.campaignId,
    businessId: placement.businessId,
    mailerId: input.mailerId,
    mailerRevision: input.layoutRevision,
    zoneName: input.zoneName,
    qrLinkId: placement.qrLinkId,
    destination: placement.qrDestination,
    minimumRecommendedInches: geometryForMailer(input.format).qrMinimumInches,
    contrastRatio: qrContrastRatio(
      placement.qrForegroundColor,
      placement.qrBackgroundColor,
    ),
  }));
  const advertiserCsv = [
    ["placement_id", "slot_key", "business_id", "business_name", "campaign_id"],
    ...input.placements.map((placement) => [
      placement.id,
      placement.slotKey,
      placement.businessId,
      placement.businessName,
      placement.campaignId,
    ]),
  ].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const rawFiles = [
    ["front.pdf", "application/pdf",
      await composePdf(input, "front", dependencies.fetchAsset)],
    ["back.pdf", "application/pdf",
      await composePdf(input, "back", dependencies.fetchAsset)],
    ["front.png", "image/png",
      await dependencies.renderPreview(input, "front")],
    ["back.png", "image/png",
      await dependencies.renderPreview(input, "back")],
    ["production-manifest.json", "application/json",
      encoder.encode(JSON.stringify(manifest, null, 2))],
    ["placement-manifest.json", "application/json",
      encoder.encode(JSON.stringify(placementManifest, null, 2))],
    ["advertiser-manifest.csv", "text/csv", encoder.encode(advertiserCsv)],
    ["qr-manifest.json", "application/json",
      encoder.encode(JSON.stringify(qrManifest, null, 2))],
    ["preflight-report.json", "application/json",
      encoder.encode(JSON.stringify(input.preflightReport, null, 2))],
    ["confirmation-record.json", "application/json",
      encoder.encode(JSON.stringify(input.confirmations, null, 2))],
  ] as const;
  const files = await Promise.all(rawFiles.map(async ([name, contentType, bytes]) => ({
    name,
    contentType,
    bytes,
    checksum: await sha256Hex(bytes),
  })));
  const checksum = await sha256Hex(encoder.encode(
    files.map((file) => `${file.name}:${file.checksum}`).sort().join("\n"),
  ));
  return {
    files,
    checksum,
    storagePrefix:
      `community-mailers/${input.mailerId}/revisions/${input.layoutRevision}/production-candidate/`,
    manifest,
  };
}
