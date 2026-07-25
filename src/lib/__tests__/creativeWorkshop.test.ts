import { describe, expect, it } from "vitest";
import {
  DEFAULT_WORKSHOP_STATE,
  affectsPrint,
  createHistory,
  normalizeCreativeSettings,
  normalizeWorkshopState,
  pushHistory,
  redoHistory,
  resetCreativeDestination,
  resolveCreativeSettings,
  undoHistory,
  updateCreativeSettings,
} from "../../features/campaign-templates/creativeWorkshop";

describe("Campaign Creative Workshop state", () => {
  it("normalizes controlled overlay, image, branding, visibility, and safe-area values", () => {
    const settings = normalizeCreativeSettings({
      overlayStyle: "linear",
      overlayOpacity: 140,
      overlayDirection: 90,
      imageZoom: 8,
      rotation: -9,
      primaryColorOverride: "#123456",
      showLogo: false,
      safeAreaVisible: true,
    });
    expect(settings.overlayStyle).toBe("linear");
    expect(settings.overlayOpacity).toBe(100);
    expect(settings.overlayDirection).toBe(90);
    expect(settings.imageZoom).toBe(3);
    expect(settings.rotation).toBe(-5);
    expect(settings.primaryColorOverride).toBe("#123456");
    expect(settings.showLogo).toBe(false);
    expect(settings.safeAreaVisible).toBe(true);
  });

  it("defaults changes globally and creates an override only when explicitly requested", () => {
    const global = updateCreativeSettings(DEFAULT_WORKSHOP_STATE, "social", "global", { overlayOpacity: 42 });
    expect(resolveCreativeSettings(global, "mailer").overlayOpacity).toBe(42);
    expect(global.overrides.social).toBeUndefined();

    const social = updateCreativeSettings(global, "social", "destination", { overlayOpacity: 75 });
    expect(resolveCreativeSettings(social, "social").overlayOpacity).toBe(75);
    expect(resolveCreativeSettings(social, "mailer").overlayOpacity).toBe(42);
  });

  it("preserves QR Studio selection and visibility in destination settings", () => {
    const state = updateCreativeSettings(DEFAULT_WORKSHOP_STATE, "qr", "destination", {
      qrId: "10000000-0000-4000-8000-000000000001",
      showQr: true,
    });
    const qr = resolveCreativeSettings(normalizeWorkshopState(state), "qr");
    expect(qr.qrId).toBe("10000000-0000-4000-8000-000000000001");
    expect(qr.showQr).toBe(true);
  });

  it("supports bounded session undo and redo", () => {
    const next = updateCreativeSettings(DEFAULT_WORKSHOP_STATE, "mailer", "global", { template: "offer-first" });
    const changed = pushHistory(createHistory(DEFAULT_WORKSHOP_STATE), next);
    expect(undoHistory(changed).present.global.template).toBe("hero-visual");
    expect(redoHistory(undoHistory(changed)).present.global.template).toBe("offer-first");
  });

  it("resets one destination without changing global creative", () => {
    const state = updateCreativeSettings(DEFAULT_WORKSHOP_STATE, "social", "destination", { showLogo: false });
    const reset = resetCreativeDestination(state, "social");
    expect(reset.overrides.social).toBeUndefined();
    expect(reset.global.showLogo).toBe(true);
  });

  it("invalidates print for mailer changes but not a Social-only override", () => {
    const social = updateCreativeSettings(DEFAULT_WORKSHOP_STATE, "social", "destination", { textAlign: "center" });
    expect(affectsPrint(DEFAULT_WORKSHOP_STATE, social)).toBe(false);
    const mailer = updateCreativeSettings(DEFAULT_WORKSHOP_STATE, "mailer", "destination", { textAlign: "center" });
    expect(affectsPrint(DEFAULT_WORKSHOP_STATE, mailer)).toBe(true);
  });
});
