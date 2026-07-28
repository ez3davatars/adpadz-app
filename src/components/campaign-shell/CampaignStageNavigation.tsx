import { NavLink } from "react-router-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import {
  CAMPAIGN_STAGES,
  campaignStagePath,
  type CampaignStageKey,
  type CampaignStageState,
} from "../../lib/campaignStages";

/**
 * The restrained Campaign workflow navigator: Setup · Studio · Review · Publish.
 * Current stage is unmistakable, completed stages are marked, and blocked or
 * attention-needing stages explain themselves to assistive technology.
 */
export function CampaignStageNavigation({
  campaignId,
  stage,
  stageStates,
}: {
  campaignId: string;
  stage: CampaignStageKey | null;
  stageStates: Record<CampaignStageKey, CampaignStageState>;
}) {
  return (
    <nav aria-label="Campaign workflow" className="mt-4">
      <ol className="flex gap-1 overflow-x-auto sm:gap-2">
        {CAMPAIGN_STAGES.map((definition, index) => {
          const state = stageStates[definition.key];
          const current = stage === definition.key;
          const explains = state.status === "blocked" || (state.status === "attention" && Boolean(state.detail));
          return (
            <li key={definition.key} className="flex shrink-0 items-center gap-1 sm:gap-2">
              {index > 0 && <span aria-hidden="true" className="text-[var(--text-muted)]/40">·</span>}
              <NavLink
                to={campaignStagePath(campaignId, definition.key)}
                aria-current={current ? "step" : undefined}
                title={state.detail ?? definition.description}
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold transition sm:px-4 ${
                  current
                    ? "bg-neon/[0.12] text-neon"
                    : "text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                <StageStateMark state={state} current={current} />
                {definition.label}
                {explains && (
                  <span className="sr-only">
                    {state.status === "blocked" ? " (blocked: " : " (needs attention: "}
                    {state.detail}
                    {")"}
                  </span>
                )}
              </NavLink>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StageStateMark({ state, current }: { state: CampaignStageState; current: boolean }) {
  if (state.status === "complete") {
    return <CheckCircle2 className={`h-3.5 w-3.5 ${current ? "text-neon" : "text-neon/70"}`} aria-hidden="true" />;
  }
  if (state.status === "blocked" || state.status === "attention") {
    return <AlertCircle className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />;
  }
  return <span className={`h-1.5 w-1.5 rounded-full ${current ? "bg-neon" : "bg-white/25"}`} aria-hidden="true" />;
}
