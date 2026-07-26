import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("campaign template persistence architecture", () => {
  it("persists controlled settings with campaign outputs", () => {
    const studio = readFileSync("src/pages/business/CreateAd.tsx", "utf8");
    expect(studio).toContain("template_settings");
    expect(studio).toContain("normalizeTemplateSettings");
    expect(studio).not.toContain("contentEditable");
  });

  it("freezes the exact effective Mailer treatment into future production snapshots", () => {
    const migration = readFileSync(
      "supabase/migrations/20260725030500_snapshot_effective_mailer_creative.sql",
      "utf8",
    );
    const override = migration.indexOf(
      "'creative_workshop',\n              'overrides',\n              'mailer'",
    );
    const global = migration.indexOf(
      "'creative_workshop',\n              'global'",
      override,
    );
    const legacy = migration.indexOf(
      "template_output.metadata -> 'template_settings'",
      global,
    );
    expect(override).toBeGreaterThan(-1);
    expect(global).toBeGreaterThan(override);
    expect(legacy).toBeGreaterThan(global);
    expect(migration).toContain(
      "'creative_settings', creative.effective_mailer_settings",
    );
    expect(migration).toContain(
      "'creative_format_key', creative.effective_mailer_format",
    );
    expect(migration).toContain(
      "'creative_version_id', bound_version.id",
    );
    expect(migration).toContain(
      "'creative_settings_fingerprint', bound_version.settings_fingerprint",
    );
    expect(migration).toContain(
      "'effective_mailer_settings', effective_mailer_settings",
    );
    expect(migration).toContain(
      "'mailer_format_key', effective_mailer_format",
    );
    expect(migration).toContain(
      "public.can_manage_community_mailers(auth.uid())",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.create_admin_community_mailer_snapshots(uuid)",
    );
  });

  it("carries immutable Mailer settings, format, and version evidence into the candidate manifest", () => {
    const candidate = readFileSync("src/lib/communityMailerCandidate.ts", "utf8");
    expect(candidate).toContain("templateContractVersion: 2");
    expect(candidate).toContain(
      "creativeSettings: placement.creativeSettings ||",
    );
    expect(candidate).toContain(
      'creativeFormatKey: placement.creativeFormatKey || "standard"',
    );
    expect(candidate).toContain(
      "creativeVersionId: placement.creativeVersionId || null",
    );
    expect(candidate).toContain(
      "placement.creativeSettingsFingerprint || null",
    );
  });
});
