import {
  CREATIVE_DESTINATION_KEYS,
  isCreativeDestination,
  type CreativeDestination,
} from "./creativeDestinations";

export const CREATIVE_RECIPE_IDS = [
  "editorial",
  "cinematic",
  "impact",
] as const;

export type CreativeRecipeId = (typeof CREATIVE_RECIPE_IDS)[number];
export type CreativeConceptFamily = CreativeRecipeId;

export const CAMPAIGN_GOALS = [
  "promote-offer",
  "generate-calls",
  "drive-qr-scans",
  "build-awareness",
] as const;

export type CampaignGoal = (typeof CAMPAIGN_GOALS)[number];

export const CREATIVE_DIRECTIONS = [
  "premium",
  "bold",
  "modern",
  "minimal",
  "high-contrast",
] as const;

export type CreativeDirection = (typeof CREATIVE_DIRECTIONS)[number];

export const CREATIVE_OPTIMIZER_ACTIONS = [
  "make-more-premium",
  "simplify",
  "increase-stop-power",
  "improve-readability",
  "improve-qr-visibility",
] as const;

export type CreativeOptimizerAction =
  (typeof CREATIVE_OPTIMIZER_ACTIONS)[number];

export type CreativeConceptSelection = {
  recipeId: CreativeRecipeId;
  refinements: CreativeOptimizerAction[];
};

export type CreativeDirectorState = {
  version: 1;
  destination: CreativeDestination;
  goal: CampaignGoal;
  direction: CreativeDirection;
  concepts: Record<CreativeDestination, CreativeConceptSelection>;
};

const DEFAULT_CONCEPT_SELECTION: CreativeConceptSelection = Object.freeze({
  recipeId: "cinematic",
  refinements: [],
});

export const DEFAULT_CREATIVE_DIRECTOR_STATE: CreativeDirectorState =
  Object.freeze({
    version: 1,
    destination: "mailer",
    goal: "promote-offer",
    direction: "premium",
    concepts: Object.freeze(
      Object.fromEntries(
        CREATIVE_DESTINATION_KEYS.map(destination => [
          destination,
          DEFAULT_CONCEPT_SELECTION,
        ]),
      ) as Record<CreativeDestination, CreativeConceptSelection>,
    ),
  });

function isChoice<T extends string>(
  value: unknown,
  choices: readonly T[],
): value is T {
  return typeof value === "string" && choices.includes(value as T);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function normalizeCreativeDirectorState(
  value: unknown,
  fallbackRecipes: Partial<Record<CreativeDestination, CreativeRecipeId>> = {},
): CreativeDirectorState {
  const input = asRecord(value);
  const conceptsInput = asRecord(input.concepts);
  const concepts = Object.fromEntries(
    CREATIVE_DESTINATION_KEYS.map(destination => {
      const selection = asRecord(conceptsInput[destination]);
      const recipeId = isChoice(selection.recipeId, CREATIVE_RECIPE_IDS)
        ? selection.recipeId
        : fallbackRecipes[destination] ?? "cinematic";
      const refinements = Array.isArray(selection.refinements)
        ? selection.refinements.filter(
            (item): item is CreativeOptimizerAction =>
              isChoice(item, CREATIVE_OPTIMIZER_ACTIONS),
          )
        : [];
      return [
        destination,
        {
          recipeId,
          refinements: Array.from(new Set(refinements)),
        },
      ];
    }),
  ) as Record<CreativeDestination, CreativeConceptSelection>;

  return {
    version: 1,
    destination: isCreativeDestination(input.destination)
      ? input.destination
      : "mailer",
    goal: isChoice(input.goal, CAMPAIGN_GOALS)
      ? input.goal
      : "promote-offer",
    direction: isChoice(input.direction, CREATIVE_DIRECTIONS)
      ? input.direction
      : "premium",
    concepts,
  };
}

export function updateCreativeDirectorSelection(
  director: CreativeDirectorState,
  destination: CreativeDestination,
  patch: Partial<CreativeConceptSelection>,
): CreativeDirectorState {
  const current = director.concepts[destination];
  return normalizeCreativeDirectorState({
    ...director,
    concepts: {
      ...director.concepts,
      [destination]: {
        ...current,
        ...patch,
      },
    },
  });
}
