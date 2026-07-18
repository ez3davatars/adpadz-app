import type { CommunityCardFormat } from "./communityCards";

export const COMMUNITY_MAILER_GEOMETRY = {
  postcard_9x12: {
    finishedWidthInches: 12,
    finishedHeightInches: 9,
    bleedWidthInches: 12.25,
    bleedHeightInches: 9.25,
    safeInsetInches: 0.125,
    dpi: 300,
    qrMinimumInches: 0.75,
  },
  community_card_6x11: {
    finishedWidthInches: 11,
    finishedHeightInches: 6,
    bleedWidthInches: 11.25,
    bleedHeightInches: 6.25,
    safeInsetInches: 0.125,
    dpi: 300,
    qrMinimumInches: 0.75,
  },
} as const satisfies Record<CommunityCardFormat, {
  finishedWidthInches: number;
  finishedHeightInches: number;
  bleedWidthInches: number;
  bleedHeightInches: number;
  safeInsetInches: number;
  dpi: number;
  qrMinimumInches: number;
}>;

export const geometryForMailer = (format: CommunityCardFormat) => {
  const geometry = COMMUNITY_MAILER_GEOMETRY[format];
  return {
    ...geometry,
    finishedPixels: {
      width: geometry.finishedWidthInches * geometry.dpi,
      height: geometry.finishedHeightInches * geometry.dpi,
    },
    bleedPixels: {
      width: geometry.bleedWidthInches * geometry.dpi,
      height: geometry.bleedHeightInches * geometry.dpi,
    },
  };
};

export const COMMUNITY_MAILER_TRANSITIONS = {
  draft: ["selling", "archived"],
  selling: ["building", "archived"],
  building: ["review", "archived"],
  review: ["ready_for_print", "archived"],
  ready_for_print: ["printed", "archived"],
  printed: ["mailed", "archived"],
  mailed: ["published", "archived"],
  published: ["archived"],
  archived: [],
} as const;

export type ProductionState = keyof typeof COMMUNITY_MAILER_TRANSITIONS;
export const canTransitionCommunityMailer = (
  from: ProductionState,
  to: ProductionState,
) => (COMMUNITY_MAILER_TRANSITIONS[from] as readonly string[]).includes(to);

export type ProductionFreshness = {
  layoutRevision: number;
  preflightLayoutRevision: number | null;
  exportLayoutRevision: number | null;
  layoutLocked: boolean;
  preflightPassed: boolean;
};

export const isCurrentPreflight = (state: ProductionFreshness) =>
  state.layoutLocked && state.preflightPassed &&
  state.preflightLayoutRevision === state.layoutRevision;

export const isCurrentExport = (state: ProductionFreshness) =>
  isCurrentPreflight(state) &&
  state.exportLayoutRevision === state.layoutRevision;

export const qrPhysicalSize = (
  format: CommunityCardFormat,
  placementWidthPercent: number,
  qrWidthPercentOfPlacement: number,
) => {
  const geometry = COMMUNITY_MAILER_GEOMETRY[format];
  return geometry.finishedWidthInches * placementWidthPercent / 100 *
    qrWidthPercentOfPlacement / 100;
};

export const COMMUNITY_MAILER_PRODUCTION_DEMO_STATES = [
  "selling",
  "reserved",
  "paid",
  "campaign_assigned",
  "artwork_changes_requested",
  "artwork_approved",
  "preflight_blocked",
  "preflight_warning_only",
  "ready_for_print",
  "export_current",
  "export_stale",
  "printed",
  "mailed",
  "published",
] as const;
