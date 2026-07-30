import {
  CREATIVE_DESTINATION_KEYS,
  getCreativeDestinationCapabilities,
  type CreativeDestination,
} from "./creativeDestinations";
import {
  normalizeCreativeDirectorState,
  updateCreativeDirectorSelection,
  type CampaignGoal,
  type CreativeDirection,
  type CreativeOptimizerAction,
  type CreativeRecipeId,
} from "./creativeDirectorSchema";
import {
  DEFAULT_CREATIVE_SETTINGS,
  inferCreativeRecipeId,
  normalizeCreativeSettings,
  resolveCreativeSettings,
  updateCreativeSettings,
  type CreativeSettings,
  type CreativeWorkshopState,
} from "./creativeWorkshop";
export {
  getDestinationSafeBounds,
  type CreativeSafeBounds,
} from "./creativeDestinations";

export type CreativeRecipe = {
  id: CreativeRecipeId;
  name: string;
  family: CreativeRecipeId;
  promise: string;
  supportedDestinations: readonly CreativeDestination[];
  composition: {
    imageTreatment: "framed" | "immersive" | "focal";
    contentAlignment: "left" | "center";
    headlineZone: "upper" | "lower" | "center";
    brandZone: "top" | "integrated";
    offerZone: "supporting" | "dominant";
    qrZone: "anchored" | "prominent";
  };
  typography: {
    headlineScale: "large" | "extra-large";
    headlineWeight: "bold" | "black";
    supportingScale: "restrained" | "compact";
    tracking: "tight" | "normal";
    lineHeight: "compact" | "open";
  };
  treatment: {
    overlayStyle: "none" | "tonal" | "high-contrast";
    overlayStrength: number;
    surfaceStyle: "editorial-light" | "cinematic-dark" | "impact-dark";
    accentUsage: "restrained" | "integrated" | "direct";
  };
  visibility: {
    showSubheadline: boolean;
    showDescription: boolean;
    showPhone: boolean;
    showWebsite: boolean;
    showOffer: boolean;
    showQr: boolean;
  };
  settings: Partial<CreativeSettings>;
};

const DESTINATIONS: readonly CreativeDestination[] = [
  "mailer",
  "discovery",
  "qr",
  "social",
];

