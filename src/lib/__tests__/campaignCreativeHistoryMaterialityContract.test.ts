import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260725030300_scope_creative_history_materiality.sql",
  "utf8",
);

describe("Campaign Creative History materiality contract", () => {
  it("deduplicates only the selected destination and scope material", () => {
    expect(migration).toContain(
      "WHEN p_scope = 'global' THEN p_settings_snapshot -> 'global'",
    );
    expect(migration).toContain("ELSE effective_settings");
    expect(migration).toContain("'material_settings', material_settings");
    expect(migration).not.toContain(
      "'settings_snapshot', p_settings_snapshot",
    );
  });

  it("treats Mailer format changes as print-affecting", () => {
    expect(migration).toContain("previous_mailer_format");
    expect(migration).toContain("next_mailer_format");
    expect(migration).toContain(
      "previous_mailer_format IS DISTINCT FROM next_mailer_format",
    );
  });

  it("binds production only to a matching Mailer treatment and format", () => {
    expect(migration).toContain(
      "version.settings_snapshot #>> ARRAY['formats', 'mailer']",
    );
    expect(migration).toContain(
      "'creative_workshop',\n          'formats',\n          'mailer'",
    );
    expect(migration).toContain(
      "version.affects_print IS TRUE",
    );
  });
});
