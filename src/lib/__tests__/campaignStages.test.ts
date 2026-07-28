import { describe, expect, it } from "vitest";
import type { CampaignRecord } from "../ads";
import { evaluateCampaignReadiness } from "../campaignReadiness";
import {
  CAMPAIGN_STAGES,
  campaignStageFromPath,
  campaignStagePath,
  deriveCampaignStageStates,
  normalizeCampaignActionDestination,
  resolveCampaignStageAction,
} from "../campaignStages";

const campaign: CampaignRecord = {
  id: "campaign-1",
  owner_id: "owner-1",
  title: "Summer coffee flight",
  headline: "Taste the summer lineup",
  description: "Three local roasts.",
  offer_title: "20% off",
  offer_description: "Weekdays only",
  cta_label: "Claim offer",
  cta_url: "https://example.com/offer",
  status: "draft",
  start_date: null,
  end_date: null,
  primary_image_id: "asset-1",
} as CampaignRecord;

const readyContext = {
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
};

describe("campaign workflow stages", () => {
  it("defines the approved Setup → Studio → Review → Publish workflow", () => {
    expect(CAMPAIGN_STAGES.map(stage => stage.key)).toEqual(["setup", "studio", "review", "publish"]);
    expect(CAMPAIGN_STAGES.map(stage => stage.segment)).toEqual(["setup", "creative", "review", "distribution"]);
    expect(CAMPAIGN_STAGES.map(stage => stage.label)).toEqual(["Setup", "Studio", "Review", "Publish"]);
  });

  it("maps stages onto shell routes and recognizes them from paths", () => {
    expect(campaignStagePath("c1", "setup")).toBe("/app/business/campaigns/c1/setup");
    expect(campaignStagePath("c1", "studio")).toBe("/app/business/campaigns/c1/creative");
    expect(campaignStagePath("c1", "publish")).toBe("/app/business/campaigns/c1/distribution");
    expect(campaignStageFromPath("/app/business/campaigns/c1/creative")).toBe("studio");
    expect(campaignStageFromPath("/app/business/campaigns/c1/review")).toBe("review");
    expect(campaignStageFromPath("/app/business/campaigns/c1/distribution/social")).toBe("publish");
    expect(campaignStageFromPath("/app/business/campaigns/c1/content")).toBeNull();
    expect(campaignStageFromPath("/app/business/qr-studio")).toBeNull();
  });

  it("normalizes legacy /edit destinations into /setup without touching others", () => {
    expect(normalizeCampaignActionDestination("/app/business/campaigns/c1/edit?section=media"))
      .toBe("/app/business/campaigns/c1/setup?section=media");
    expect(normalizeCampaignActionDestination("/app/business/campaigns/c1/distribution"))
      .toBe("/app/business/campaigns/c1/distribution");
    expect(normalizeCampaignActionDestination("/app/business/qr-studio"))
      .toBe("/app/business/qr-studio");
  });

  it("routes issue-driven next actions to Setup with stage awareness", () => {
    const readiness = evaluateCampaignReadiness({
      ...readyContext,
      campaign: { ...campaign, primary_image_id: null },
      campaignImageUrl: null,
    });
    const action = resolveCampaignStageAction(campaign, readiness);
    expect(action.stage).toBe("setup");
    expect(action.href).toBe("/app/business/campaigns/campaign-1/setup?section=media");
    expect(action.label).toBe("Add campaign image");
  });

  it("routes a fully ready draft campaign to Review, and an active one to Publish", () => {
    const readiness = evaluateCampaignReadiness(readyContext);
    expect(readiness.blockers).toHaveLength(0);
    const draftAction = resolveCampaignStageAction(campaign, readiness);
    expect(draftAction.stage).toBe("review");
    expect(draftAction.label).toBe("Review Campaign");
    expect(draftAction.href).toBe("/app/business/campaigns/campaign-1/review");

    const activeReadiness = evaluateCampaignReadiness({
      ...readyContext,
      campaign: { ...campaign, status: "active" },
    });
    const activeAction = resolveCampaignStageAction({ ...campaign, status: "active" }, activeReadiness);
    expect(activeAction.stage).toBe("publish");
    expect(activeAction.href).toBe("/app/business/campaigns/campaign-1/distribution");
  });

  it("derives stage states from the canonical readiness engine", () => {
    const blockedReadiness = evaluateCampaignReadiness({
      ...readyContext,
      campaign: { ...campaign, title: "", primary_image_id: null },
      campaignImageUrl: null,
    });
    const blockedStates = deriveCampaignStageStates(campaign, blockedReadiness);
    expect(blockedStates.setup.status).toBe("blocked");
    expect(blockedStates.setup.detail).toBeTruthy();
    expect(blockedStates.review.status).toBe("blocked");
    expect(blockedStates.review.detail).toContain("blocker");

    const readyStates = deriveCampaignStageStates(campaign, evaluateCampaignReadiness(readyContext));
    expect(readyStates.setup.status).toBe("complete");
    expect(readyStates.review.status).toBe("complete");
    expect(readyStates.publish.status).toBe("available");

    const activeStates = deriveCampaignStageStates(
      { status: "active" },
      evaluateCampaignReadiness({ ...readyContext, campaign: { ...campaign, status: "active" } }),
    );
    expect(activeStates.publish.status).toBe("complete");
  });
});
