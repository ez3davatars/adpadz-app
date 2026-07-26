import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CreativeCompareView from "../../components/campaign-creative/CreativeCompareView";
import CreativeHistoryDrawer from "../../components/campaign-creative/CreativeHistoryDrawer";
import CreativePreviewCanvas from "../../components/campaign-creative/CreativePreviewCanvas";
import { CampaignTemplateRenderer } from "../../features/campaign-templates";
import {
  DEFAULT_CREATIVE_SETTINGS,
  DEFAULT_WORKSHOP_STATE,
  normalizeCreativeSettings,
} from "../../features/campaign-templates/creativeWorkshop";
import type { CampaignTemplateContent } from "../../features/campaign-templates/types";
import type { CampaignCreativeVersionRecord } from "../campaignCreativeHistory";

const content: CampaignTemplateContent = {
  campaignId: "campaign-1",
  businessName: "River City Coffee",
  businessPhone: "(904) 555-0101",
  businessWebsite: "https://rivercity.example/",
  businessLogoUrl: "https://cdn.example/logo.png",
  imageUrl: "https://cdn.example/offer.jpg",
  headline: "Summer coffee flight",
  description: "Taste three local roasts.",
  offer: "20% off",
  offerDetails: "Weekdays through August.",
  ctaLabel: "Claim offer",
  destinationUrl: "https://adpadz.co/c/campaign-1",
  expiration: "2026-08-31T23:59:59.000Z",
  primaryColor: "#102010",
  accentColor: "#b0ff00",
  campaign: {
    id: "campaign-1",
    owner_id: "owner-1",
    title: "Summer coffee flight",
    status: "active",
  },
};

const version: CampaignCreativeVersionRecord = {
  id: "version-1",
  campaign_id: "campaign-1",
  destination: "social",
  scope: "destination",
  format_key: "story",
  template_family: "offer-first",
  settings_snapshot: {
    ...DEFAULT_WORKSHOP_STATE,
    overrides: {
      social: normalizeCreativeSettings({
        ...DEFAULT_CREATIVE_SETTINGS,
        template: "offer-first",
        imageZoom: 1.25,
      }),
    },
  },
  settings_fingerprint: "fingerprint-1",
  change_summary: ["Image zoom", "Template"],
  affects_print: false,
  created_override: true,
  created_by: "owner-1",
  created_at: "2026-07-24T18:30:00.000Z",
};

describe("Creative History component", () => {
  it("renders saved-state metadata and every explicit version action", () => {
    const html = renderToStaticMarkup(createElement(CreativeHistoryDrawer, {
      open: true,
      entries: [version],
      loading: false,
      loadingMore: false,
      error: "",
      hasMore: true,
      currentDestinationLabel: "Mailer",
      onClose: vi.fn(),
      onLoadMore: vi.fn(),
      onRetry: vi.fn(),
      onPreview: vi.fn(),
      onCompare: vi.fn(),
      onRestore: vi.fn(),
      onDuplicate: vi.fn(),
      renderThumbnail: () => createElement("span", { "data-testid": "version-thumbnail" }, "Thumbnail"),
    }));

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-labelledby="creative-history-title"');
    expect(html).toContain('aria-label="Creative versions"');
    expect(html).toContain('dateTime="2026-07-24T18:30:00.000Z"');
    expect(html).toContain("Social");
    expect(html).toContain("Story");
    expect(html).toContain("Offer First");
    expect(html).toContain("Destination override");
    expect(html).toContain("Digital only");
    expect(html).toContain("Override");
    expect(html).toContain("Image zoom");
    expect(html).toContain("Template");
    expect(html).toContain('data-testid="version-thumbnail"');
    expect(html).toContain("aspect-ratio:0.5625");
    expect(html).toContain("height:100%");
    expect(html).toContain(">Preview<");
    expect(html).toContain(">Compare<");
    expect(html).toContain(">Restore<");
    expect(html).toContain(">Copy to Mailer<");
    expect(html).toContain(">Load more history<");
  });

  it("renders no drawer while closed and exposes retry and empty states", () => {
    const baseProps = {
      entries: [] as CampaignCreativeVersionRecord[],
      loading: false,
      loadingMore: false,
      hasMore: false,
      currentDestinationLabel: "Social",
      onClose: vi.fn(),
      onLoadMore: vi.fn(),
      onRetry: vi.fn(),
      onPreview: vi.fn(),
      onCompare: vi.fn(),
      onRestore: vi.fn(),
      onDuplicate: vi.fn(),
    };
    expect(renderToStaticMarkup(createElement(CreativeHistoryDrawer, {
      ...baseProps,
      open: false,
      error: "",
    }))).toBe("");

    const error = renderToStaticMarkup(createElement(CreativeHistoryDrawer, {
      ...baseProps,
      open: true,
      error: "History could not be loaded.",
    }));
    expect(error).toContain('role="alert"');
    expect(error).toContain("History could not be loaded.");
    expect(error).toContain("Retry history");

    const empty = renderToStaticMarkup(createElement(CreativeHistoryDrawer, {
      ...baseProps,
      open: true,
      error: "",
    }));
    expect(empty).toContain("Your next save starts history");
    expect(empty).toContain("materially different creative settings");
  });
});

