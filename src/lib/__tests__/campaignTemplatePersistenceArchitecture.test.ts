import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("campaign template persistence architecture", () => {
  it("persists controlled settings with campaign outputs", () => {
    const studio = readFileSync("src/pages/business/CreateAd.tsx", "utf8");
    expect(studio).toContain("template_settings");
    expect(studio).toContain("normalizeTemplateSettings");
    expect(studio).not.toContain("contentEditable");
  });

  it("freezes template settings into mailer production snapshots and fingerprints", () => {
    const migration = readFileSync(
      "supabase/migrations/20260725020000_snapshot_campaign_template_settings.sql",
      "utf8",
    );
    expect(migration).toContain("'template_settings'");
    expect(migration).toContain("template_output.metadata -> 'template_settings'");
    expect(migration).toContain("COALESCE((template_output.metadata -> 'template_settings')::text, '{}')");
  });

  it("carries immutable template settings into the candidate manifest", () => {
    const candidate = readFileSync("src/lib/communityMailerCandidate.ts", "utf8");
    expect(candidate).toContain("templateContractVersion: 1");
    expect(candidate).toContain("templateSettings: placement.templateSettings || null");
  });
});
