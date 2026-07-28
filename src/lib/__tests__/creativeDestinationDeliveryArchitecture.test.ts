import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const feed = read("../../pages/consumer/Feed.tsx");
const adView = read("../../pages/consumer/AdView.tsx");
const studio = read("../../pages/business/CreateAd.tsx");
const campaigns = read("../campaigns.ts");
const renderer = read("../../features/campaign-templates/CampaignTemplateRenderer.tsx");

describe("canonical creative destination delivery", () => {
  it("uses the shared destination creative view for Discovery, QR Landing, and Campaign Studio", () => {
    expect(feed).toContain("buildDestinationCreativeView({");
    expect(feed).toContain("metadata: experience.output.metadata");
    expect(feed).toContain("destination: 'discovery'");
    expect(adView).toContain("buildDestinationCreativeView({");
    expect(adView).toContain("metadata: experience.output.metadata");
    expect(adView).toContain("destination: 'qr'");
    expect(studio).toContain("buildDestinationCreativeView({");
    expect(studio).toContain("destination: 'discovery'");
    expect(feed).toContain("settings={creative.renderSettings}");
    expect(adView).toContain("settings={creative.renderSettings}");
  });

  it("propagates Business Hub phone and website through Studio and public destinations", () => {
    expect(campaigns).toContain("website: string | null");
    expect(campaigns).toContain("phone: string | null");
    expect(campaigns).toContain("cover_image_url,website,phone,primary_color");
    expect(feed).toContain("businessPhone: experience.business?.phone");
    expect(feed).toContain("businessWebsite: experience.business?.website");
    expect(adView).toContain("businessPhone: experience.business?.phone");
    expect(adView).toContain("businessWebsite: experience.business?.website");
    expect(studio).toContain("businessPhone: businessHub?.phone || selectedCard?.phone");
    expect(studio).toContain("businessWebsite: businessHub?.website || selectedCard?.website");
  });

  it("hydrates referenced images in one existing-RLS-constrained asset query", () => {
    expect(campaigns).toContain("creativeAssetIdsByCampaign");
    expect(campaigns).toContain("creativeAssets");
    expect(campaigns.match(/\.from\('business_marketing_assets'\)/g)).toHaveLength(1);
    expect(feed).toContain("assets: experience.creativeAssets");
    expect(adView).toContain("assets: experience.creativeAssets");
  });

  it("does not open public raw QR reads and uses the narrow projection for exact artwork", () => {
    expect(feed).not.toContain(".from('qr_links')");
    expect(adView).not.toContain(".from('qr_links')");
    expect(campaigns).toContain("supabase.rpc('get_public_campaign_qr_artwork'");
    expect(studio).toContain(".from('qr_links').select('*').eq('owner_user_id', userId)");
    expect(renderer).toContain("qrArtwork?: ReactNode");
    expect(studio).toContain("qrArtwork={selectedQr && creative.qrResolution === 'exact'");
    expect(feed).toContain("<QRStudioPreview qr={qrArtwork} />");
    expect(adView).toContain("<QRStudioPreview qr={qrArtwork} />");
  });

  it("honors the saved Discovery and QR destination aspect ratios without repainting overlays", () => {
    expect(feed).toContain('aspect-square overflow-hidden bg-[var(--bg-input)]');
    expect(adView).toContain('aspect-[3/4] overflow-hidden');
    expect(adView).not.toContain('absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/20');
  });
});
