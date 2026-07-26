import { describe, expect, it } from "vitest";
import {
  indexPublicCampaignCreativeAssets,
  type PublicCampaignAsset,
} from "../campaigns";

const discoveryAsset = {
  title: "Discovery hero",
  asset_type: "image",
  file_url: "https://cdn.example/discovery.jpg",
  external_url: null,
  thumbnail_url: "https://cdn.example/discovery-thumb.jpg",
};

const qrAsset = {
  title: "QR hero",
  asset_type: "cover",
  file_url: "https://cdn.example/qr.jpg",
  external_url: null,
  thumbnail_url: null,
};

describe("public Campaign creative asset hydration", () => {
  it("indexes only exact expected Discovery and QR assets and strips unprojected data", () => {
    const expected = new Map([
      ["campaign-public", {
        discovery: "asset-discovery",
        qr: "asset-qr",
      }],
    ]);
    const indexed = indexPublicCampaignCreativeAssets([
      {
        campaign_id: "campaign-public",
        destination: "discovery",
        asset: {
          ...discoveryAsset,
          id: "asset-private-id",
          owner_id: "owner-private",
          business_id: "business-private",
          description: "not public",
        },
      },
      {
        campaign_id: "campaign-public",
        destination: "qr",
        asset: qrAsset,
      },
      {
        campaign_id: "campaign-public",
        destination: "mailer",
        asset: discoveryAsset,
      },
      {
        campaign_id: "campaign-unpublished",
        destination: "discovery",
        asset: discoveryAsset,
      },
      {
        campaign_id: "campaign-public",
        destination: "discovery",
        asset: { ...discoveryAsset, file_url: "javascript:alert(1)" },
      },
    ], expected);

    expect(indexed.size).toBe(1);
    expect(indexed.has("campaign-unpublished")).toBe(false);
    expect(indexed.get("campaign-public")?.discovery).toEqual({
      id: "asset-discovery",
      ...discoveryAsset,
    } satisfies PublicCampaignAsset);
    expect(indexed.get("campaign-public")?.qr).toEqual({
      id: "asset-qr",
      ...qrAsset,
    } satisfies PublicCampaignAsset);
    expect(indexed.get("campaign-public")?.discovery)
      .not.toHaveProperty("owner_id");
    expect(indexed.get("campaign-public")?.discovery)
      .not.toHaveProperty("business_id");
    expect(indexed.get("campaign-public")?.discovery)
      .not.toHaveProperty("description");
  });

  it("fails closed when the optional projection is unavailable or malformed", () => {
    const expected = new Map([
      ["campaign-public", { discovery: "asset-discovery" }],
    ]);

    expect(indexPublicCampaignCreativeAssets([], expected)).toEqual(new Map());
    expect(indexPublicCampaignCreativeAssets([
      {
        campaign_id: "campaign-public",
        destination: "discovery",
        asset: { ...discoveryAsset, title: "" },
      },
    ], expected)).toEqual(new Map());
  });
});
