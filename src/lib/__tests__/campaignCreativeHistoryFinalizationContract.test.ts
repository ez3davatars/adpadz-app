import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260725030400_finalize_campaign_creative_history.sql",
  "utf8",
);
const scopedInvalidationMigration = readFileSync(
  "supabase/migrations/20260725030700_scope_creative_print_invalidation.sql",
  "utf8",
);
const client = readFileSync("src/lib/campaignCreativeHistory.ts", "utf8");

describe("Campaign Creative History finalization contract", () => {
  it("protects canonical creative metadata behind owner-only transaction boundaries", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.enforce_campaign_output_creative_boundary()",
    );
    expect(migration).toContain(
      "current_setting(\n    'adpadz.creative_write_authorized'",
    );
    expect(migration).toContain(
      "current_user::text IS DISTINCT FROM output_table_owner",
    );
    expect(migration).toContain(
      "BEFORE INSERT OR UPDATE OR DELETE ON public.campaign_outputs",
    );
    expect(migration).toContain(
      "ALTER FUNCTION public.save_campaign_bundle(jsonb, jsonb, uuid)\n  RENAME TO save_campaign_bundle_internal",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.save_campaign_bundle_internal",
    );
  });

  it("sanitizes bundle metadata while preserving canonical and initial template settings", () => {
    expect(migration).toContain(
      "incoming_metadata := incoming_metadata\n      - 'creative_workshop'\n      - 'template_settings'",
    );
    expect(migration).toContain(
      "incoming_metadata := incoming_metadata || existing_creative_metadata",
    );
    expect(migration).toContain(
      "'template_settings',\n          incoming_template_settings",
    );
    expect(migration).toContain(
      "'output_type', 'interactive_ad',\n        'enabled', false",
    );
    expect(migration).toContain(
      "'adpadz.creative_write_authorized',\n    'campaign_bundle',\n    true",
    );
  });

  it("normalizes legacy creative into the exact Workshop baseline before classifying changes", () => {
    expect(migration).toContain(
      "SELECT campaign.owner_id, campaign.primary_qr_id",
    );
    expect(migration).toContain('"overlayOpacity": 55');
    expect(migration).toContain('"safeAreaVisible": false');
    expect(migration).toContain(
      "'qrId', campaign_primary_qr_id,\n          'showQr', true",
    );
    expect(migration).toContain(
      "|| (existing_metadata -> 'template_settings')",
    );
  });

  it("validates the complete destination format map and active format exactly", () => {
    expect(migration).toContain(
      "Creative formats must exactly match their destinations.",
    );
    expect(migration).toContain(
      "next_formats ->> 'mailer' NOT IN ('standard', 'combined', 'featured')",
    );
    expect(migration).toContain(
      "next_formats ->> 'social' NOT IN (",
    );
    expect(migration).toContain(
      "p_format_key IS DISTINCT FROM destination_format",
    );
  });

  it("versions every changed global, override, and format projection atomically", () => {
    expect(migration).toContain(
      "global_changed := previous_global IS DISTINCT FROM next_global",
    );
    expect(migration).toContain(
      "FOREACH destination_name IN ARRAY ARRAY[",
    );
    expect(migration).toContain(
      "(previous_overrides ? destination_name)\n        IS DISTINCT FROM (next_overrides ? destination_name)",
    );
    expect(migration).toContain(
      "previous_formats ->> destination_name\n        IS DISTINCT FROM next_formats ->> destination_name",
    );
    expect(migration).toContain(
      "public.save_campaign_creative_projection_internal(",
    );
    expect(migration).toContain(
      "version_created := any_version_created",
    );
  });

  it("derives print and override metadata and enforces print-safe Mailer QR visibility", () => {
    expect(migration).toContain(
      "projection_affects_print := did_affect_print",
    );
    expect(migration).toContain(
      "projection_created_override := NOT (previous_overrides ? destination_name)",
    );
    expect(migration).toContain(
      "AND next_overrides ? destination_name",
    );
    expect(migration).toContain(
      "WHEN projection_affects_print THEN 'mailer'",
    );
    expect(migration).toContain(
      "A selected Mailer QR cannot be hidden.",
    );
    expect(migration).toContain(
      "IF did_affect_print THEN\n    referenced_qr_id",
    );
    expect(migration).toContain("qr.status = 'active'");
    expect(migration).toContain(
      "qr.expires_at IS NULL OR qr.expires_at > now()",
    );
    expect(migration).toContain(
      "A print-affecting save requires a visible, active, unexpired Mailer QR owned by the Campaign owner.",
    );
    expect(migration).toContain(
      "PERFORM p_affects_print, p_created_override",
    );
  });

  it("preserves existing output enablement and production binding equivalence", () => {
    expect(migration).toContain(
      "ON CONFLICT (campaign_id, output_type) DO UPDATE\n  SET metadata = EXCLUDED.metadata",
    );
    expect(migration).not.toContain(
      "SET enabled = EXCLUDED.enabled,\n      metadata = EXCLUDED.metadata",
    );
    expect(migration).toContain(
      "(NEW.creative_version_id IS NULL OR version.id = NEW.creative_version_id)",
    );
    expect(migration).toContain(
      "Production creative version must match the Campaign Mailer treatment and format.",
    );
  });

  it("validates supported templates and tenant-owned creative references", () => {
    expect(migration).toContain(
      "Creative snapshot contains an unsupported template.",
    );
    expect(migration).toContain(
      "settings_entry.destination <> 'mailer'",
    );
    expect(migration).toContain(
      "settings_entry.settings ->> 'template'",
    );
    expect(migration).toContain("qr.owner_user_id = auth.uid()");
    expect(migration).toContain("asset.owner_id = auth.uid()");
    expect(migration).toContain(
      "IF NOT (next_overrides ? 'mailer') THEN",
    );
    expect(migration).toContain(
      "to_jsonb('hero-visual'::text)",
    );
    expect(migration).toContain(
      "'creative_workshop', canonical_snapshot",
    );
  });

  it("advances Mailer production revisions and binds equivalent baselines", () => {
    expect(migration).toContain(
      "UPDATE public.community_cards AS card",
    );
    expect(migration).toContain("slot.campaign_id = p_campaign_id");
    expect(migration).toContain(
      "(version.destination = 'mailer') DESC,\n    version.created_at DESC",
    );
    expect(migration).not.toContain(
      "AND version.affects_print IS TRUE",
    );
  });

  it("invalidates only mutable pre-print Mailers and preserves terminal history", () => {
    expect(scopedInvalidationMigration).toContain(
      "community_cards_00_scope_creative_print_invalidation",
    );
    expect(scopedInvalidationMigration).toContain(
      "BEFORE UPDATE OF layout_revision ON public.community_cards",
    );
    for (const status of [
      "draft",
      "selling",
      "building",
      "review",
      "ready_for_print",
      "proof",
      "approved",
    ]) {
      expect(scopedInvalidationMigration).toContain(`'${status}'`);
    }
    expect(scopedInvalidationMigration).toContain(
      "IF OLD.status NOT IN (",
    );
    expect(scopedInvalidationMigration).toContain("RETURN NULL;");
    for (const status of ["printed", "mailed", "published", "archived"]) {
      expect(scopedInvalidationMigration).toContain(status);
    }
  });

  it("uses compound timeline cursors and models deleted creators as nullable", () => {
    expect(migration).toContain("p_before_id uuid DEFAULT NULL");
    expect(migration).toContain("version.created_at = p_before");
    expect(migration).toContain("version.id < p_before_id");
    expect(client).toContain("created_by: string | null");
    expect(client).toContain("beforeId?: string | null");
    expect(client).toContain('.order("id", { ascending: false })');
    expect(client).toContain("id.lt.${options.beforeId}");
  });
});
