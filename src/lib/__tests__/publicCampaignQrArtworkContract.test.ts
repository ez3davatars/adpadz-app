import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL(
  "../../../supabase/migrations/20260725030900_project_public_campaign_qr_artwork.sql",
  import.meta.url,
), "utf8");
const campaigns = readFileSync(new URL("../campaigns.ts", import.meta.url), "utf8");
const feed = readFileSync(new URL("../../pages/consumer/Feed.tsx", import.meta.url), "utf8");
const adView = readFileSync(new URL("../../pages/consumer/AdView.tsx", import.meta.url), "utf8");
const qrStudio = readFileSync(new URL("../../pages/business/QRStudio.tsx", import.meta.url), "utf8");
const projection = migration.match(
  /jsonb_build_object\(([\s\S]*?)\)\s+AS qr_artwork/,
)?.[1] ?? "";
const projectedKeys = Array.from(
  projection.matchAll(/'([a-z_]+)'\s*,/g),
  match => match[1],
);

describe("public Campaign QR artwork security contract", () => {
  it("projects a bounded batch only for effective public Discovery and QR references", () => {
    expect(migration).toContain(
      "public.get_public_campaign_qr_artwork",
    );
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = pg_catalog, public");
    expect(migration).toContain(
      "COALESCE(cardinality(p_campaign_ids), 0) BETWEEN 1 AND 50",
    );
    expect(migration).toContain("campaign.id = ANY(p_campaign_ids)");
    expect(migration).toContain(
      "public.adpadz_campaign_output_is_public",
    );
    expect(migration).toContain(
      "output.metadata #> ARRAY['creative_workshop', 'overrides', 'discovery']",
    );
    expect(migration).toContain(
      "output.metadata #> ARRAY['creative_workshop', 'overrides', 'qr']",
    );
    expect(migration).toContain(
      "public.adpadz_jsonb_uuid(reference.settings, 'qrId')",
    );
    expect(migration).toContain(
      "reference.settings -> 'showQr' = 'true'::jsonb",
    );
    expect(migration).toContain(
      "CONSTRAINT qr_links_embedded_artwork_size_check",
    );
    expect(migration).toContain(
      "octet_length(COALESCE(logo_data_url, ''))",
    );
    expect(migration).toContain("<= 1048576");
    expect(migration).toContain(") NOT VALID");
  });

  it("fails closed for foreign, inactive, expired, unpublished, and unreferenced rows", () => {
    expect(migration).toContain(
      "qr.owner_user_id = campaign.owner_id",
    );
    expect(migration).toContain("qr.status = 'active'");
    expect(migration).toContain(
      "(qr.expires_at IS NULL OR qr.expires_at > now())",
    );
    expect(migration).toContain(
      "octet_length(COALESCE(qr.logo_data_url, ''))",
    );
    expect(migration).toContain(
      "output.output_type = 'interactive_ad'",
    );
    expect(migration).toContain("output.enabled IS TRUE");
    expect(migration).not.toContain("p_qr_ids");
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.get_public_campaign_qr_artwork(uuid[])",
    );
    expect(migration).toContain("TO anon, authenticated");
  });

  it("whitelists visual fields without projecting sensitive QR data", () => {
    expect(projectedKeys).toEqual([
      "slug",
      "style_preset",
      "top_ring_text",
      "bottom_ring_text",
      "center_label",
      "foreground_color",
      "background_color",
      "accent_color",
      "show_center_label",
      "show_short_url",
      "logo_data_url",
      "center_frame_shape",
      "center_frame_stroke_color",
      "center_frame_fill_color",
      "rim_decoration",
      "rim_band_color",
      "rim_text_color",
      "inner_field_color",
      "outer_border_color",
      "outer_background_type",
      "outer_background_color",
      "outer_background_image_data_url",
      "outer_background_image_opacity",
      "outer_background_image_fit",
      "outer_background_overlay_color",
      "rim_band_background_type",
      "rim_band_image_data_url",
      "rim_band_image_opacity",
      "rim_band_image_fit",
      "rim_band_overlay_color",
      "rim_band_overlay_opacity",
      "ornament_style",
      "ornament_main_color",
      "ornament_accent_color",
      "ornament_shadow_color",
      "ornament_opacity",
    ]);
    expect(projection).not.toContain("'id'");
    expect(projection).not.toContain("'title'");
    for (const forbidden of [
      "destination_url",
      "scan_count",
      "owner_user_id",
      "business_id",
      "tags",
      "status",
      "expires_at",
      "updated_at",
    ]) {
      expect(projection).not.toContain(forbidden);
    }
  });

  it("strictly hydrates the projection and supplies exact artwork to both public renderers", () => {
    expect(campaigns).toContain(
      "supabase.rpc('get_public_campaign_qr_artwork'",
    );
    expect(campaigns).toContain("normalizeQRStudioVisualArtwork");
    expect(campaigns).toContain("id: expectedQrId");
    expect(campaigns).toContain("title: 'Campaign QR code'");
    expect(campaigns).not.toContain("if (qrArtworkResult.error) throw");
    expect(feed).toContain(
      "qrArtwork={qrArtwork ? <QRStudioPreview qr={qrArtwork} /> : undefined}",
    );
    expect(adView).toContain(
      "qrArtwork={qrArtwork ? <QRStudioPreview qr={qrArtwork} /> : undefined}",
    );
    expect(feed).toContain("buildShortUrl(qrArtwork.slug)");
    expect(adView).toContain("buildShortUrl(qrArtwork.slug)");
  });

  it("blocks oversized embedded artwork before a QR link write", () => {
    expect(qrStudio).toContain(
      "getQrEmbeddedArtworkBytes(form) > MAX_QR_EMBEDDED_ARTWORK_BYTES",
    );
    expect(qrStudio).toContain(
      "Embedded QR images must total 1 MB or less.",
    );
  });
});
