import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const assignment = readFileSync(
  "supabase/migrations/20260718034000_add_mailer_campaign_candidate_storage.sql",
  "utf8",
);
const finalization = readFileSync(
  "supabase/migrations/20260725010000_require_candidate_placement_csv.sql",
  "utf8",
);
const candidateSecurity = readFileSync(
  "supabase/migrations/20260718035000_finalize_mailer_candidate_contract.sql",
  "utf8",
);
const businessProjection = readFileSync(
  "supabase/migrations/20260718036000_add_business_mailer_assignment_projection.sql",
  "utf8",
);
const adminPanel = readFileSync(
  "src/components/community-mailer/CommunityMailerCandidatePanel.tsx",
  "utf8",
);
const businessPage = readFileSync(
  "src/pages/business/CommunityCampaigns.tsx",
  "utf8",
);

describe("Community Mailer candidate architecture", () => {
  it("adds one canonical Campaign assignment to the existing placement", () => {
    expect(assignment).toContain("ALTER TABLE public.community_card_slots");
    expect(assignment).toContain("campaign_id uuid");
    expect(assignment).toContain("campaign_assignment_override_reason");
    expect(assignment).toContain("Campaign must belong to the placement business");
    expect(assignment).toContain("Unlock the production revision");
  });

  it("stores minimal revision-bound production snapshots and QR associations", () => {
    expect(assignment).toContain("community_mailer_production_snapshots");
    expect(assignment).toContain("UNIQUE (placement_id, layout_revision)");
    expect(assignment).toContain("community_mailer_qr_associations");
    expect(assignment).toContain("qr.destination_type = 'campaign'");
    expect(assignment).toContain("qr.destination_id = campaign.id");
  });

  it("keeps candidate objects private and requires every stored artifact", () => {
    expect(assignment).toContain(
      "VALUES ('community-mailer-production', 'community-mailer-production', false)",
    );
    expect(assignment).toContain("public.can_manage_community_mailers(auth.uid())");
    expect(finalization).toContain("required_count <> 10");
    expect(finalization).toContain("storage.objects");
    expect(finalization).toContain("production_candidate");
    expect(finalization).toContain("placement-manifest.csv");
    expect(finalization).not.toContain("placement-manifest.json");
    expect(candidateSecurity).toContain(
      "REVOKE ALL ON FUNCTION public.record_admin_community_mailer_export",
    );
  });

  it("keeps production downloads out of the business projection", () => {
    expect(businessProjection).toContain(
      "get_business_community_mailer_assignments",
    );
    expect(businessProjection).not.toContain("storage_prefix");
    expect(businessProjection).not.toContain("checksum");
    expect(businessPage).toContain("Assigned Campaign:");
    expect(businessPage).not.toContain("Printer certified");
  });

  it("exposes candidate generation, stale state, history, and certification in Mission Control", () => {
    expect(adminPanel).toContain("Generate Production Candidate");
    expect(adminPanel).toContain("Historical candidate exists for an older revision");
    expect(adminPanel).toContain("Export history");
    expect(adminPanel).toContain("Printer certified");
  });
});
