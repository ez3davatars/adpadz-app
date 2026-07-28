import { useOutletContext } from "react-router-dom";
import type { CampaignOutputRecord, CampaignRecord } from "../../lib/ads";
import type { CampaignReadinessResult } from "../../lib/campaignReadiness";
import type { CampaignStageKey } from "../../lib/campaignStages";

/**
 * Shared context the Campaign shell provides to every stage (Setup, Studio,
 * Review, Publish) through the router Outlet, so stages reuse the campaign
 * and readiness the shell already loaded instead of refetching them.
 */
export type CampaignShellContext = {
  campaign: CampaignRecord;
  outputs: CampaignOutputRecord[];
  readiness: CampaignReadinessResult | null;
  stage: CampaignStageKey | null;
  /** Stages call this after saving so the shell header reflects reality. */
  refreshShell: () => void;
};

export function useCampaignShell(): CampaignShellContext | null {
  return useOutletContext<CampaignShellContext | null>() ?? null;
}
