import type { CampaignRecord } from './ads';
import type { CampaignReadinessResult } from './campaignReadiness';

/**
 * The canonical Campaign workflow: Setup → Studio → Review → Publish.
 *
 * One Campaign. Many Destinations. One premium creative production flow.
 * Every surface that routes into a campaign stage derives labels and paths
 * from this module — never from hand-written URLs. Publish intentionally maps
 * onto the existing Campaign Distribution route; History is a tool inside
 * Studio, not a stage.
 */

export type CampaignStageKey = 'setup' | 'studio' | 'review' | 'publish';

export type CampaignStageDefinition = {
  key: CampaignStageKey;
  label: string;
  /** Route segment under /app/business/campaigns/:campaignId */
  segment: 'setup' | 'creative' | 'review' | 'distribution';
  description: string;
};

export const CAMPAIGN_STAGES: readonly CampaignStageDefinition[] = Object.freeze([
  { key: 'setup', label: 'Setup', segment: 'setup', description: 'Define the campaign content, offer, schedule, and outputs.' },
  { key: 'studio', label: 'Studio', segment: 'creative', description: 'Design the creative that every destination shares.' },
  { key: 'review', label: 'Review', segment: 'review', description: 'Confirm every destination before publishing.' },
  { key: 'publish', label: 'Publish', segment: 'distribution', description: 'Hand the campaign to its destinations.' },
]);

const STAGE_BY_KEY = new Map(CAMPAIGN_STAGES.map(stage => [stage.key, stage]));
const STAGE_BY_SEGMENT = new Map(CAMPAIGN_STAGES.map(stage => [stage.segment, stage]));

export function campaignStagePath(campaignId: string, stage: CampaignStageKey): string {
  return `/app/business/campaigns/${campaignId}/${STAGE_BY_KEY.get(stage)!.segment}`;
}

/** Resolves the workflow stage for a campaign-shell pathname, if any. */
export function campaignStageFromPath(pathname: string): CampaignStageKey | null {
  const match = pathname.match(/\/app\/business\/campaigns\/[^/]+\/([^/?#]+)/);
  if (!match) return null;
  return STAGE_BY_SEGMENT.get(match[1] as CampaignStageDefinition['segment'])?.key ?? null;
}

/**
 * Maps legacy campaign destinations (readiness engine, stored links) into the
 * stage-aware shell without breaking deep links: /edit lives on as /setup.
 */
export function normalizeCampaignActionDestination(destination: string): string {
  return destination.replace(/(\/app\/business\/campaigns\/[^/]+)\/edit\b/, '$1/setup');
}

export type CampaignStageStatus = 'complete' | 'attention' | 'blocked' | 'available';

export type CampaignStageState = {
  status: CampaignStageStatus;
  /** Present when the stage is blocked or needs attention. */
  detail?: string;
};

/**
 * Derives per-stage workflow states from the canonical readiness engine.
 * No new readiness logic: this is a projection of existing sections.
 */
export function deriveCampaignStageStates(
  campaign: Pick<CampaignRecord, 'status'>,
  readiness: CampaignReadinessResult | null | undefined,
): Record<CampaignStageKey, CampaignStageState> {
  if (!readiness) {
    return {
      setup: { status: 'available' },
      studio: { status: 'available' },
      review: { status: 'available' },
      publish: { status: 'available' },
    };
  }
  const core = readiness.sections.find(section => section.key === 'core');
  const publishing = readiness.sections.find(section => section.key === 'publishing');
  const coreBlocked = Boolean(core && core.status === 'blocked');
  const setup: CampaignStageState = coreBlocked
    ? { status: 'blocked', detail: core?.issues.find(issue => issue.severity === 'blocker')?.message ?? 'Required campaign content is missing.' }
    : core?.status === 'ready'
      ? { status: 'complete' }
      : { status: 'attention', detail: core?.issues[0]?.message };
  const studio: CampaignStageState = coreBlocked
    ? { status: 'available', detail: 'The Studio works best after required Setup content exists.' }
    : { status: setup.status === 'complete' ? 'complete' : 'available' };
  const review: CampaignStageState = readiness.blockers.length > 0
    ? { status: 'blocked', detail: `Resolve ${readiness.blockers.length} blocker${readiness.blockers.length === 1 ? '' : 's'} before publishing.` }
    : readiness.overallStatus === 'ready'
      ? { status: 'complete' }
      : { status: 'attention', detail: readiness.warnings[0]?.message };
  const publish: CampaignStageState = campaign.status === 'active'
    ? { status: 'complete' }
    : publishing?.status === 'ready'
      ? { status: 'available' }
      : { status: 'blocked', detail: publishing?.issues[0]?.message ?? 'Complete a public destination before publishing.' };
  return { setup, studio, review, publish };
}

export type CampaignStageAction = {
  /** Stage the action lands on, when it targets the campaign shell. */
  stage: CampaignStageKey | null;
  label: string;
  href: string;
  reason: string;
};

/**
 * One primary next action per campaign, derived from the canonical readiness
 * engine. Issue-driven actions win; a fully ready campaign flows to Review,
 * and an already-published campaign flows to Publish.
 */
export function resolveCampaignStageAction(
  campaign: Pick<CampaignRecord, 'id' | 'status'>,
  readiness: CampaignReadinessResult | null | undefined,
): CampaignStageAction {
  if (!readiness) {
    return {
      stage: 'setup',
      label: 'Continue Setup',
      href: campaignStagePath(campaign.id, 'setup'),
      reason: 'Complete the campaign definition.',
    };
  }
  const next = readiness.nextAction;
  // Only blocker- or warning-driven actions preempt the workflow. Info-level
  // suggestions (for example an optional mailer placement) never stop a ready
  // campaign from flowing into Review.
  const issueDriven = next
    && next.id !== 'publish-campaign'
    && next.id !== 'open-distribution'
    && [...readiness.blockers, ...readiness.warnings].some(item => item.id === next.id);
  if (issueDriven && next) {
    const href = normalizeCampaignActionDestination(next.destination);
    return {
      stage: campaignStageFromPath(href),
      label: next.label,
      href,
      reason: next.reason,
    };
  }
  if (campaign.status === 'active') {
    return {
      stage: 'publish',
      label: 'View Published Campaign',
      href: campaignStagePath(campaign.id, 'publish'),
      reason: 'The campaign is live. Review its destinations and exports.',
    };
  }
  if (readiness.blockers.length === 0) {
    return {
      stage: 'review',
      label: 'Review Campaign',
      href: campaignStagePath(campaign.id, 'review'),
      reason: 'Every requirement is met. Review each destination, then publish.',
    };
  }
  return {
    stage: 'setup',
    label: 'Continue Setup',
    href: campaignStagePath(campaign.id, 'setup'),
    reason: readiness.blockers[0]?.message ?? 'Complete the campaign definition.',
  };
}
