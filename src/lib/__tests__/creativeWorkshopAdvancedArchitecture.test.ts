import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const workshop = read("../../pages/business/CampaignCreativeWorkshopAdvanced.tsx");
const inspector = read("../../components/campaign-creative/CreativeInspector.tsx");
const history = read("../../components/campaign-creative/CreativeHistoryDrawer.tsx");
const compare = read("../../components/campaign-creative/CreativeCompareView.tsx");
const modal = read("../../components/campaign-creative/CreativeModal.tsx");
const preview = read("../../components/campaign-creative/CreativePreviewCanvas.tsx");

describe("Creative Workshop Advanced component contracts", () => {
  it("keeps History lazy, retained, retryable, and keyboard-modal", () => {
    expect(workshop).toContain("if (!historyOpen || historyLoaded || historyLoading) return");
    expect(workshop).toContain("limit: 10");
    expect(workshop).toContain("beforeId: lastVersion.id");
    expect(history).toContain('role="dialog"');
    expect(history).toContain('aria-modal="true"');
    expect(history).toContain("trapFocus");
    expect(history).toContain("Retry history");
    expect(history).toContain("Load more history");
  });

  it("supports labeled compare modes without forcing one aspect ratio", () => {
    expect(compare).toContain('label="Side by side"');
    expect(compare).toContain('label="Split"');
    expect(compare).toContain('label="Toggle"');
    expect(compare).toContain("leftAspectRatio");
    expect(compare).toContain("rightAspectRatio");
    expect(compare).not.toContain("aspect-[4/3]");
    expect(workshop).toContain("createCreativeCompareModel(comparePair, compareVersion, saved, state, loaded)");
    expect(workshop).toContain('"history-session"');
    expect(workshop).toContain('"history-saved"');
    expect(workshop).toContain('"saved-session"');
    expect(workshop).toContain("renderStatePreview(saved, destination, loaded, false)");
    expect(workshop).toContain("renderStatePreview(session, destination, loaded, false)");
    expect(workshop).toContain("isEffectiveCreativeDestinationUnsaved(");
    expect(workshop).toContain("resolveEffectiveCreativeDestination(state, destination)");
    expect(workshop).toContain('version.scope === "global"');
  });

  it("restores through confirmation as one unsaved action", () => {
    expect(workshop).toContain('title="Restore this creative version?"');
    expect(workshop).toContain('confirmLabel="Load as unsaved"');
    expect(workshop).toContain('dispatch({ type: "push", value: restored })');
    expect(workshop).toContain("setHistoryOpen(false)");
    expect(workshop).toContain("setHistoryOpen(true)");
    expect(workshop).toContain("It is not saved yet");
  });

  it("routes direct selections into a contextual, mobile-safe inspector", () => {
    expect(preview).toContain("onSelectElement");
    expect(workshop).toContain("getInspectorSectionForElement");
    expect(workshop).toContain('patch.template === "featured-sponsor" && scope === "global"');
    expect(workshop).toContain("reconcileCreativeSelection");
    expect(inspector).toContain("Selected:");
    expect(inspector).toContain("rounded-t-3xl");
    expect(inspector).toContain('role={sheetActive ? "dialog" : undefined}');
    expect(inspector).toContain("trapInspectorFocus");
    expect(inspector).toContain("TEXT_VISIBILITY_KEYS");
    expect(inspector).toContain("Overflow:");
    expect(workshop).toContain("projectOriginalCreativeTreatment(settings)");
    expect(workshop).toContain("selection cleared because it is hidden in this preview");
    expect(inspector).toContain("event.stopPropagation()");
  });

  it("provides full-viewport exact-state preview and scoped reset confirmations", () => {
    expect(workshop).toContain('eyebrow="Full-screen creative preview"');
    expect(workshop).toContain('closeLabel="Exit full screen"');
    expect(workshop).toContain('aria-label="Full-screen format"');
    expect(workshop).toContain("fullScreenGuides");
    expect(preview).toContain("safeAreaOverride ?? applied.safeAreaVisible");
    expect(modal).toContain("fullViewport");
    expect(modal).toContain("trapFocus");
    expect(modal).toContain("document.activeElement === container");
    expect(history).toContain("document.activeElement === container");
    expect(history).toContain("event.stopPropagation()");
    expect(modal).toContain("event.stopPropagation()");
    expect(inspector).toContain("0.75 in module field minimum");
    expect(workshop).toContain("sectionResetRequiresMailerQrPreservation(resetSection, destination, scope)");
    expect(workshop).toContain('title={resetTitle(pendingReset, destination, scope)}');
    expect(workshop).toContain('confirmLabel="Reset settings"');
  });
});
