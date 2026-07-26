import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import {
  candidateEligibility,
  generateCommunityMailerCandidate,
  qrContrastRatio,
  resolveCandidateQrPrintBox,
  sha256Hex,
  type CandidateInput,
} from "../communityMailerCandidate";

const onePixelPng = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1,
  0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65,
  84, 8, 215, 99, 248, 207, 192, 240, 31, 0, 5, 0, 1, 255, 137, 153, 61, 29,
  0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);
const qrArtwork = {
  id: "77777777-7777-7777-7777-777777777777",
  title: "Exact campaign QR",
  slug: "exact-campaign",
  destination_url: "https://example.com/demo",
  status: "active" as const,
  expires_at: null,
  updated_at: "2026-07-18T11:00:00.000Z",
  style_preset: "circular-pad" as const,
  top_ring_text: "Fictional local business",
  bottom_ring_text: "Scan to connect",
  center_label: "Adpadz",
  foreground_color: "#000000",
  background_color: "#f1f1ef",
  accent_color: "#8edb39",
  show_center_label: true,
  show_short_url: true,
  logo_data_url: "",
  center_frame_shape: "rounded-rect" as const,
  center_frame_stroke_color: "#111111",
  center_frame_fill_color: "#ffffff",
  rim_decoration: "none" as const,
  rim_band_color: "#f1f1ef",
  rim_text_color: "#111111",
  inner_field_color: "#ffffff",
  outer_border_color: "#111111",
  outer_background_type: "none" as const,
  outer_background_color: "#f1f1ef",
  outer_background_image_data_url: "",
  outer_background_image_opacity: 0.65,
  outer_background_image_fit: "cover" as const,
  outer_background_overlay_color: "transparent",
  rim_band_background_type: "solid" as const,
  rim_band_image_data_url: "",
  rim_band_image_opacity: 1,
  rim_band_image_fit: "cover" as const,
  rim_band_overlay_color: "#ffffff",
  rim_band_overlay_opacity: 0.15,
  ornament_style: "module-mosaic" as const,
  ornament_main_color: "#111111",
  ornament_accent_color: "#8edb39",
  ornament_shadow_color: "#d8d8d2",
  ornament_opacity: 1,
};
const dependencies = {
  renderPlacement: async () => onePixelPng,
  renderPreview: async () => onePixelPng,
};
const input: CandidateInput = {
  mailerId: "11111111-1111-1111-1111-111111111111",
  title: "Fictional River City Mailer",
  zoneName: "Demo Zone",
  format: "postcard_9x12",
  layoutRevision: 8,
  preflightRunId: "22222222-2222-2222-2222-222222222222",
  preflightFingerprint: "cm-8-1234abcd",
  generatedAt: "2026-07-18T12:00:00.000Z",
  confirmations: { postal: true, printerSpecs: true, colorProfile: true },
  preflightReport: { passed: true, warnings: [] },
  placements: [{
    id: "33333333-3333-3333-3333-333333333333",
    slotKey: "front-top-1",
    side: "front",
    x: 0.75,
    y: 0.75,
    width: 24.175,
    height: 44.3425,
    campaignId: "44444444-4444-4444-4444-444444444444",
    businessId: "55555555-5555-5555-5555-555555555555",
    businessName: "Fictional River City Outdoor Living",
    headline: "A deterministic production candidate",
    creativeAssetId: "66666666-6666-6666-6666-666666666666",
    creativeUrl: "https://demo.invalid/creative.png",
    qrLinkId: "77777777-7777-7777-7777-777777777777",
    qrDestination: "https://example.com/demo",
    associatedQrLinkId: "77777777-7777-7777-7777-777777777777",
    associatedQrDestination: "https://example.com/demo",
    qrShortUrl: "https://adpadz.co/q/exact-campaign",
    qrForegroundColor: "#000000",
    qrBackgroundColor: "#ffffff",
    snapshotFingerprint: "snapshot-1",
    creativeSettings: {
      template: "featured-sponsor",
      imageFit: "cover",
      imageAssetId: "66666666-6666-6666-6666-666666666666",
      showQr: true,
      qrId: "77777777-7777-7777-7777-777777777777",
    },
    creativeFormatKey: "featured",
    creativeVersionId: "88888888-8888-8888-8888-888888888888",
    creativeSettingsFingerprint:
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    creativeSnapshotContractVersion: 2,
    creativeRenderContractVersion: 1,
    qrArtwork,
  }],
};

