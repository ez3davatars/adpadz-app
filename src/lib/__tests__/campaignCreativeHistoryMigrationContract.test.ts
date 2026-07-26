import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260725030000_add_campaign_creative_history.sql",
  "utf8",
);

describe("Campaign Creative History migration contract", () => {
  it("stores immutable, deduplicated Campaign-owned settings snapshots", () => {
    expect(migration).toContain(
      "CREATE TABLE public.campaign_creative_versions",
    );
    expect(migration).toContain(
      "UNIQUE (campaign_id, destination, settings_fingerprint)",
    );
    expect(migration).toContain(
      "ALTER TABLE public.campaign_creative_versions ENABLE ROW LEVEL SECURITY",
    );
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.campaign_creative_versions",
    );
    expect(migration).toContain(
      "GRANT SELECT ON TABLE public.campaign_creative_versions TO authenticated",
    );
    expect(migration).not.toMatch(
      /GRANT\s+(?:INSERT|UPDATE|DELETE)[^;]*campaign_creative_versions/i,
    );
  });

  it("limits customer reads to Campaign ownership and denies cross-tenant writes", () => {
    expect(migration).toContain(
      "CREATE POLICY campaign_creative_versions_owner_select",
    );
    expect(migration).toContain(
      "campaign.owner_id = auth.uid()",
    );
    expect(migration).toContain(
      "campaign_owner_id IS DISTINCT FROM auth.uid()",
    );
    expect(migration).toContain(
      "RAISE EXCEPTION 'Campaign owner access required.'",
    );
  });

  it("persists current output and history in one transactional owner RPC", () => {
    expect(migration).toContain(
      "public.save_campaign_creative_version(",
    );
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain(
      "'creative_workshop', p_settings_snapshot",
    );
    expect(migration).toContain(
      "'template_settings', p_settings_snapshot -> 'global'",
    );
    expect(migration).toContain(
      "ON CONFLICT (campaign_id, output_type) DO UPDATE",
    );
    expect(migration).toContain(
      "ON CONFLICT (\n    campaign_id,\n    destination,\n    settings_fingerprint\n  ) DO NOTHING",
    );
    expect(migration).toContain("version_created := did_insert");
  });

  it("computes the fingerprint and print impact on the server", () => {
    expect(migration).toContain("authoritative_fingerprint := encode(");
    expect(migration).toContain("extensions.digest(");
    expect(migration).toContain(
      "previous_mailer IS DISTINCT FROM next_mailer",
    );
    expect(migration).toContain(
      "SET updated_at = clock_timestamp()",
    );
  });

  it("retains 25 versions per Campaign destination without deleting production evidence", () => {
    expect(migration).toContain("ranked.retention_rank > 25");
    expect(migration).toContain(
      "production_snapshot.creative_version_id = version.id",
    );
    expect(migration).toContain(
      "REFERENCES public.campaign_creative_versions(id) ON DELETE RESTRICT",
    );
    expect(migration).toContain(
      "community_mailer_snapshots_bind_creative_version",
    );
    expect(migration).toContain(
      "'creative_settings_fingerprint', bound_version.settings_fingerprint",
    );
  });

  it("keeps Mission Control access behind existing server authorization", () => {
    expect(migration).toContain(
      "public.get_admin_campaign_creative_versions(",
    );
    expect(migration).toContain(
      "IF NOT public.is_adpadz_admin(auth.uid()) THEN",
    );
    expect(migration).toContain(
      "SET search_path = pg_catalog, public",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.get_admin_campaign_creative_versions(",
    );
    expect(migration).toContain(
      ") TO authenticated;",
    );
  });
});
