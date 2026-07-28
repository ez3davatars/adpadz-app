import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { CampaignOutputRecord, CampaignRecord } from "../../lib/ads";
import type { CampaignReadinessResult } from "../../lib/campaignReadiness";
import { loadBusinessCampaignReadiness } from "../../lib/campaignReadinessData";
import {
  campaignStageFromPath,
  deriveCampaignStageStates,
  resolveCampaignStageAction,
} from "../../lib/campaignStages";
import { CampaignStageNavigation } from "./CampaignStageNavigation";
import { supabase } from "../../lib/supabase";
import { AdpadzBadge, AdpadzButton, AdpadzCard } from "../adpadz-ui";
import { CampaignReadinessBadge } from "../campaign-readiness/CampaignReadinessSummary";

import type { CampaignShellContext } from "./campaignShellContext";

/**
 * The one Campaign shell. It persists across Setup, Studio, Review, and
 * Publish, owns the campaign title and workflow navigation, and shares the
 * loaded campaign + readiness with every stage through Outlet context so
 * stages never refetch what the shell already knows.
 */

type ShellData = {
  campaign: CampaignRecord;
  outputs: CampaignOutputRecord[];
  readiness: CampaignReadinessResult | null;
};

export default function CampaignShell() {
  const { campaignId = "" } = useParams();
  const location = useLocation();
  const [data, setData] = useState<ShellData | null>(null);
  const [error, setError] = useState("");
  const requestRef = useRef(0);
  const stage = campaignStageFromPath(location.pathname);

  const load = useCallback(async (options: { silent?: boolean } = {}) => {
    const requestId = ++requestRef.current;
    if (!options.silent) setError("");
    try {
      const auth = await supabase.auth.getUser();
      if (auth.error) throw new Error(auth.error.message);
      if (!auth.data.user) throw new Error("Sign in to open this campaign.");
      const userId = auth.data.user.id;
      const campaignResult = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .eq("owner_id", userId)
        .maybeSingle();
      if (campaignResult.error) throw new Error(campaignResult.error.message);
      if (!campaignResult.data) throw new Error("Campaign not found.");
      const campaign = campaignResult.data as CampaignRecord;
      const outputsResult = await supabase
        .from("campaign_outputs")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("sort_order", { ascending: true });
      if (outputsResult.error) throw new Error(outputsResult.error.message);
      const outputs = (outputsResult.data ?? []) as CampaignOutputRecord[];
      const readinessMap = await loadBusinessCampaignReadiness(userId, [campaign], outputs);
      if (requestId !== requestRef.current) return;
      setData({ campaign, outputs, readiness: readinessMap.get(campaign.id) ?? null });
    } catch (reason) {
      if (requestId !== requestRef.current) return;
      setError(reason instanceof Error ? reason.message : "Could not load the campaign.");
    }
  }, [campaignId]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const refreshShell = useCallback(() => {
    void load({ silent: true });
  }, [load]);

  const stageStates = useMemo(
    () => data ? deriveCampaignStageStates(data.campaign, data.readiness) : null,
    [data],
  );
  const nextAction = useMemo(
    () => data ? resolveCampaignStageAction(data.campaign, data.readiness) : null,
    [data],
  );
  const context: CampaignShellContext | null = useMemo(
    () => data ? { ...data, stage, refreshShell } : null,
    [data, refreshShell, stage],
  );

  if (error) {
    return (
      <AdpadzCard variant="flat" role="alert" className="border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100">
        {error} <Link to="/app/business/campaigns" className="font-bold underline">Back to Campaigns</Link>
      </AdpadzCard>
    );
  }

  // The stage content renders immediately: stages own their richer data loads
  // and must not wait on the shell header (no request waterfall).
  const showNextAction = data && nextAction && nextAction.stage !== stage;
  const fallbackStates = deriveCampaignStageStates({ status: "draft" }, null);

  return (
    <div className="min-w-0 max-w-full">
      <header className="border-b border-white/[0.06] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <AdpadzButton href="/app/business/campaigns" variant="icon" size="sm" aria-label="Back to Campaigns">
              <ArrowLeft className="h-4 w-4" />
            </AdpadzButton>
            <div className="min-w-0">
              {data ? (
                <h1 className="truncate text-xl font-bold sm:text-2xl">{data.campaign.title || "Untitled campaign"}</h1>
              ) : (
                <h1 className="flex items-center gap-2 text-xl font-bold text-[var(--text-muted)] sm:text-2xl">
                  <Loader2 className="h-4 w-4 animate-spin text-neon" aria-hidden="true" />
                  <span className="sr-only">Loading campaign</span>
                  <span aria-hidden="true" className="inline-block h-4 w-40 animate-pulse rounded bg-white/[0.07]" />
                </h1>
              )}
              <div className="mt-1 flex min-h-6 flex-wrap items-center gap-2">
                {data && (
                  <>
                    <AdpadzBadge variant="status" className="capitalize">{data.campaign.status}</AdpadzBadge>
                    {data.readiness && (
                      <>
                        <CampaignReadinessBadge result={data.readiness} />
                        <span className="text-xs font-semibold text-[var(--text-muted)]">{data.readiness.completionPercent}% complete</span>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          {showNextAction && (
            <AdpadzButton href={nextAction.href} size="sm" title={nextAction.reason}>
              {nextAction.label}
            </AdpadzButton>
          )}
        </div>
        <CampaignStageNavigation campaignId={campaignId} stage={stage} stageStates={stageStates ?? fallbackStates} />
      </header>
      <div className="pt-5">
        <Outlet context={context} />
      </div>
    </div>
  );
}