describe("Community Mailer Production Candidate", () => {
  it("blocks missing campaign, asset, QR, and snapshot associations", () => {
    const result = candidateEligibility({
      ...input,
      placements: [{
        ...input.placements[0],
        campaignId: "",
        creativeAssetId: "",
        qrLinkId: "",
        snapshotFingerprint: "",
      }],
    });
    expect(result.eligible).toBe(false);
    expect(result.blockers.join(" ")).toContain("Campaign");
    expect(result.blockers.join(" ")).toContain("creative");
    expect(result.blockers.join(" ")).toContain("QR");
  });

  it("detects text overflow and unavailable QR contrast", () => {
    expect(candidateEligibility({
      ...input,
      placements: [{ ...input.placements[0], headline: "x".repeat(121) }],
    }).eligible).toBe(false);
    expect(qrContrastRatio(null, "#ffffff")).toBeNull();
    expect(qrContrastRatio("invalid", "#ffffff")).toBeNull();
    expect(qrContrastRatio("#000000", "#ffffff")).toBeGreaterThan(20);
    const lowContrast = candidateEligibility({
      ...input,
      placements: [{
        ...input.placements[0],
        qrArtwork: {
          ...qrArtwork,
          foreground_color: "#777777",
        },
      }],
    });
    expect(lowContrast.eligible).toBe(false);
    expect(lowContrast.blockers).toContain(
      "front-top-1 QR contrast is below 4.5:1.",
    );
  });

  it("generates real PDFs and the complete deterministic file contract", async () => {
    const candidate = await generateCommunityMailerCandidate(input, dependencies);
    expect(candidate.files.map((file) => file.name)).toEqual([
      "front.pdf",
      "back.pdf",
      "front.png",
      "back.png",
      "production-manifest.json",
      "placement-manifest.csv",
      "advertiser-manifest.csv",
      "qr-manifest.json",
      "preflight-report.json",
      "confirmation-record.json",
    ]);
    const front = candidate.files.find((file) => file.name === "front.pdf")!;
    const document = await PDFDocument.load(front.bytes);
    expect(document.getPageCount()).toBe(1);
    expect(document.getPage(0).getSize()).toEqual({
      width: 12.25 * 72,
      height: 9.25 * 72,
    });
    expect(front.bytes.byteLength).toBeGreaterThan(1000);
    expect(await sha256Hex(front.bytes)).toBe(front.checksum);
    expect(candidate.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(candidate.storagePrefix).toContain("/revisions/8/");
    expect(candidate.manifest).toMatchObject({
      templateContractVersion: 2,
      placements: [{
        placementId: "33333333-3333-3333-3333-333333333333",
        creativeSettings: {
          template: "featured-sponsor",
          imageFit: "cover",
      imageAssetId: "66666666-6666-6666-6666-666666666666",
      showQr: true,
      qrId: "77777777-7777-7777-7777-777777777777",
        },
        creativeFormatKey: "featured",
        creativeVersionId: "88888888-8888-8888-8888-888888888888",
        creativeSettingsFingerprint:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        templateSettings: {
          template: "featured-sponsor",
          imageFit: "cover",
      imageAssetId: "66666666-6666-6666-6666-666666666666",
      showQr: true,
      qrId: "77777777-7777-7777-7777-777777777777",
        },
      }],
    });
  });


  it("detects raster bytes instead of trusting the asset URL extension", async () => {
    const candidate = await generateCommunityMailerCandidate({
      ...input,
      placements: [{
        ...input.placements[0],
        creativeUrl: "https://demo.invalid/creative.svg",
      }],
    }, dependencies);
    const front = candidate.files.find((file) => file.name === "front.pdf")!;
    await expect(PDFDocument.load(front.bytes)).resolves.toBeDefined();
  });
  it("uses canonical 6x11 bleed dimensions", async () => {
    const candidate = await generateCommunityMailerCandidate({
      ...input,
      format: "community_card_6x11",
    }, dependencies);
    const front = candidate.files.find((file) => file.name === "front.pdf")!;
    const document = await PDFDocument.load(front.bytes);
    expect(document.getPage(0).getSize()).toEqual({
      width: 11.25 * 72,
      height: 6.25 * 72,
    });
  });
  it("keeps the exact QR association and enforces the physical module-field minimum", () => {
    const printBox = resolveCandidateQrPrintBox(input, input.placements[0]);
    expect(printBox?.adjusted).toBe(true);
    expect(printBox?.moduleFieldInches).toBeGreaterThanOrEqual(0.75);
    const mismatch = candidateEligibility({
      ...input,
      placements: [{
        ...input.placements[0],
        associatedQrLinkId: "99999999-9999-4999-8999-999999999999",
      }],
    });
    expect(mismatch.eligible).toBe(false);
    expect(mismatch.blockers.join(" ")).toContain("association differs");
  });

  it("fails closed when the canonical renderer does not return a PNG", async () => {
    await expect(generateCommunityMailerCandidate(input, {
      ...dependencies,
      renderPlacement: async () => Uint8Array.from([1, 2, 3]),
    })).rejects.toThrow("did not produce a PNG");
  });
  it("produces stable checksums for stable bytes", async () => {
    expect(await sha256Hex(Uint8Array.from([1, 2, 3]))).toBe(
      await sha256Hex(Uint8Array.from([1, 2, 3])),
    );
  });
});
