import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const distribution = readFileSync(
  new URL("../../pages/business/CampaignDistribution.tsx", import.meta.url),
  "utf8",
);
const renderer = readFileSync(
  new URL("../../features/campaign-templates/CampaignTemplateRenderer.tsx", import.meta.url),
  "utf8",
);

describe("Creative Workshop distribution delivery", () => {
  it("replaces the overview thumbnail with a canonical read-only Discovery preview", () => {
    expect(distribution).toContain("resolveDestinationCreative(interactiveOutput?.metadata, 'discovery'");
    expect(distribution).toContain('data-testid="saved-distribution-creative"');
    expect(distribution).toContain('aria-label="Saved Consumer Discovery creative preview"');
    expect(distribution).toContain("businessPhone: creative.phone");
    expect(distribution).toContain("businessWebsite: creative.website");
    expect(distribution).toContain("qrArtwork={exactQr ? <QRStudioPreview");
    expect(distribution).toContain('>Destination</dt>');
    expect(distribution).toContain('>Template</dt>');
    expect(distribution).toContain('>Readiness</dt>');
    expect(distribution).toContain("Read-only");
    expect(distribution).not.toContain('<img src={creative.campaignImageUrl}');
  });

  it("renders the saved effective Social creative through the shared template renderer", () => {
    expect(distribution).toContain("resolveDestinationCreative(output?.metadata, 'social'");
    expect(distribution).toContain("<CampaignTemplateRenderer");
    expect(distribution).toContain("settings={resolved.renderSettings}");
    expect(distribution).toContain("destination={resolved.rendererDestination}");
    expect(distribution).not.toContain("CampaignCreativeRenderer");
  });

  it("keeps creative settings read-only while retaining exact export and Workshop actions", () => {
    expect(distribution).not.toContain("SOCIAL_TEMPLATES");
    expect(distribution).not.toContain("setTemplate(");
    expect(distribution).not.toContain("setFormat(");
    expect(distribution).toContain("exportSocialCreativeElement");
    expect(distribution).toContain("Download image");
    expect(distribution).toContain("Export social asset");
    expect(distribution).toContain("Open published campaign");
    expect(distribution).toContain("Prepare to publish");
    expect(distribution).toContain("Open Creative Workshop");
  });

  it("supports owner-authorized QR Studio artwork inside the shared renderer", () => {
    expect(renderer).toContain("qrArtwork?: ReactNode");
    expect(distribution).toContain("qrArtwork={exactQr ? <QRStudioPreview");
    expect(distribution).toContain("new URL(value, window.location.origin).toString()");
  });

  it("scopes Business Hub branding to the Campaign's assigned business", () => {
    expect(distribution).toContain("const campaign = campaignResult.data as CampaignRecord");
    expect(distribution).toContain(".eq('business_id', campaign.business_id)");
    expect(distribution).toContain(".eq('id', campaign.business_id)");
    expect(distribution).not.toContain(
      "from('business_cards').select('id,business_name,slug,logo_url,cover_image_url,primary_color,accent_color,website,phone,address,is_published').eq('owner_user_id', auth.user.id).order('updated_at'",
    );
    expect(distribution).not.toContain(
      "from('businesses').select('name,category,service_area,address,website,phone,active').eq('owner_user_id', auth.user.id).order('updated_at'",
    );
  });
});
