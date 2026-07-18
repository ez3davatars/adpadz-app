import { describe, expect, it } from "vitest";
import {
  buildCommunityMailerExportManifest,
  runCommunityMailerPreflight,
} from "../communityMailerProduction";
import type { LayoutPlacement } from "../communityMailerLayout";

const placement = {
  id: "slot-1",
  community_card_id: "mailer-1",
  slot_key: "front-1",
  label: "Front 1",
  side: "front",
  x: 1,
  y: 1,
  width: 20,
  height: 40,
  price_cents: 25000,
  status: "sold",
  advertiser_name: "River City",
  ad_image_url: "https://example.com/ad.png",
  placement_type: "standard",
  placement_tier: "standard",
  z_index: 1,
  is_featured: false,
  is_locked: true,
  discount_cents: 0,
  category_exclusive: false,
  business_id: "business-1",
  campaign_id: "campaign-1",
  creative_asset_id: "asset-1",
  creative_asset_url: "https://example.com/ad.png",
  qr_link_id: "qr-1",
  qr_destination_url: "https://example.com",
  payment_status: "paid",
  proof_status: "approved",
} satisfies LayoutPlacement;
const input = {
  mailerId: "mailer-1",
  format: "postcard_9x12" as const,
  mailingDate: "2026-08-20",
  layoutRevision: 4,
  layoutLocked: true,
  placements: [placement],
  manual: {
    postalAreaConfirmed: true,
    printerSpecsConfirmed: true,
    colorProfileConfirmed: true,
  },
};

describe("Community Mailer production engine", () => {
  it("passes a fully confirmed locked production snapshot", () => {
    const result = runCommunityMailerPreflight(input);
    expect(result.passed).toBe(true);
    expect(result.completionPercent).toBe(100);
    expect(result.fingerprint).toMatch(/^cm-4-/);
  });

  it("separates automated, manual, and printer-confirmed checks", () => {
    const result = runCommunityMailerPreflight({
      ...input,
      layoutLocked: false,
      manual: { ...input.manual, printerSpecsConfirmed: false },
    });
    expect(result.passed).toBe(false);
    expect(result.checks.find((check) => check.code === "layout_lock")
      ?.verification).toBe("automated");
    expect(result.checks.find((check) => check.code === "printer_specs")
      ?.verification).toBe("printer");
  });

  it("creates a deterministic geometry and asset manifest", () => {
    const result = runCommunityMailerPreflight(input);
    const manifest = buildCommunityMailerExportManifest(input, result);
    expect(manifest.schema).toBe(
      "adpadz.community-mailer.print-package.v1",
    );
    expect(manifest.placements[0]).toMatchObject({
      assetId: "asset-1",
      qrLinkId: "qr-1",
    });
    expect(manifest.caveats.join(" ")).toContain("CMYK");
  });
});
