import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const engine = readFileSync(
  "supabase/migrations/20260718030000_add_community_mailer_production_engine.sql",
  "utf8",
);
const confirmations = readFileSync(
  "supabase/migrations/20260718031000_add_community_mailer_preflight_confirmations.sql",
  "utf8",
);

const hardening = readFileSync(
  "supabase/migrations/20260718032000_harden_community_mailer_production_contract.sql",
  "utf8",
);

const statusGuard = readFileSync(
  "supabase/migrations/20260718033000_guard_community_mailer_status_mutations.sql",
  "utf8",
);

describe("Community Mailer migration/frontend contract", () => {
  it("keeps protected production tables behind admin RPCs", () => {
    expect(engine).toContain(
      "ALTER TABLE public.community_mailer_preflight_runs ENABLE ROW LEVEL SECURITY",
    );
    expect(engine).toContain(
      "REVOKE ALL ON TABLE public.community_mailer_preflight_runs",
    );
    expect(engine).toContain(
      "public.can_manage_community_mailers(auth.uid())",
    );
    expect(engine).toContain("SET search_path = pg_catalog, public");
  });

  it("matches frontend RPC names and parameters", () => {
    expect(engine).toContain(
      "public.record_admin_community_mailer_preflight(",
    );
    expect(engine).toContain("p_fingerprint text");
    expect(engine).toContain("p_blocking_count integer");
    expect(engine).toContain(
      "public.transition_admin_community_mailer_production(",
    );
    expect(confirmations).toContain(
      "public.confirm_admin_community_mailer_preflight(",
    );
    expect(confirmations).toContain("p_confirmation text");
    expect(confirmations).toContain("p_confirmed boolean");
    expect(hardening).toContain("public.record_admin_community_mailer_export(");
    expect(hardening).toContain("A current production candidate export is required.");
    expect(hardening).toContain("postal_area_confirmation_revision");
    expect(statusGuard).toContain("community_cards_guard_status_mutation");
    expect(statusGuard).toContain("production transition API");
  });
});