export const CREATIVE_RECIPES: readonly CreativeRecipe[] = Object.freeze([
  {
    id: "editorial",
    name: "Editorial",
    family: "editorial",
    promise: "Refined space and publication-style hierarchy",
    supportedDestinations: DESTINATIONS,
    composition: {
      imageTreatment: "framed",
      contentAlignment: "left",
      headlineZone: "upper",
      brandZone: "top",
      offerZone: "supporting",
      qrZone: "anchored",
    },
    typography: {
      headlineScale: "large",
      headlineWeight: "bold",
      supportingScale: "restrained",
      tracking: "normal",
      lineHeight: "open",
    },
    treatment: {
      overlayStyle: "none",
      overlayStrength: 0,
      surfaceStyle: "editorial-light",
      accentUsage: "restrained",
    },
    visibility: {
      showSubheadline: false,
      showDescription: false,
      showPhone: false,
      showWebsite: false,
      showOffer: true,
      showQr: true,
    },
    settings: {
      template: "brand-focus",
      theme: "light",
      overlayEnabled: false,
      overlayOpacity: 0,
      headlineSize: "large",
      textAlign: "left",
      textPanel: "none",
      brightness: 104,
      contrast: 104,
      saturation: 88,
      blur: 0,
      showDescription: false,
      showPhone: false,
      showWebsite: false,
      qrEmphasis: "standard",
    },
  },
  {
    id: "cinematic",
    name: "Cinematic",
    family: "cinematic",
    promise: "Immersive imagery with controlled dramatic focus",
    supportedDestinations: DESTINATIONS,
    composition: {
      imageTreatment: "immersive",
      contentAlignment: "left",
      headlineZone: "lower",
      brandZone: "integrated",
      offerZone: "supporting",
      qrZone: "anchored",
    },
    typography: {
      headlineScale: "extra-large",
      headlineWeight: "black",
      supportingScale: "compact",
      tracking: "tight",
      lineHeight: "compact",
    },
    treatment: {
      overlayStyle: "tonal",
      overlayStrength: 72,
      surfaceStyle: "cinematic-dark",
      accentUsage: "integrated",
    },
    visibility: {
      showSubheadline: false,
      showDescription: true,
      showPhone: false,
      showWebsite: false,
      showOffer: true,
      showQr: true,
    },
    settings: {
      template: "hero-visual",
      theme: "dark",
      overlayEnabled: true,
      overlayStyle: "bottom-fade",
      overlayOpacity: 72,
      overlaySpread: 70,
      headlineSize: "large",
      textAlign: "left",
      textPanel: "none",
      brightness: 92,
      contrast: 112,
      saturation: 104,
      blur: 0,
      showDescription: true,
      showPhone: false,
      showWebsite: false,
      qrEmphasis: "standard",
    },
  },
  {
    id: "impact",
    name: "Impact",
    family: "impact",
    promise: "Fast-scanning contrast with a dominant offer",
    supportedDestinations: DESTINATIONS,
    composition: {
      imageTreatment: "focal",
      contentAlignment: "left",
      headlineZone: "center",
      brandZone: "top",
      offerZone: "dominant",
      qrZone: "prominent",
    },
    typography: {
      headlineScale: "extra-large",
      headlineWeight: "black",
      supportingScale: "compact",
      tracking: "tight",
      lineHeight: "compact",
    },
    treatment: {
      overlayStyle: "high-contrast",
      overlayStrength: 82,
      surfaceStyle: "impact-dark",
      accentUsage: "direct",
    },
    visibility: {
      showSubheadline: false,
      showDescription: false,
      showPhone: false,
      showWebsite: false,
      showOffer: true,
      showQr: true,
    },
    settings: {
      template: "offer-first",
      theme: "dark",
      overlayEnabled: true,
      overlayStyle: "linear",
      overlayOpacity: 82,
      overlayDirection: 90,
      overlaySpread: 74,
      headlineSize: "large",
      textAlign: "left",
      textPanel: "solid",
      brightness: 96,
      contrast: 124,
      saturation: 112,
      blur: 0,
      showDescription: false,
      showPhone: false,
      showWebsite: false,
      qrEmphasis: "prominent",
    },
  },
]);

export const CREATIVE_RECIPE_MAP = Object.freeze(
  Object.fromEntries(CREATIVE_RECIPES.map(recipe => [recipe.id, recipe])),
) as Readonly<Record<CreativeRecipeId, CreativeRecipe>>;

const DIRECTION_PATCHES: Readonly<
  Record<CreativeDirection, Partial<CreativeSettings>>
> = Object.freeze({
  premium: {
    saturation: 92,
    contrast: 108,
    showDescription: false,
    showPhone: false,
    showWebsite: false,
  },
  bold: {
    headlineSize: "large",
    contrast: 122,
    saturation: 112,
    showDescription: false,
  },
  modern: {
    contrast: 112,
    saturation: 100,
    textPanel: "soft",
  },
  minimal: {
    showDescription: false,
    showPhone: false,
    showWebsite: false,
    textPanel: "none",
  },
  "high-contrast": {
    theme: "dark",
    overlayEnabled: true,
    overlayOpacity: 78,
    contrast: 128,
    textPanel: "solid",
  },
});

const GOAL_PATCHES: Readonly<Record<CampaignGoal, Partial<CreativeSettings>>> =
  Object.freeze({
    "promote-offer": {
      showOffer: true,
      showCta: true,
    },
    "generate-calls": {
      showPhone: true,
      showWebsite: false,
      showCta: true,
    },
    "drive-qr-scans": {
      showQr: true,
      showCta: true,
      qrEmphasis: "prominent",
    },
    "build-awareness": {
      showLogo: true,
      showBusinessName: true,
      showCta: true,
    },
  });

export function getCreativeRecipe(recipeId: CreativeRecipeId): CreativeRecipe {
  return CREATIVE_RECIPE_MAP[recipeId];
}

