import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSHOP_STATE,
  resolveDestinationCreative,
} from "../../features/campaign-templates";
import { indexPublicCampaignQrArtwork } from "../campaigns";
import {
  MAX_QR_EMBEDDED_ARTWORK_BYTES,
  normalizeQRStudioVisualArtwork,
  type QRStudioVisualArtwork,
} from "../qr/qrArtwork";

const artwork = {
  id: "qr-public",
  title: "Public campaign QR",
  slug: "public-campaign",
  style_preset: "circular-pad",
  top_ring_text: "Shop local",
  bottom_ring_text: "Scan to discover",
  center_label: "Adpadz",
  foreground_color: "#111111",
  background_color: "#ffffff",
  accent_color: "#8edb39",
  show_center_label: true,
  show_short_url: true,
  logo_data_url: "",
  center_frame_shape: "rounded-rect",
  center_frame_stroke_color: "#111111",
  center_frame_fill_color: "#ffffff",
  rim_decoration: "none",
  rim_band_color: "#f1f1ef",
  rim_text_color: "#111111",
  inner_field_color: "#ffffff",
  outer_border_color: "#111111",
  outer_background_type: "none",
  outer_background_color: "#f1f1ef",
  outer_background_image_data_url: "",
  outer_background_image_opacity: 0.65,
  outer_background_image_fit: "cover",
  outer_background_overlay_color: "transparent",
  rim_band_background_type: "solid",
  rim_band_image_data_url: "",
  rim_band_image_opacity: 1,
  rim_band_image_fit: "cover",
  rim_band_overlay_color: "#ffffff",
  rim_band_overlay_opacity: 0.15,
  ornament_style: "module-mosaic",
  ornament_main_color: "#111111",
  ornament_accent_color: "#8edb39",
  ornament_shadow_color: "#d8d8d2",
  ornament_opacity: 1,
} satisfies QRStudioVisualArtwork;

describe("public Campaign QR artwork hydration", () => {
  it("indexes only strictly normalized artwork matching an expected public Campaign reference", () => {
    const expected = new Map([
      ["campaign-public", { discovery: artwork.id }],
    ]);
    const indexed = indexPublicCampaignQrArtwork([
      {
        campaign_id: "campaign-public",
        destination: "discovery",
        qr_artwork: {
          ...artwork,
          destination_url: "https://private.example/target",
          scan_count: 9001,
          owner_user_id: "owner-private",
          tags: ["private"],
        },
      },
      {
        campaign_id: "campaign-unpublished",
        destination: "discovery",
        qr_artwork: artwork,
      },
      {
        campaign_id: "campaign-public",
        destination: "qr",
        qr_artwork: artwork,
      },
      {
        campaign_id: "campaign-public",
        destination: "discovery",
        qr_artwork: { ...artwork, id: "qr-unreferenced" },
      },
      {
        campaign_id: "campaign-public",
        destination: "social",
        qr_artwork: artwork,
      },
    ], expected);

    expect(indexed.size).toBe(1);
    expect(indexed.has("campaign-unpublished")).toBe(false);
    expect(indexed.get("campaign-public")?.qr).toBeUndefined();
    expect(indexed.get("campaign-public")?.discovery).toEqual({
      ...artwork,
      title: "Campaign QR code",
    });
    expect(indexed.get("campaign-public")?.discovery)
      .not.toHaveProperty("destination_url");
    expect(indexed.get("campaign-public")?.discovery)
      .not.toHaveProperty("scan_count");
    expect(indexed.get("campaign-public")?.discovery)
      .not.toHaveProperty("owner_user_id");
    expect(indexed.get("campaign-public")?.discovery)
      .not.toHaveProperty("tags");
  });

  it("degrades to empty QR artwork when the optional projection is unavailable", () => {
    const expected = new Map([
      ["campaign-public", { qr: artwork.id }],
    ]);
    expect(indexPublicCampaignQrArtwork([], expected)).toEqual(new Map());
  });

  it("fails closed when aggregate embedded QR artwork exceeds 1 MiB", () => {
    const individuallyBoundedDataUrl = `data:image/png;base64,${"A".repeat(
      Math.floor(MAX_QR_EMBEDDED_ARTWORK_BYTES / 3),
    )}`;
    const oversizedArtwork = {
      ...artwork,
      logo_data_url: individuallyBoundedDataUrl,
      outer_background_image_data_url: individuallyBoundedDataUrl,
      rim_band_image_data_url: individuallyBoundedDataUrl,
    };

    expect(normalizeQRStudioVisualArtwork(oversizedArtwork)).toBeNull();
    expect(indexPublicCampaignQrArtwork([
      {
        campaign_id: "campaign-public",
        destination: "discovery",
        qr_artwork: oversizedArtwork,
      },
    ], new Map([
      ["campaign-public", { discovery: artwork.id }],
    ]))).toEqual(new Map());
  });

  it("makes the exact selected artwork resolvable without a basic QR fallback", () => {
    const state = {
      ...DEFAULT_WORKSHOP_STATE,
      global: {
        ...DEFAULT_WORKSHOP_STATE.global,
        qrId: artwork.id,
        showQr: true,
      },
    };
    const creative = resolveDestinationCreative(
      { creative_workshop: state },
      "discovery",
      {
        qrLinks: [{
          id: artwork.id,
          publicUrl: `https://adpadz.co/q/${artwork.slug}`,
        }],
      },
    );

    expect(creative.qrResolution).toBe("exact");
    expect(creative.qrDestinationUrl)
      .toBe("https://adpadz.co/q/public-campaign");
    expect(creative.renderSettings.showQr).toBe(true);
    expect(creative.issues).toEqual([]);
  });
});
