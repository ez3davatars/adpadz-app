import { describe, expect, it } from "vitest";
import {
  listActiveCreativeAssetOptions,
  resolveCreativeAssetUrl,
  resolveDestinationCreative,
  type CreativeWorkshopState,
} from "../../features/campaign-templates";

const workshop: CreativeWorkshopState = {
  version: 1,
  global: {
    version: 1,
    template: "hero-visual",
    imageFit: "cover",
    imagePositionX: 50,
    imagePositionY: 50,
    imageZoom: 1,
    showQr: true,
    showExpiration: false,
    theme: "dark",
    imageAssetId: "asset-global",
    rotation: 0,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    overlayEnabled: true,
    overlayStyle: "bottom-fade",
    overlayColor: "#000000",
    overlayOpacity: 55,
    overlayDirection: 180,
    overlaySpread: 55,
    qrId: "qr-global",
    headlineSize: "medium",
    textAlign: "left",
    textPanel: "none",
    primaryColorOverride: null,
    accentColorOverride: null,
    showLogo: true,
    showBusinessName: true,
    showHeadline: true,
    showOffer: true,
    showCta: true,
    showPhone: false,
    showWebsite: false,
    showSponsorBadge: true,
    safeAreaVisible: false,
    bleedVisible: false,
    qrMinimumVisible: false,
  },
  overrides: {
    discovery: {
      version: 1,
      template: "offer-first",
      imageFit: "contain",
      imagePositionX: 25,
      imagePositionY: 75,
      imageZoom: 1.25,
      showQr: false,
      showExpiration: true,
      theme: "light",
      imageAssetId: "asset-discovery",
      rotation: 1,
      brightness: 110,
      contrast: 95,
      saturation: 105,
      blur: 0,
      overlayEnabled: false,
      overlayStyle: "solid",
      overlayColor: "#112233",
      overlayOpacity: 20,
      overlayDirection: 90,
      overlaySpread: 30,
      qrId: null,
      headlineSize: "large",
      textAlign: "center",
      textPanel: "soft",
      primaryColorOverride: "#123456",
      accentColorOverride: "#abcdef",
      showLogo: true,
      showBusinessName: false,
      showHeadline: true,
      showOffer: true,
      showCta: true,
      showPhone: false,
      showWebsite: true,
      showSponsorBadge: true,
      safeAreaVisible: false,
      bleedVisible: false,
      qrMinimumVisible: false,
    },
  },
  formats: {
    mailer: "standard",
    discovery: "card",
    qr: "hero",
    social: "story",
  },
};