export function applyCreativeRecipe(
  current: CreativeSettings,
  recipeId: CreativeRecipeId,
  destination: CreativeDestination,
  goal: CampaignGoal,
  direction: CreativeDirection,
): CreativeSettings {
  const recipe = getCreativeRecipe(recipeId);
  const preserved = {
    imageAssetId: current.imageAssetId,
    qrId: current.qrId,
    imagePositionX: current.imagePositionX,
    imagePositionY: current.imagePositionY,
    imageZoom: current.imageZoom,
    primaryColorOverride: current.primaryColorOverride,
    accentColorOverride: current.accentColorOverride,
    showExpiration: current.showExpiration,
  };
  return normalizeCreativeSettings({
    ...current,
    ...recipe.settings,
    ...DIRECTION_PATCHES[direction],
    ...GOAL_PATCHES[goal],
    ...preserved,
    showLogo: true,
    showBusinessName: true,
    showHeadline: true,
    showOffer: true,
    showCta: true,
    showQr: getCreativeDestinationCapabilities(destination).requiresQr
      ? true
      : recipe.visibility.showQr,
    qrMinimumVisible: false,
  });
}

export function applyCreativeOptimizer(
  current: CreativeSettings,
  action: CreativeOptimizerAction,
  destination: CreativeDestination,
): CreativeSettings {
  const requiredQr =
    getCreativeDestinationCapabilities(destination).requiresQr;
  const essential = {
    imageAssetId: current.imageAssetId,
    qrId: current.qrId,
    showLogo: true,
    showBusinessName: true,
    showHeadline: true,
    showOffer: true,
    showCta: true,
    showQr: requiredQr ? true : current.showQr,
    showExpiration: current.showExpiration,
  };
  const patch: Partial<CreativeSettings> =
    action === "make-more-premium"
      ? {
          contrast: 110,
          saturation: 92,
          overlayOpacity: current.overlayEnabled ? 58 : current.overlayOpacity,
          headlineSize: "large",
          textPanel: "none",
          showDescription: false,
          showPhone: false,
          showWebsite: false,
        }
      : action === "simplify"
        ? {
            showDescription: false,
            showPhone: false,
            showWebsite: false,
            textPanel: "none",
          }
        : action === "increase-stop-power"
          ? {
              headlineSize: "large",
              contrast: 128,
              saturation: 112,
              overlayEnabled: true,
              overlayOpacity: 72,
              showDescription: false,
              blur: 0,
            }
          : action === "improve-readability"
            ? {
                headlineSize:
                  current.headlineSize === "small"
                    ? "medium"
                    : current.headlineSize,
                overlayEnabled: true,
                overlayOpacity: 78,
                contrast: 116,
                textAlign: "left",
                textPanel: "solid",
              }
            : {
                showQr: true,
                qrEmphasis: "prominent",
              };

  return normalizeCreativeSettings({
    ...current,
    ...essential,
    ...patch,
  });
}

const DIRECTOR_PRESERVED_SETTING_KEYS = new Set<keyof CreativeSettings>([
  "version",
  "imageAssetId",
  "imagePositionX",
  "imagePositionY",
  "imageZoom",
  "qrId",
  "primaryColorOverride",
  "accentColorOverride",
  "showExpiration",
  "safeAreaVisible",
  "bleedVisible",
  "qrMinimumVisible",
]);

function directorSettingsDiffer(
  current: CreativeSettings,
  expected: CreativeSettings,
) {
  const keys = new Set<keyof CreativeSettings>([
    ...(Object.keys(current) as (keyof CreativeSettings)[]),
    ...(Object.keys(expected) as (keyof CreativeSettings)[]),
  ]);
  return Array.from(keys).some(
    key =>
      !DIRECTOR_PRESERVED_SETTING_KEYS.has(key)
      && current[key] !== expected[key],
  );
}

/**
 * Detects material settings that no longer match the selected recipe and its
 * recorded refinements. Content references, crop, brand colors, expiration,
 * and proof guides are intentionally excluded because recipes preserve them.
 *
 * A canonical untouched Workshop state is treated as an inferred legacy
 * starting point, not falsely attributed to an Advanced Edit.
 */
