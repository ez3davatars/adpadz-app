import { describe, expect, it } from "vitest";
import {
  canTransitionCommunityMailer,
  COMMUNITY_MAILER_GEOMETRY,
  COMMUNITY_MAILER_PRODUCTION_DEMO_STATES,
  geometryForMailer,
  isCurrentExport,
  isCurrentPreflight,
  qrPhysicalSize,
  type ProductionState,
} from "../communityMailerProductionContracts";

describe("Community Mailer production contracts", () => {
  it("permits only the canonical forward lifecycle and archival", () => {
    const flow: ProductionState[] = [
      "draft",
      "selling",
      "building",
      "review",
      "ready_for_print",
      "printed",
      "mailed",
      "published",
      "archived",
    ];
    flow.slice(0, -1).forEach((state, index) =>
      expect(canTransitionCommunityMailer(state, flow[index + 1])).toBe(true)
    );
    expect(canTransitionCommunityMailer("draft", "printed")).toBe(false);
    expect(canTransitionCommunityMailer("printed", "ready_for_print")).toBe(
      false,
    );
    expect(canTransitionCommunityMailer("archived", "selling")).toBe(false);
  });

  it("calculates both formats at the canonical 300 DPI", () => {
    expect(geometryForMailer("postcard_9x12")).toMatchObject({
      finishedPixels: { width: 3600, height: 2700 },
      bleedPixels: { width: 3675, height: 2775 },
    });
    expect(geometryForMailer("community_card_6x11")).toMatchObject({
      finishedPixels: { width: 3300, height: 1800 },
      bleedPixels: { width: 3375, height: 1875 },
    });
    expect(COMMUNITY_MAILER_GEOMETRY.postcard_9x12.safeInsetInches).toBe(0.125);
  });

  it("rejects stale preflights and exports", () => {
    const current = {
      layoutRevision: 7,
      preflightLayoutRevision: 7,
      exportLayoutRevision: 7,
      layoutLocked: true,
      preflightPassed: true,
    };
    expect(isCurrentPreflight(current)).toBe(true);
    expect(isCurrentExport(current)).toBe(true);
    expect(isCurrentExport({ ...current, exportLayoutRevision: 6 })).toBe(false);
    expect(isCurrentPreflight({ ...current, layoutLocked: false })).toBe(false);
  });

  it("calculates QR size in physical units", () => {
    expect(qrPhysicalSize("postcard_9x12", 25, 25)).toBe(0.75);
    expect(qrPhysicalSize("community_card_6x11", 20, 25)).toBe(0.55);
  });

  it("defines every required local verification state", () => {
    expect(COMMUNITY_MAILER_PRODUCTION_DEMO_STATES).toContain("export_stale");
    expect(COMMUNITY_MAILER_PRODUCTION_DEMO_STATES).toContain(
      "artwork_changes_requested",
    );
    expect(COMMUNITY_MAILER_PRODUCTION_DEMO_STATES[COMMUNITY_MAILER_PRODUCTION_DEMO_STATES.length - 1]).toBe("published");
  });
});
