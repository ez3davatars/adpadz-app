import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL(
  "../../../supabase/migrations/20260725031100_project_public_campaign_creative_assets.sql",
  import.meta.url,
), "utf8");
const campaigns = readFileSync(new URL("../campaigns.ts", import.meta.url), "utf8");
const feed = readFileSync(new URL("../../pages/consumer/Feed.tsx", import.meta.url), "utf8");
const adView = readFileSync(new URL("../../pages/consumer/AdView.tsx", import.meta.url), "utf8");
const projection = migration.match(
  /jsonb_build_object\(([\s\S]*?)\)\s+AS asset/,
)?.[1] ?? "";
const projectedKeys = Array.from(
  projection.matchAll(/'([a-z_]+)'\s*,/g),
  match => match[1],
);

describe("public Campaign creative asset security contract", () => {
  it("projects only effective Discovery and QR overrides for a bounded public batch", () => {
    expect(migration).toContain("public.get_public_campaign_creative_assets");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = pg_catalog, public");
    expect(migration).toContain(
      "COALESCE(cardinality(p_campaign_ids), 0) BETWEEN 1 AND 50",
    );
    expect(migration).toContain("campaign.id = ANY(p_campaign_ids)");
    expect(migration).toContain(
      "public.adpadz_campaign_output_is_public",
    );
    const discoveryOverride = migration.indexOf(
      "output.metadata #> ARRAY['creative_workshop', 'overrides', 'discovery']",
    );
    const discoveryGlobal = migration.indexOf(
      "output.metadata #> ARRAY['creative_workshop', 'global']",
      discoveryOverride,
    );
    const qrOverride = migration.indexOf(
      "output.metadata #> ARRAY['creative_workshop', 'overrides', 'qr']",
      discoveryGlobal,
    );
    const qrGlobal = migration.indexOf(
      "output.metadata #> ARRAY['creative_workshop', 'global']",
      qrOverride,
    );
    expect(discoveryOverride).toBeGreaterThan(-1);
    expect(discoveryGlobal).toBeGreaterThan(discoveryOverride);
    expect(qrOverride).toBeGreaterThan(discoveryGlobal);
    expect(qrGlobal).toBeGreaterThan(qrOverride);
    expect(migration).not.toContain("'mailer'::text");
    expect(migration).not.toContain("'social'::text");
    expect(migration).not.toContain("p_asset_ids");
  });

  it("denies nonpublic and cross-tenant asset projection at the database boundary", () => {
    expect(migration).toContain("output.output_type = 'interactive_ad'");
    expect(migration).toContain("output.enabled IS TRUE");
    expect(migration).toContain("creative_asset.owner_id = campaign.owner_id");
    expect(migration).toContain("creative_asset.business_id = campaign.business_id");
    expect(migration).toContain("campaign.business_id IS NOT NULL");
    expect(migration).toContain("creative_asset.is_active IS TRUE");
    expect(migration).toContain(
      "public.adpadz_jsonb_uuid(\n      reference.settings,\n      'imageAssetId'",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.get_public_campaign_creative_assets(uuid[])",
    );
    expect(migration).toContain("TO anon, authenticated");
  });

  it("whitelists render fields without exposing unrelated asset metadata or IDs", () => {
    expect(projectedKeys).toEqual([
      "title",
      "asset_type",
      "file_url",
      "external_url",
      "thumbnail_url",
    ]);
    for (const forbidden of [
      "'id'",
      "owner_id",
      "business_id",
      "smart_card_id",
      "description",
      "provider",
      "provider_asset_id",
      "file_size_bytes",
      "created_at",
      "updated_at",
    ]) {
      expect(projection).not.toContain(forbidden);
    }
  });

  it("hydrates the narrow projection and never substitutes a primary image for an explicit saved image", () => {
    expect(campaigns).toContain(
      "supabase.rpc('get_public_campaign_creative_assets'",
    );
    expect(campaigns).toContain("indexPublicCampaignCreativeAssets");
    expect(campaigns).toContain("PUBLIC_CREATIVE_DESTINATIONS");
    expect(campaigns).toContain("'discovery',\n  'qr'");
    expect(campaigns).not.toContain("if (creativeAssetsResult.error) throw");
    expect(feed).toContain(
      "fallbackImageUrl: savedCreative.imageAssetId ? null : image",
    );
    expect(adView).toContain(
      "fallbackImageUrl: savedCreative?.imageAssetId ? null : image",
    );
  });
});
