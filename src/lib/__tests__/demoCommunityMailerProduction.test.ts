import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEMO_MAILER_PRODUCTION_SCENARIOS } from "../demoCommunityMailerProduction";

describe("Community Mailer production demo fixtures", () => {
  it("contains every required deterministic review state", () => {
    expect(DEMO_MAILER_PRODUCTION_SCENARIOS.map(([id]) => id)).toEqual([
      "selling", "reserved", "paid", "missing_campaign",
      "campaign_incomplete", "qr_incomplete", "artwork_changes",
      "artwork_approved", "preflight_blocked", "preflight_warning", "ready",
      "candidate_current", "candidate_stale", "printer_certified", "printed",
      "mailed", "published",
    ]);
  });
  it("is mounted in the existing demo workspace without an auth bypass", () => {
    const workspace = readFileSync("src/pages/DemoWorkspace.tsx", "utf8");
    expect(workspace).toContain("DemoCommunityMailerProduction");
    expect(workspace).not.toContain("bypass");
  });
});