describe("destination creative resolver", () => {
  it("resolves destination override before global and keeps the saved format", () => {
    const result = resolveDestinationCreative(
      { creative_workshop: workshop, template_settings: { template: "brand-focus" } },
      "discovery",
      {
        assets: [{ id: "asset-discovery", file_url: "https://cdn.example/discovery.jpg" }],
        fallbackImageUrl: "https://cdn.example/fallback.jpg",
      },
    );

    expect(result.source).toBe("workshop-override");
    expect(result.settings.template).toBe("offer-first");
    expect(result.settings.textAlign).toBe("center");
    expect(result.format).toBe("card");
    expect(result.rendererDestination).toBe("discovery");
    expect(result.imageAssetId).toBe("asset-discovery");
    expect(result.imageUrl).toBe("https://cdn.example/discovery.jpg");
    expect(result.imageResolution).toBe("exact");
    expect(result.issues).toEqual([]);
  });

  it("maps the saved social format into the shared renderer destination", () => {
    const result = resolveDestinationCreative({ creative_workshop: workshop }, "social");
    expect(result.source).toBe("workshop-global");
    expect(result.format).toBe("story");
    expect(result.rendererDestination).toBe("social-story");
  });

  it("uses legacy template_settings only when canonical Workshop metadata is absent", () => {
    const result = resolveDestinationCreative({
      template_settings: { template: "brand-focus", theme: "light", showQr: false },
    }, "qr");

    expect(result.source).toBe("legacy");
    expect(result.settings.template).toBe("brand-focus");
    expect(result.settings.theme).toBe("light");
    expect(result.format).toBe("hero");
  });

  it("resolves exact owner-authorized image and QR references", () => {
    const result = resolveDestinationCreative({ creative_workshop: workshop }, "qr", {
      assets: [{ id: "asset-global", thumbnail_url: "https://cdn.example/global.webp" }],
      qrLinks: [{ id: "qr-global", publicUrl: "https://adpadz.co/q/summer" }],
      fallbackImageUrl: "https://cdn.example/fallback.jpg",
      fallbackDestinationUrl: "https://adpadz.co/ad/campaign",
    });

    expect(result.imageUrl).toBe("https://cdn.example/global.webp");
    expect(result.qrDestinationUrl).toBe("https://adpadz.co/q/summer");
    expect(result.qrId).toBe("qr-global");
    expect(result.qrResolution).toBe("exact");
    expect(result.renderSettings.showQr).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("never substitutes a basic QR when selected styled artwork is unavailable", () => {
    const result = resolveDestinationCreative({ creative_workshop: workshop }, "qr", {
      fallbackImageUrl: "https://cdn.example/fallback.jpg",
      fallbackDestinationUrl: "https://adpadz.co/ad/campaign",
    });

    expect(result.imageResolution).toBe("fallback");
    expect(result.qrDestinationUrl).toBeNull();
    expect(result.qrResolution).toBe("none");
    expect(result.renderSettings.showQr).toBe(false);
    expect(result.issues).toEqual([
      "The selected Workshop image is not available to this destination. The campaign fallback image is shown.",
      "The selected QR Studio artwork is not available to this destination, so no substitute QR is shown.",
    ]);
  });

  it("permits a standard absolute campaign QR only for legacy settings without qrId", () => {
    const absolute = resolveDestinationCreative({
      template_settings: { showQr: true },
    }, "discovery", {
      fallbackDestinationUrl: "https://adpadz.co/ad/campaign",
    });
    const relative = resolveDestinationCreative({
      template_settings: { showQr: true },
    }, "discovery", {
      fallbackDestinationUrl: "/ad/campaign",
    });

    expect(absolute.qrResolution).toBe("fallback");
    expect(absolute.qrDestinationUrl).toBe("https://adpadz.co/ad/campaign");
    expect(relative.qrDestinationUrl).toBeNull();
    expect(relative.renderSettings.showQr).toBe(false);
    expect(relative.issues).toContain("A public campaign destination is required before the QR code can be shown.");
  });
  it("keeps inactive historical assets renderable while excluding them from picker options", () => {
    const inactiveHistoricalAsset = {
      id: "asset-global",
      file_url: "https://cdn.example/full-history.jpg",
      thumbnail_url: "https://cdn.example/history-thumb.webp",
      external_url: null,
      is_active: false,
    };
    const activePickerAsset = {
      id: "asset-current",
      file_url: "https://cdn.example/current.jpg",
      thumbnail_url: "https://cdn.example/current-thumb.webp",
      external_url: null,
      is_active: true,
    };

    expect(resolveCreativeAssetUrl(inactiveHistoricalAsset, "thumbnail"))
      .toBe("https://cdn.example/history-thumb.webp");
    expect(resolveCreativeAssetUrl(inactiveHistoricalAsset, "full"))
      .toBe("https://cdn.example/full-history.jpg");
    expect(listActiveCreativeAssetOptions([inactiveHistoricalAsset, activePickerAsset]))
      .toEqual([activePickerAsset]);

    const historical = resolveDestinationCreative(
      { creative_workshop: workshop },
      "social",
      { assets: [inactiveHistoricalAsset] },
    );
    expect(historical.imageResolution).toBe("exact");
    expect(historical.imageUrl).toBe("https://cdn.example/full-history.jpg");
  });
});
