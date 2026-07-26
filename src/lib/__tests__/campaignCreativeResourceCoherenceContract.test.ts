import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL(
  "../../../supabase/migrations/20260725031200_enforce_campaign_creative_resource_coherence.sql",
  import.meta.url,
), "utf8");
const workshop = readFileSync(new URL(
  "../../pages/business/CampaignCreativeWorkshopAdvanced.tsx",
  import.meta.url,
), "utf8");
const inspector = readFileSync(new URL(
  "../../components/campaign-creative/CreativeInspector.tsx",
  import.meta.url,
), "utf8");
const state = readFileSync(new URL(
  "../../features/campaign-templates/creativeWorkshopState.ts",
  import.meta.url,
), "utf8");

describe("Campaign Creative resource-coherence contract", () => {
  it("enforces canonical resource checks behind the protected save boundary", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.enforce_campaign_creative_resource_coherence()",
    );
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = pg_catalog, public");
    expect(migration).toContain(
      "current_setting(\n    'adpadz.creative_write_authorized'",
    );
    expect(migration).toContain(
      "write_boundary IS DISTINCT FROM 'creative_workshop'",
    );
    expect(migration).toContain(
      "BEFORE INSERT OR UPDATE OF metadata ON public.campaign_outputs",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.enforce_campaign_creative_resource_coherence()",
    );
  });

  it("requires active Campaign-business Asset Library references for every settings object", () => {
    expect(migration).toContain(
      "SELECT 'global'::text AS destination, global_settings AS settings",
    );
    expect(migration).toContain("FROM jsonb_each(overrides)");
    expect(migration).toContain("asset.owner_id = campaign_owner_id");
    expect(migration).toContain(
      "asset.business_id = campaign_business_id",
    );
    expect(migration).toContain("asset.is_active IS TRUE");
  });

  it("keeps digital QR choices broad while requiring every reference to remain usable", () => {
    const genericQrValidation = migration.slice(
      migration.indexOf("IF settings_entry.settings ? 'qrId'"),
      migration.indexOf("END LOOP;"),
    );
    expect(genericQrValidation).toContain(
      "qr.owner_user_id = campaign_owner_id",
    );
    expect(genericQrValidation).toContain("qr.status = 'active'");
    expect(genericQrValidation).toContain(
      "qr.expires_at IS NULL OR qr.expires_at > now()",
    );
    expect(genericQrValidation).not.toContain("qr.business_id");
    expect(genericQrValidation).not.toContain("qr.destination_type");
    expect(genericQrValidation).not.toContain("qr.destination_id");
  });

  it("revalidates explicit saves but applies strict Mailer binding only when Mailer changes", () => {
    expect(migration).toContain(
      "OLD.metadata -> 'creative_workshop'\n       IS NOT DISTINCT FROM NEW.metadata -> 'creative_workshop'\n     AND write_boundary IS DISTINCT FROM 'creative_workshop'",
    );
    expect(migration).toContain(
      "TG_OP = 'INSERT'\n       OR old_effective_mailer_settings\n         IS DISTINCT FROM effective_mailer_settings",
    );
    expect(migration).toContain("qr.business_id = campaign_business_id");
    expect(migration).toContain("qr.destination_type = 'campaign'");
    expect(migration).toContain("qr.destination_id = NEW.campaign_id");
    expect(migration).toContain("<= 1048576");
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.adpadz_qr_contrast_ratio(",
    );
    expect(migration).toContain(
      "COALESCE(public.adpadz_qr_contrast_ratio(",
    );
    expect(migration).toContain(") >= 4.5");
  });

  it("aligns Workshop loading, Mailer save checks, and destination-aware pickers", () => {
    expect(workshop).toContain(
      '.eq("business_id", campaign.business_id)',
    );
    expect(workshop).toContain(
      '.eq("id", campaign.business_id)',
    );
    expect(workshop).toContain(
      "pickerAssets: listActiveCreativeAssetOptions(assets)",
    );
    expect(workshop).toContain('.eq("status", "active")');
    expect(workshop).toContain(
      ".or(`expires_at.is.null,expires_at.gt.${activeQrExpiry}`)",
    );
    expect(workshop).toContain(
      "isCreativeQrUsableForCampaign(mailerQr",
    );
    expect(workshop).toContain(
      "Mailer QR contrast must be at least ${MIN_PRODUCTION_QR_CONTRAST_RATIO}:1",
    );
    expect(inspector).toContain(
      'requiredForPrint ? "Unknown · Fails print" : "Unknown"',
    );
    expect(inspector).toContain(
      "requiredForPrint\n      ? isCreativeQrUsableForCampaign(qr, campaignQrContext)\n      : isCreativeQrUsable(qr, campaignOwnerId)",
    );
    expect(inspector).toContain(
      "const availableQrs = qrs.filter(isUsableForDestination)",
    );
    expect(state).toContain(
      'qr.destination_type === "campaign"',
    );
    expect(state).toContain(
      "getQrEmbeddedArtworkBytes(qr) <= MAX_QR_EMBEDDED_ARTWORK_BYTES",
    );
  });
});
