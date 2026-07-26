import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const renderer = readFileSync(
  new URL("../../features/campaign-templates/CampaignTemplateRenderer.tsx", import.meta.url),
  "utf8",
);

describe("Campaign template direct inspector architecture", () => {
  it("keeps inspection optional so default and export renderers remain unchanged", () => {
    expect(renderer).toContain("inspection?: CampaignTemplateInspection");
    expect(renderer).toContain('if (!inspection) return ""');
    expect(renderer).toContain("if (!inspection) return {}");
  });

  it("provides named, keyboard-accessible hit targets without draggable layout controls", () => {
    expect(renderer).toContain('"data-creative-element": element');
    expect(renderer).toContain('role: "button"');
    expect(renderer).toContain("tabIndex: 0");
    expect(renderer).toContain('event.key !== "Enter" && event.key !== " "');
    expect(renderer).not.toContain("draggable");
  });

  it("keeps pointer access to both a full-bleed image and the overlay perimeter", () => {
    const imageTarget = renderer.indexOf("{content.imageUrl && (");
    const overlayTarget = renderer.indexOf('data-testid="creative-overlay-hit-target"');
    expect(imageTarget).toBeGreaterThanOrEqual(0);
    expect(overlayTarget).toBeGreaterThan(imageTarget);
    expect(renderer).toContain("pointer-events-auto absolute inset-x-[28%] top-0");
    expect(renderer).toContain("onClick={overlayInspectionProps.onClick}");
  });

  it("honors visibility while keeping identity and contact elements independently inspectable", () => {
    for (const flag of [
      "showLogo",
      "showBusinessName",
      "showHeadline",
      "showOffer",
      "showCta",
      "showPhone",
      "showWebsite",
      "showSponsorBadge",
    ]) expect(renderer).toContain(flag);
    expect(renderer).toContain('inspectionProps("logo", inspection)');
    expect(renderer).toContain('inspectionProps("business-name", inspection)');
    expect(renderer).toContain('inspectionProps("phone", inspection)');
    expect(renderer).toContain('inspectionProps("website", inspection)');
  });

  it("adds edit-only outlines that do not affect template geometry", () => {
    expect(renderer).toContain('selected ? "outline outline-2');
    expect(renderer).toContain("outline-offset-[-2px]");
    expect(renderer).toContain("boxStyle(layout.image)");
    expect(renderer).toContain("boxStyle(layout.qr)");
  });

  it("renders constrained overlay and text treatments inside the shared renderer", () => {
    expect(renderer).toContain("creativeOverlayBackground(creative)");
    expect(renderer).toContain('className="pointer-events-none absolute inset-0"');
    expect(renderer).toContain("HEADLINE_SIZE_CLASSES[headlineSize]");
    expect(renderer).toContain("creativeTextPanelBackground(textPanel, light)");
    expect(renderer).toContain("textAlign");
  });
});
