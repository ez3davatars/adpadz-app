import { describe, expect, it } from "vitest";
import {
  deterministicCreativeCopyProvider,
} from "../../features/campaign-templates/creativeCopyProvider";
import { createDisplayHeadline } from "../../features/campaign-templates/normalizeCampaignContent";
import type { CampaignRecord } from "../ads";

function campaign(headline: string): CampaignRecord {
  return {
    id: "campaign-headline",
    owner_id: "owner-headline",
    title: headline,
    headline,
    description: null,
    offer_title: null,
    offer_description: null,
    cta_label: null,
    cta_url: null,
    status: "draft",
  };
}

describe("Creative Director headline safety", () => {
  it("caps a single unbroken source token without mutating campaign content", () => {
    const source = "NeighborhoodComfortSolutions".repeat(4);
    const record = campaign(source);
    const display = createDisplayHeadline(record);

    expect(Array.from(display)).toHaveLength(52);
    expect(display.endsWith("\u2026")).toBe(true);
    expect(record.headline).toBe(source);
  });

  it("uses the deterministic local copy provider boundary in Phase 1", () => {
    const result = deterministicCreativeCopyProvider.generate(
      { campaign: campaign("Local Summer Savings") },
    );

    expect(result).toEqual({
      headline: "Local Summer Savings",
      source: "deterministic-local",
    });
  });
});