export function hasAdvancedCreativeOverrides(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
) {
  const current = normalizeCreativeSettings(
    resolveCreativeSettings(state, destination),
  );
  const baseline = normalizeCreativeSettings({
    ...DEFAULT_CREATIVE_SETTINGS,
    imageAssetId: current.imageAssetId,
    imagePositionX: current.imagePositionX,
    imagePositionY: current.imagePositionY,
    imageZoom: current.imageZoom,
    qrId: current.qrId,
    primaryColorOverride: current.primaryColorOverride,
    accentColorOverride: current.accentColorOverride,
    showExpiration: current.showExpiration,
  });
  if (!directorSettingsDiffer(current, baseline)) return false;

  const selection = state.director.concepts[destination];
  let expected = applyCreativeRecipe(
    baseline,
    selection.recipeId,
    destination,
    state.director.goal,
    state.director.direction,
  );
  for (const refinement of selection.refinements) {
    expected = applyCreativeOptimizer(expected, refinement, destination);
  }
  return directorSettingsDiffer(current, expected);
}

export function selectCreativeDestination(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
): CreativeWorkshopState {
  return {
    ...state,
    director: normalizeCreativeDirectorState({
      ...state.director,
      destination,
    }),
  };
}

export function updateCreativeBrief(
  state: CreativeWorkshopState,
  patch: Partial<Pick<CreativeWorkshopState["director"], "goal" | "direction">>,
): CreativeWorkshopState {
  const goal = patch.goal ?? state.director.goal;
  const direction = patch.direction ?? state.director.direction;
  if (
    goal === state.director.goal
    && direction === state.director.direction
  ) return state;

  const director = normalizeCreativeDirectorState({
    ...state.director,
    goal,
    direction,
  });
  const inheritedDestinations = CREATIVE_DESTINATION_KEYS.filter(
    destination => !state.overrides[destination],
  );
  const globalRecipeId = inheritedDestinations.length
    ? director.concepts[inheritedDestinations[0]].recipeId
    : inferCreativeRecipeId(state.global.template);
  let next: CreativeWorkshopState = {
    ...state,
    global: applyCreativeRecipe(
      state.global,
      globalRecipeId,
      inheritedDestinations[0] ?? director.destination,
      director.goal,
      director.direction,
    ),
  };
  for (const destination of CREATIVE_DESTINATION_KEYS) {
    if (!state.overrides[destination]) continue;
    const selection = director.concepts[destination];
    next = updateCreativeSettings(
      next,
      destination,
      "destination",
      applyCreativeRecipe(
        resolveCreativeSettings(state, destination),
        selection.recipeId,
        destination,
        director.goal,
        director.direction,
      ),
    );
  }
  return {
    ...next,
    director: normalizeCreativeDirectorState({
      ...director,
      concepts: Object.fromEntries(
        Object.entries(director.concepts).map(([destination, selection]) => [
          destination,
          { ...selection, refinements: [] },
        ]),
      ),
    }),
  };
}

export function selectCreativeRecipe(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
  recipeId: CreativeRecipeId,
): CreativeWorkshopState {
  const settings = applyCreativeRecipe(
    resolveCreativeSettings(state, destination),
    recipeId,
    destination,
    state.director.goal,
    state.director.direction,
  );
  const next = updateCreativeSettings(
    state,
    destination,
    "destination",
    settings,
  );
  return {
    ...next,
    director: updateCreativeDirectorSelection(
      { ...state.director, destination },
      destination,
      { recipeId, refinements: [] },
    ),
  };
}

export function optimizeCampaignCreative(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
  action: CreativeOptimizerAction,
): CreativeWorkshopState {
  const settings = applyCreativeOptimizer(
    resolveCreativeSettings(state, destination),
    action,
    destination,
  );
  const next = updateCreativeSettings(
    state,
    destination,
    "destination",
    settings,
  );
  const current = state.director.concepts[destination];
  return {
    ...next,
    director: updateCreativeDirectorSelection(
      { ...state.director, destination },
      destination,
      {
        refinements: Array.from(new Set([...current.refinements, action])),
      },
    ),
  };
}

export function resetCreativeRefinements(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
): CreativeWorkshopState {
  const selection = state.director.concepts[destination];
  return selectCreativeRecipe(
    state,
    destination,
    selection.recipeId,
  );
}
