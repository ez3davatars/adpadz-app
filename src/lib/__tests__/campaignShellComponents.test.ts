import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { CampaignRecord } from "../ads";
import { evaluateCampaignReadiness } from "../campaignReadiness";
import { deriveCampaignStageStates, resolveCampaignStageAction } from "../campaignStages";

vi.mock("../supabase", () => ({ supabase: { auth: { getUser: vi.fn() }, from: vi.fn() } }));

const campaign: CampaignRecord = {
  id: "campaign-1",
  owner_id: "owner-1",
  title: "Summer coffee flight",
  headline: "Taste the summer lineup",
  description: "Three local roasts.",
  offer_title: "20% off",
  cta_label: "Claim offer",
  cta_url: "https://example.com/offer",
  status: "draft",
  primary_image_id: "asset-1",
} as CampaignRecord;

const readyReadiness = evaluateCampaignReadiness({
  campaign,
  business: {
    name: "River City Coffee",
    logoUrl: "https://cdn.example/logo.png",
    category: "Coffee",
    location: "River City",
    website: "https://rivercity.example",
    phone: "(904) 555-0101",
    profilePublished: true,
    active: true,
  },
  campaignImageUrl: "https://cdn.example/offer.jpg",
  outputs: [{ campaign_id: "campaign-1", output_type: "interactive_ad", enabled: true, sort_order: 0 }],
  qr: { exists: true, valid: true, publishable: true, publicRouteResolves: true },
});

const blockedReadiness = evaluateCampaignReadiness({
  campaign: { ...campaign, primary_image_id: null },
  business: { name: "River City Coffee", profilePublished: false, active: true },
  campaignImageUrl: null,
});

async function renderStageNavigation(readiness: typeof readyReadiness, stagePath: string) {
  const module = await import("../../components/campaign-shell/CampaignStageNavigation");
  return renderToStaticMarkup(createElement(
    MemoryRouter,
    { initialEntries: [stagePath] },
    createElement(module.CampaignStageNavigation, {
      campaignId: campaign.id,
      stage: "studio",
      stageStates: deriveCampaignStageStates(campaign, readiness),
    }),
  ));
}

describe("Campaign stage navigation", () => {
  it("marks the current stage with aria-current and links every stage", async () => {
    const html = await renderStageNavigation(readyReadiness, "/app/business/campaigns/campaign-1/creative");
    expect(html).toContain('aria-label="Campaign workflow"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("/app/business/campaigns/campaign-1/setup");
    expect(html).toContain("/app/business/campaigns/campaign-1/creative");
    expect(html).toContain("/app/business/campaigns/campaign-1/review");
    expect(html).toContain("/app/business/campaigns/campaign-1/distribution");
    expect(html).toContain("Setup");
    expect(html).toContain("Studio");
    expect(html).toContain("Review");
    expect(html).toContain("Publish");
  });

  it("explains blocked stages to assistive technology", async () => {
    const html = await renderStageNavigation(blockedReadiness, "/app/business/campaigns/campaign-1/creative");
    expect(html).toContain("blocked:");
    expect(html).toMatch(/campaign image|business|destination/i);
  });

  it("uses a semantic ordered list so the workflow order is conveyed", async () => {
    const html = await renderStageNavigation(readyReadiness, "/app/business/campaigns/campaign-1/creative");
    expect(html).toContain("<ol");
    expect((html.match(/<li/g) ?? []).length).toBe(4);
  });
});

describe("Campaign stage actions", () => {
  it("offers one action per campaign state", () => {
    expect(resolveCampaignStageAction(campaign, readyReadiness).label).toBe("Review Campaign");
    expect(resolveCampaignStageAction({ ...campaign, status: "active" }, readyReadiness).label)
      .toBe("View Published Campaign");
    const blockedAction = resolveCampaignStageAction(campaign, blockedReadiness);
    expect(blockedAction.href).toContain("/setup");
    expect(blockedAction.reason).toBeTruthy();
  });
});
