import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const workshop = [
  "../../pages/business/CampaignCreativeWorkshopAdvanced.tsx",
  "../../components/campaign-creative/CreativeInspector.tsx",
  "../../components/campaign-creative/CreativeHistoryDrawer.tsx",
].map(path => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");
const app = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");
const studio = readFileSync(new URL("../../pages/business/CreateAd.tsx", import.meta.url), "utf8");
const distribution = readFileSync(
  new URL("../../pages/business/CampaignDistribution.tsx", import.meta.url),
  "utf8",
);

describe("Creative Workshop component architecture", () => {
  it("owns the dedicated campaign creative route inside the Campaign shell", () => {
    expect(app).toContain('path="campaigns/:campaignId" element={<CampaignShell />}');
    expect(app).toContain('path="creative"');
    expect(app).toContain("<CampaignCreativeWorkshop />");
  });

  it("exposes accessible destination, format, inspector, history, and save controls", () => {
    expect(workshop).toContain('aria-label="Creative destinations"');
    expect(workshop).toContain('role="listbox"');
    expect(workshop).toContain('aria-expanded={open}');
    expect(workshop).toContain('aria-label="Undo creative change"');
    expect(workshop).toContain('aria-label="Redo creative change"');
    expect(workshop).toContain("Save Creative");
  });

  it("provides the required inspector families and controlled QR picker", () => {
    for (const section of [
      "Template", "Image", "Overlay", "QR", "Text", "Branding", "Visibility", "Print Safety",
    ]) expect(workshop).toContain(`"${section}"`);
    expect(workshop).toContain('aria-label="Choose from QR Studio"');
    expect(workshop).toContain("<QRStudioPreview");
  });

  it("keeps Campaign Studio and Distribution as summaries rather than duplicate editors", () => {
    expect(studio).toContain("CreativeSummary");
    expect(studio).toContain("Open Studio");
    expect(distribution).toContain("Open Creative Workshop");
    expect(distribution).not.toContain("OverlayControls");
  });

  it("provides an intentional mobile save action and horizontal-overflow guard", () => {
    expect(workshop).toContain("fixed inset-x-0 bottom-0");
    expect(workshop).toContain("min-w-0 max-w-full");
    expect(workshop).toContain("xl:hidden");
  });
});
