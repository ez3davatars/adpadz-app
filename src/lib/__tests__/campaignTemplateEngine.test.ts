import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_TEMPLATES,
  DEFAULT_TEMPLATE_SETTINGS,
  evaluateTemplateReadiness,
  normalizeCampaignContent,
  normalizeTemplateSettings,
  resolveTemplateLayout,
} from "../../features/campaign-templates";

const campaign = {
  id: "campaign-1",
  owner_id: "owner-1",
  title: "Summer campaign",
  headline: "Cool down locally",
  offer_title: "20% off",
  cta_label: "Claim offer",
  cta_url: "https://example.com/offer",
  status: "active",
  end_date: "2026-08-31T23:59:59Z",
};

describe("campaign template engine", () => {
  it("registers the four controlled template families with normalized boxes", () => {
    expect(CAMPAIGN_TEMPLATES.map(item => item.key)).toEqual([
      "hero-visual", "offer-first", "brand-focus", "featured-sponsor",
    ]);
    for (const template of CAMPAIGN_TEMPLATES) {
      for (const box of Object.values(resolveTemplateLayout(template.key))) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(1);
        expect(box.y + box.height).toBeLessThanOrEqual(1);
      }
    }
  });

  it("normalizes unsafe or stale settings to controlled values", () => {
    expect(normalizeTemplateSettings({
      template: "freeform",
      imageFit: "stretch",
      imagePositionX: -40,
      imagePositionY: 160,
      imageZoom: 99,
      theme: "unknown",
    })).toEqual({
      ...DEFAULT_TEMPLATE_SETTINGS,
      imagePositionX: 0,
      imagePositionY: 100,
      imageZoom: 3,
    });
  });

  it("uses one content contract and applies family-specific readiness", () => {
    const content = normalizeCampaignContent({ campaign, businessName: "Adpadz Test", imageUrl: "https://example.com/image.jpg" });
    expect(content.offer).toBe("20% off");
    expect(evaluateTemplateReadiness(content, { ...DEFAULT_TEMPLATE_SETTINGS, template: "offer-first" }).ready).toBe(true);
    expect(evaluateTemplateReadiness(content, { ...DEFAULT_TEMPLATE_SETTINGS, template: "brand-focus" }).blockers[0]?.field).toBe("logo");
    expect(evaluateTemplateReadiness(content, { ...DEFAULT_TEMPLATE_SETTINGS, showQr: true }).ready).toBe(true);
  });
});