describe("Creative Compare component", () => {
  const left = createElement("div", { "data-version": "saved" }, "Saved creative");
  const right = createElement("div", { "data-version": "current" }, "Current creative");

  it("labels both sides and renders the accessible side-by-side default", () => {
    const html = renderToStaticMarkup(createElement(CreativeCompareView, {
      leftLabel: "Saved Jul 24",
      rightLabel: "Current unsaved",
      left,
      right,
    }));

    expect(html).toContain('data-testid="creative-compare-view"');
    expect(html).toContain('aria-label="Comparison view"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Saved Jul 24");
    expect(html).toContain("Current unsaved");
    expect(html).toContain('data-version="saved"');
    expect(html).toContain('data-version="current"');
    expect(html).not.toContain('aria-label="Comparison split"');
  });

  it("renders split comparison only for matching aspect ratios", () => {
    const split = renderToStaticMarkup(createElement(CreativeCompareView, {
      leftLabel: "Before",
      rightLabel: "After",
      left,
      right,
      leftAspectRatio: "1 / 1",
      rightAspectRatio: "1 / 1",
      initialMode: "split",
    }));
    expect(split).toContain('aria-label="Comparison split"');
    expect(split).toContain('type="range"');
    expect(split).toContain("clip-path:inset(0 50% 0 0)");

    const mismatched = renderToStaticMarkup(createElement(CreativeCompareView, {
      leftLabel: "Portrait",
      rightLabel: "Landscape",
      left,
      right,
      leftAspectRatio: "4 / 5",
      rightAspectRatio: "16 / 9",
      initialMode: "split",
    }));
    expect(mismatched).not.toContain('aria-label="Comparison split"');
    expect(mismatched).toContain('data-version="saved"');
    expect(mismatched).toContain('data-version="current"');
  });

  it("renders toggle mode with an explicit pressed state and one visible creative", () => {
    const html = renderToStaticMarkup(createElement(CreativeCompareView, {
      leftLabel: "Saved",
      rightLabel: "Current",
      left,
      right,
      initialMode: "toggle",
    }));

    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toContain('data-version="saved"');
    expect(html).toContain('data-version="current"');
  });
});

describe("Creative preview and template rendering", () => {
  const settings = normalizeCreativeSettings({
    ...DEFAULT_CREATIVE_SETTINGS,
    template: "featured-sponsor",
    showQr: true,
    showPhone: true,
    showWebsite: true,
    safeAreaVisible: true,
    bleedVisible: true,
    qrMinimumVisible: true,
  });

  it("adds direct-selection semantics to editable elements and marks the selected one", () => {
    const html = renderToStaticMarkup(createElement(CampaignTemplateRenderer, {
      content,
      settings,
      destination: "social-story",
      inspection: {
        selectedElement: "headline",
        onSelect: vi.fn(),
        onClear: vi.fn(),
      },
      qrArtwork: createElement("span", { "data-testid": "exact-qr-artwork" }, "Exact QR"),
    }));

    expect(html).toContain('data-destination="social-story"');
    expect(html).toContain('data-template="featured-sponsor"');
    expect(html).toContain('data-creative-element="image"');
    expect(html).toContain('data-creative-element="headline"');
    expect(html).toContain('data-creative-element="qr"');
    expect(html).toContain('aria-label="Edit headline"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('data-selected="true"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('data-testid="exact-qr-artwork"');
  });

  it("omits every inspector affordance from non-interactive export markup", () => {
    const html = renderToStaticMarkup(createElement(CreativePreviewCanvas, {
      content,
      settings,
      destination: "social",
      formatKey: "story",
      selectedQr: null,
      selectedElement: "headline",
      onSelectElement: vi.fn(),
      onClearSelection: vi.fn(),
      interactive: false,
      showGuides: false,
    }));

    expect(html).toContain('data-testid="creative-preview-canvas"');
    expect(html).toContain('data-destination="social-story"');
    expect(html).not.toContain("data-creative-element");
    expect(html).not.toContain("data-selected");
    expect(html).not.toContain('aria-label="Edit ');
    expect(html).not.toContain("cursor-pointer");
    expect(html).not.toContain("Safe area overlay");
    expect(html).not.toContain("Campaign QR code");
  });

  it("renders original-treatment and print guide overlays as non-interactive annotations", () => {
    const html = renderToStaticMarkup(createElement(CreativePreviewCanvas, {
      content,
      settings: normalizeCreativeSettings({
        ...settings,
        imagePositionX: 16,
        imagePositionY: 74,
        imageZoom: 1.8,
        rotation: 4,
        brightness: 72,
        overlayEnabled: true,
      }),
      destination: "mailer",
      selectedQr: null,
      showOriginal: true,
      showGuides: true,
    }));

    expect(html).toContain('data-original-treatment="true"');
    expect(html).toContain("Before");
    expect(html).toContain("original treatment");
    expect(html).toContain('aria-label="Bleed overlay"');
    expect(html).toContain('aria-label="Safe area overlay"');
    expect(html).toContain('aria-label="Minimum QR size overlay"');
    expect(html).toContain("transform:scale(1) rotate(0deg)");
    expect(html).toContain("brightness(100%)");
    expect(html).not.toContain("scale(1.8)");
  });
});
