import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const originalMigration = readFileSync(
  "supabase/migrations/20260725030000_add_campaign_creative_history.sql",
  "utf8",
);
const finalizationMigration = readFileSync(
  "supabase/migrations/20260725030400_finalize_campaign_creative_history.sql",
  "utf8",
);
const productionSnapshotMigration = readFileSync(
  "supabase/migrations/20260725030500_snapshot_effective_mailer_creative.sql",
  "utf8",
);
const correctionMigration = readFileSync(
  "supabase/migrations/20260725030600_dedupe_creative_history_against_latest.sql",
  "utf8",
);

describe("Campaign Creative History latest-entry deduplication contract", () => {
  it("removes global material uniqueness and compares only the latest destination entry", () => {
    expect(originalMigration).toContain(
      "CONSTRAINT campaign_creative_versions_material_version_unique",
    );
    expect(correctionMigration).toContain(
      "DROP CONSTRAINT IF EXISTS\n    campaign_creative_versions_material_version_unique",
    );
    expect(correctionMigration).toContain(
      "WHERE version.campaign_id = p_campaign_id\n    AND version.destination = p_destination",
    );
    expect(correctionMigration).toContain(
      "ORDER BY version.created_at DESC, version.id DESC\n  LIMIT 1",
    );
    expect(correctionMigration).toContain(
      "latest_fingerprint IS NOT DISTINCT FROM authoritative_fingerprint",
    );
  });

  it("returns the latest row for an adjacent duplicate but appends a restored state", () => {
    const duplicateCheck = correctionMigration.indexOf(
      "IF latest_id IS NOT NULL",
    );
    const insert = correctionMigration.indexOf(
      "INSERT INTO public.campaign_creative_versions",
    );

    expect(duplicateCheck).toBeGreaterThan(-1);
    expect(insert).toBeGreaterThan(duplicateCheck);
    expect(correctionMigration).toContain("projection_created := false");
    expect(correctionMigration).toContain("projection_created := true");
    expect(correctionMigration).not.toContain("ON CONFLICT");
  });

  it("keeps legitimate writes serialized and the helper private", () => {
    expect(finalizationMigration).toContain(
      "FROM public.campaigns AS campaign\n  WHERE campaign.id = p_campaign_id\n  FOR NO KEY UPDATE",
    );
    expect(correctionMigration).toContain("SECURITY INVOKER");
    expect(correctionMigration).toContain(
      "REVOKE ALL ON FUNCTION public.save_campaign_creative_projection_internal(",
    );
    expect(correctionMigration).toContain(
      ") FROM PUBLIC, anon, authenticated",
    );
  });

  it("retains the newest 25 per destination without deleting production-pinned history", () => {
    expect(finalizationMigration).toContain(
      "PARTITION BY version.destination\n        ORDER BY version.created_at DESC, version.id DESC",
    );
    expect(finalizationMigration).toContain(
      "ranked.retention_rank > 25",
    );
    expect(finalizationMigration).toContain(
      "production_snapshot.creative_version_id = version.id",
    );
    expect(originalMigration).toContain(
      "REFERENCES public.campaign_creative_versions(id) ON DELETE RESTRICT",
    );
    expect(correctionMigration).not.toContain(
      "DELETE FROM public.campaign_creative_versions",
    );
  });

  it("binds a new production snapshot to the newest exactly equivalent restored entry", () => {
    expect(productionSnapshotMigration).toContain(
      "(version.destination = 'mailer') DESC,\n    version.created_at DESC,\n    version.id DESC",
    );
    expect(productionSnapshotMigration).toContain(
      "'creative_version_id', bound_version.id",
    );
  });
  it("resolves an unchanged save against the requested destination baseline", () => {
    expect(correctionMigration).toContain(
      ") RENAME TO save_campaign_creative_version_internal",
    );
    expect(correctionMigration).toContain(
      "IF version_created IS NOT TRUE THEN",
    );
    expect(correctionMigration).toContain(
      "WHERE version.campaign_id = p_campaign_id\n      AND version.destination = p_destination",
    );
    expect(correctionMigration).toContain(
      "IF version_id IS NULL THEN",
    );
    expect(correctionMigration).toContain(
      "FROM public.save_campaign_creative_projection_internal(",
    );
    expect(correctionMigration).toContain(
      "ARRAY['Initial creative version']",
    );
    expect(correctionMigration).toContain(
      ") TO authenticated;",
    );
  });
});
