import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Community Mailer exact creative Candidate architecture", () => {
  it("rasterizes the canonical renderer and never rebuilds a basic QR", () => {
    const browser = readFileSync(
      "src/lib/communityMailerCandidateBrowser.ts",
      "utf8",
    );
    const candidate = readFileSync(
      "src/lib/communityMailerCandidate.ts",
      "utf8",
    );
    expect(browser).toContain("CampaignTemplateRenderer");
    expect(browser).toContain("QRStudioPreview");
    expect(browser).toContain("rasterizeCreativeElement");
    expect(browser).toContain("assertVisibleCreativeRaster");
    expect(browser).not.toContain('from "qrcode"');
    expect(candidate).not.toContain('from "qrcode"');
    expect(candidate).toContain("renderedCreativeChecksum");
    expect(candidate).toContain("qrArtworkFingerprint");
    expect(candidate).toContain("creativeRenderContractVersion: 1");
  });

  it("binds exact asset and QR records into the immutable snapshot fingerprint", () => {
    const migration = readFileSync(
      "supabase/migrations/20260725030800_snapshot_exact_mailer_render_inputs.sql",
      "utf8",
    );
    expect(migration).toContain("'creative_render_contract_version', 1");
    expect(migration).toContain("'creative_asset'");
    expect(migration).toContain("'qr_studio_artwork'");
    expect(migration).toContain("'ornament_style', render_qr.ornament_style");
    expect(migration).toContain(
      "octet_length(COALESCE(render_qr.logo_data_url, ''))",
    );
    expect(migration).toContain("<= 1048576");
    expect(migration).toContain("'render_snapshot', row.render_snapshot");
    expect(migration).toContain(
      "IS DISTINCT FROM slot.qr_link_id::text",
    );
    expect(migration).toContain(
      "IS DISTINCT FROM assigned_qr.destination_url",
    );
    expect(migration).toContain(
      "public.can_manage_community_mailers(auth.uid())",
    );
  });
});
