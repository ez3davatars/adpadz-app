import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

const app = read("../../App.tsx");
const shell = read("../../components/campaign-shell/CampaignShell.tsx");
const shellContext = read("../../components/campaign-shell/campaignShellContext.ts");
const stageNavigation = read("../../components/campaign-shell/CampaignStageNavigation.tsx");
const layout = read("../../components/layout/BusinessLayout.tsx");
const setup = read("../../pages/business/CreateAd.tsx");
const studio = read("../../pages/business/CampaignCreativeWorkshopAdvanced.tsx");
const review = read("../../pages/business/CampaignReview.tsx");
const publish = read("../../pages/business/CampaignDistribution.tsx");
const list = read("../../pages/business/Campaigns.tsx");
const dashboard = read("../../pages/business/Dashboard.tsx");
const qrStudio = read("../../pages/business/QRStudio.tsx");
const inspector = read("../../components/campaign-creative/CreativeInspector.tsx");

describe("Campaign shell route architecture", () => {
  it("nests every workflow stage inside one Campaign shell", () => {
    expect(app).toContain('path="campaigns/:campaignId" element={<CampaignShell />}');
    for (const segment of ["setup", "creative", "review", "distribution"]) {
      expect(app).toContain(`path="${segment}"`);
    }
    expect(app).toContain("<CampaignReview />");
    expect(app).toContain("<CampaignCreativeWorkshop />");
    expect(app).toContain("<CampaignDistribution />");
  });

  it("keeps legacy campaign deep links working through safe redirects", () => {
    expect(app).toContain('path="edit" element={<RedirectPreservingSearch to="../setup" />}');
    expect(app).toContain("function RedirectPreservingSearch");
    expect(app).toContain("`${to}${location.search}${location.hash}`");
    expect(app).toContain('path="content"');
    expect(app).toContain('path="distribution/social"');
  });

  it("shares campaign and readiness with stages instead of refetching per stage", () => {
    expect(shellContext).toContain("useOutletContext");
    expect(shellContext).toContain("refreshShell");
    expect(shell).toContain("loadBusinessCampaignReadiness");
    expect(shell).toContain("<Outlet context={context} />");
    expect(setup).toContain("useCampaignShell");
    expect(studio).toContain("shell?.refreshShell()");
    // Stages must not each re-derive readiness from scratch.
    expect(review).toContain("useCampaignShell");
    expect(review).not.toContain("loadBusinessCampaignReadiness");
  });

  it("renders one campaign title and one stage navigation", () => {
    expect(shell).toContain("<h1");
    expect(shell).toContain("<CampaignStageNavigation");
    expect(stageNavigation).toContain('aria-label="Campaign workflow"');
    expect(stageNavigation).toContain('aria-current={current ? "step" : undefined}');
    // Stages must not render competing campaign titles.
    expect(studio).not.toContain("{loaded.campaign.title}</h1>");
    expect(publish).not.toContain("text-3xl font-black\">{creative.campaign.title}");
    expect(review).not.toContain("<h1");
  });

  it("exposes exactly one Campaigns sidebar entry and no duplicate distribution destination", () => {
    const campaignEntries = layout.match(/label: 'Campaigns'/g) ?? [];
    expect(campaignEntries).toHaveLength(1);
    expect(layout).not.toContain("label: 'Campaign Distribution'");
    expect(layout).not.toContain("label: 'Campaign Studio'");
    expect(layout).toContain("label: 'Community Mailers'");
    expect(layout).toContain("label: 'QR Studio'");
  });
});

describe("Campaign stage responsibilities", () => {
  it("removes creative authoring controls from Setup", () => {
    expect(setup).not.toContain("TemplateStudioPreview");
    expect(setup).not.toContain("RangeControl");
    expect(setup).not.toContain("Reset image framing");
    expect(setup).not.toContain("Offer image framing");
    expect(setup).not.toContain("Live destination previews");
    // Setup keeps a compact read-only summary plus the Studio entry point.
    expect(setup).toContain("StudioIntroPanel");
    expect(setup).toContain("CreativeSummary");
    expect(setup).toContain(">Open Studio</AdpadzButton>");
  });

  it("keeps Review read-only, cross-destination, and print aware", () => {
    expect(review).toContain("CREATIVE_DESTINATIONS.map");
    expect(review).toContain("buildDestinationCreativeView");
    expect(review).toContain("<CampaignTemplateRenderer");
    expect(review).toContain("Return to Studio");
    expect(review).toContain("Continue to Publish");
    expect(review).toContain("invalidates print preflight");
    expect(review).toContain("Customized");
    // No creative editing may leak into Review.
    expect(review).not.toContain("CreativeInspector");
    expect(review).not.toContain("updateCreativeSettings");
    expect(review).not.toContain("onChange={");
  });

  it("presents Adpadz TV only as a planned destination", () => {
    expect(review).toContain("Adpadz TV");
    expect(review).toContain("Coming Later");
    expect(review).toContain("16:9 and 9:16");
    expect(review).toContain("digital signage");
    expect(review).not.toContain('destination="tv"');
  });

  it("reuses Campaign Distribution as the Publish stage", () => {
    expect(publish).toContain("exportSocialCreativeElement");
    expect(publish).toContain("Open Creative Workshop");
    expect(publish).toContain('AdpadzBadge variant="campaign">Publish');
    expect(publish).toContain("Read-only");
  });
});

describe("Stage-aware entry points", () => {
  it("gives each campaign card one primary stage action plus quiet stage links", () => {
    expect(list).toContain("resolveCampaignStageAction");
    expect(list).toContain("href={stageAction.href}");
    expect(list).toContain("CAMPAIGN_STAGES.map");
    expect(list).toContain("campaignStagePath(campaign.id, stage.key)");
    expect(list).not.toContain("Package</AdpadzButton>");
  });

  it("routes dashboard next actions into campaign stages", () => {
    expect(dashboard).toContain("resolveCampaignStageAction");
    expect(dashboard).toContain("UrgentCampaignCard");
    expect(dashboard).toContain("to={action.href}");
    expect(dashboard).not.toContain("readiness?.nextAction?.destination");
  });

  it("supports a validated QR Studio return trip to the campaign", () => {
    expect(qrStudio).toContain("CAMPAIGN_RETURN_SEGMENTS");
    expect(qrStudio).toContain("resolveCampaignReturnSegment");
    expect(qrStudio).toContain("isSafeCampaignId");
    expect(qrStudio).toContain("Back to Campaign");
    expect(qrStudio).toContain("searchParams.get('return')");
    expect(qrStudio).toContain("searchParams.get('campaign')");
    expect(inspector).toContain("&return=creative");
  });
});
