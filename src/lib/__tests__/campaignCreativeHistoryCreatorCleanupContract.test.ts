import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260725031000_allow_creative_history_creator_fk_cleanup.sql",
  "utf8",
);

describe("Campaign Creative History creator cleanup contract", () => {
  it("allows only the Auth foreign-key creator cleanup to update immutable history", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.reject_campaign_creative_version_update()",
    );
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = pg_catalog, public");
    expect(migration).toContain("OLD.created_by IS NOT NULL");
    expect(migration).toContain("NEW.created_by IS NULL");
    expect(migration).toContain("(to_jsonb(NEW) - 'created_by')");
    expect(migration).toContain(
      "IS NOT DISTINCT FROM (to_jsonb(OLD) - 'created_by')",
    );
    expect(migration).toContain("FROM auth.users AS creator");
    expect(migration).toContain("WHERE creator.id = OLD.created_by");
    expect(migration).toContain("RETURN NEW;");
    expect(migration).toContain(
      "RAISE EXCEPTION 'Creative History versions are immutable.'",
    );
  });

  it("locks down the trigger function boundary", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.reject_campaign_creative_version_update()",
    );
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
  });
});
