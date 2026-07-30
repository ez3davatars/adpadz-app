import type { CampaignRecord } from "../../lib/ads";
import { createDisplayHeadline } from "./normalizeCampaignContent";

export type CreativeCopyRequest = {
  campaign: CampaignRecord;
};

export type CreativeCopyResult = {
  headline: string;
  source: "deterministic-local";
};

/**
 * Boundary for future assisted copy providers. Phase 1 deliberately uses the
 * local implementation below and performs no provider or model request.
 */
export interface CreativeCopyProvider {
  generate(request: CreativeCopyRequest): CreativeCopyResult;
}

export const deterministicCreativeCopyProvider: CreativeCopyProvider =
  Object.freeze<CreativeCopyProvider>({
    generate: (
      { campaign }: CreativeCopyRequest,
    ): CreativeCopyResult => ({
      headline: createDisplayHeadline(campaign),
      source: "deterministic-local",
    }),
  });
