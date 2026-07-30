import {
  CREATIVE_DESTINATION_KEYS,
  CREATIVE_DESTINATION_MAP,
  destinationToRenderer,
  PRINT_CREATIVE_DESTINATIONS,
  type CreativeDestination,
  type CreativeFormatKey,
} from "./creativeDestinations";
import {
  DEFAULT_TEMPLATE_SETTINGS,
  normalizeTemplateSettings,
} from "./templateRegistry";
import {
  type CreativeConceptSelection,
  DEFAULT_CREATIVE_DIRECTOR_STATE,
  normalizeCreativeDirectorState,
  type CreativeDirectorState,
  type CreativeRecipeId,
} from "./creativeDirectorSchema";
import type {
  CampaignTemplateDestination,
  CampaignTemplateSettings,
} from "./types";

export {
  CREATIVE_DESTINATION_KEYS,
  CREATIVE_DESTINATION_MAP,
  CREATIVE_DESTINATIONS,
  PRINT_CREATIVE_DESTINATIONS,
  creativeDestinationLabel,
  creativeFormatAspect,
  creativeFormatRatio,
  destinationToRenderer,
  getCreativeDestination,
  getCreativeDestinationCapabilities,
  isCreativeDestination,
  resolveCreativeFormatDefinition,
} from "./creativeDestinations";
export type {
  CreativeDestination,
  CreativeDestinationCapabilities,
  CreativeDestinationDefinition,
  CreativeFormatDefinition,
  CreativeFormatKey,
} from "./creativeDestinations";

export type CreativeScope = "global" | "destination";
export type CreativeFormatMap = Record<CreativeDestination, CreativeFormatKey>;
export type CreativeElementKey =
  | "image"
  | "logo"
  | "business-name"
  | "headline"
  | "offer"
  | "cta"
  | "qr"
  | "expiration"
  | "phone"
  | "website"
  | "sponsor-badge"
  | "overlay"
  | null;
export type OverlayStyle = "solid" | "linear" | "radial" | "bottom-fade" | "top-fade";
export type TextSize = "small" | "medium" | "large";
export type TextAlignment = "left" | "center" | "right";
export type TextPanel = "none" | "soft" | "solid" | "gradient";
export type QrEmphasis = "standard" | "prominent";

export type CreativeSettings = CampaignTemplateSettings & {
  imageAssetId: string | null;
  rotation: number;
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  overlayEnabled: boolean;
  overlayStyle: OverlayStyle;
  overlayColor: string;
  overlayOpacity: number;
  overlayDirection: number;
  overlaySpread: number;
  qrId: string | null;
  headlineSize: TextSize;
  textAlign: TextAlignment;
  textPanel: TextPanel;
  qrEmphasis?: QrEmphasis;
  primaryColorOverride: string | null;
  accentColorOverride: string | null;
  showLogo: boolean;
  showBusinessName: boolean;
  showHeadline: boolean;
  showOffer: boolean;
  showCta: boolean;
  showDescription?: boolean;
  showPhone: boolean;
  showWebsite: boolean;
  showSponsorBadge: boolean;
  safeAreaVisible: boolean;
  bleedVisible: boolean;
  qrMinimumVisible: boolean;
};

export type CreativeWorkshopState = {
  version: 1;
  global: CreativeSettings;
  overrides: Partial<Record<CreativeDestination, CreativeSettings>>;
  formats: CreativeFormatMap;
  director: CreativeDirectorState;
};

export type CreativeAssetReference = {
  id: string;
  file_url?: string | null;
  thumbnail_url?: string | null;
  external_url?: string | null;
  is_active?: boolean;
};

export type CreativeAssetRendition = "full" | "thumbnail";

export type CreativeQrReference = {
  id: string;
  publicUrl: string | null;
};

export type DestinationCreativeSource =
  | "workshop-override"
  | "workshop-global"
  | "legacy";

export type DestinationCreativeResolution = {
  source: DestinationCreativeSource;
  state: CreativeWorkshopState;
  settings: CreativeSettings;
  renderSettings: CreativeSettings;
  format: CreativeFormatKey;
  rendererDestination: CampaignTemplateDestination;
  imageAssetId: string | null;
  qrId: string | null;
  imageUrl: string | null;
  qrDestinationUrl: string | null;
  imageResolution: "exact" | "fallback" | "none";
  qrResolution: "exact" | "fallback" | "none";
  issues: string[];
};

export type DestinationCreativeResources = {
  assets?: readonly CreativeAssetReference[];
  qrLinks?: readonly CreativeQrReference[];
  fallbackImageUrl?: string | null;
  fallbackDestinationUrl?: string | null;
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export const DEFAULT_CREATIVE_SETTINGS: CreativeSettings = Object.freeze({
  ...DEFAULT_TEMPLATE_SETTINGS,
  imageAssetId: null,
  rotation: 0,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  overlayEnabled: true,
  overlayStyle: "bottom-fade",
  overlayColor: "#000000",
  overlayOpacity: 55,
  overlayDirection: 180,
  overlaySpread: 55,
  qrId: null,
  headlineSize: "medium",
  textAlign: "left",
  textPanel: "none",
  primaryColorOverride: null,
  accentColorOverride: null,
  showLogo: true,
  showBusinessName: true,
  showHeadline: true,
  showOffer: true,
  showCta: true,
  showPhone: false,
  showWebsite: false,
  showSponsorBadge: true,
  safeAreaVisible: false,
  bleedVisible: false,
  qrMinimumVisible: false,
});

export const CREATIVE_FORMAT_KEYS: Readonly<Record<CreativeDestination, readonly CreativeFormatKey[]>> = Object.freeze(
  Object.fromEntries(CREATIVE_DESTINATION_KEYS.map(destination => [
    destination,
    Object.freeze(CREATIVE_DESTINATION_MAP[destination].formats.map(format => format.key)),
  ])) as Record<CreativeDestination, readonly CreativeFormatKey[]>,
);

export const DEFAULT_CREATIVE_FORMATS: CreativeFormatMap = Object.freeze(
  Object.fromEntries(CREATIVE_DESTINATION_KEYS.map(destination => [
    destination,
    CREATIVE_DESTINATION_MAP[destination].defaultFormat,
  ])) as CreativeFormatMap,
);

export const DEFAULT_WORKSHOP_STATE: CreativeWorkshopState = Object.freeze({
  version: 1,
  global: DEFAULT_CREATIVE_SETTINGS,
  overrides: {},
  formats: DEFAULT_CREATIVE_FORMATS,
  director: DEFAULT_CREATIVE_DIRECTOR_STATE,
});

export function normalizeCreativeSettings(value: unknown): CreativeSettings {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const base = normalizeTemplateSettings(input);
  const choice = <T extends string>(candidate: unknown, allowed: readonly T[], fallback: T) =>
    typeof candidate === "string" && allowed.includes(candidate as T) ? candidate as T : fallback;
  const color = (candidate: unknown, fallback: string | null) =>
    typeof candidate === "string" && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
  return {
    ...DEFAULT_CREATIVE_SETTINGS,
    ...base,
    imageAssetId: typeof input.imageAssetId === "string" && input.imageAssetId.trim() ? input.imageAssetId : null,
    rotation: clamp(input.rotation, -5, 5, 0),
    brightness: clamp(input.brightness, 25, 175, 100),
    contrast: clamp(input.contrast, 25, 175, 100),
    saturation: clamp(input.saturation, 0, 200, 100),
    blur: clamp(input.blur, 0, 12, 0),
    overlayEnabled: input.overlayEnabled !== false,
    overlayStyle: choice(input.overlayStyle, ["solid", "linear", "radial", "bottom-fade", "top-fade"], "bottom-fade"),
    overlayColor: color(input.overlayColor, "#000000") ?? "#000000",
    overlayOpacity: clamp(input.overlayOpacity, 0, 100, 55),
    overlayDirection: clamp(input.overlayDirection, 0, 360, 180),
    overlaySpread: clamp(input.overlaySpread, 0, 100, 55),
    qrId: typeof input.qrId === "string" && input.qrId ? input.qrId : null,
    headlineSize: choice(input.headlineSize, ["small", "medium", "large"], "medium"),
    textAlign: choice(input.textAlign, ["left", "center", "right"], "left"),
    textPanel: choice(input.textPanel, ["none", "soft", "solid", "gradient"], "none"),
    ...(input.qrEmphasis === "standard" || input.qrEmphasis === "prominent"
      ? {
          qrEmphasis: choice<QrEmphasis>(
            input.qrEmphasis,
            ["standard", "prominent"],
            "standard",
          ),
        }
      : {}),
    primaryColorOverride: color(input.primaryColorOverride, null),
    accentColorOverride: color(input.accentColorOverride, null),
    showLogo: input.showLogo !== false,
    showBusinessName: input.showBusinessName !== false,
    showHeadline: input.showHeadline !== false,
    showOffer: input.showOffer !== false,
    showCta: input.showCta !== false,
    ...(typeof input.showDescription === "boolean"
      ? { showDescription: input.showDescription }
      : {}),
    showPhone: input.showPhone === true,
    showWebsite: input.showWebsite === true,
    showSponsorBadge: input.showSponsorBadge !== false,
    safeAreaVisible: input.safeAreaVisible === true,
    bleedVisible: input.bleedVisible === true,
    qrMinimumVisible: input.qrMinimumVisible === true,
  };
}

export function normalizeCreativeFormat(destination: CreativeDestination, value: unknown): CreativeFormatKey {
  return typeof value === "string" && CREATIVE_FORMAT_KEYS[destination].includes(value as CreativeFormatKey)
    ? value as CreativeFormatKey
    : DEFAULT_CREATIVE_FORMATS[destination];
}

export function normalizeCreativeFormats(value: unknown): CreativeFormatMap {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return Object.fromEntries(CREATIVE_DESTINATION_KEYS.map(destination => [
    destination,
    normalizeCreativeFormat(destination, input[destination]),
  ])) as CreativeFormatMap;
}

export function normalizeWorkshopState(value: unknown): CreativeWorkshopState {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const overridesInput = input.overrides && typeof input.overrides === "object"
    ? input.overrides as Record<string, unknown>
    : {};
  const global = normalizeCreativeSettings(input.global ?? input);
  const overrides: CreativeWorkshopState["overrides"] = {};
  for (const destination of CREATIVE_DESTINATION_KEYS) {
    if (overridesInput[destination]) overrides[destination] = normalizeCreativeSettings(overridesInput[destination]);
  }
  const fallbackRecipes = Object.fromEntries(
    CREATIVE_DESTINATION_KEYS.map(destination => [
      destination,
      inferCreativeRecipeId(overrides[destination]?.template ?? global.template),
    ]),
  ) as Record<CreativeDestination, CreativeRecipeId>;
  return {
    version: 1,
    global,
    overrides,
    formats: normalizeCreativeFormats(input.formats),
    director: normalizeCreativeDirectorState(input.director, fallbackRecipes),
  };
}

export function resolveCreativeSettings(state: CreativeWorkshopState, destination: CreativeDestination) {
  return state.overrides[destination] ?? state.global;
}

/**
 * Resolves one saved Campaign creative into the exact settings and format used
 * by a destination. Resource records are supplied by the caller so this pure
 * resolver never bypasses the authorization boundary of the current surface.
 */
export function resolveDestinationCreative(
  metadata: unknown,
  destination: CreativeDestination,
  resources: DestinationCreativeResources = {},
): DestinationCreativeResolution {
  const metadataRecord = asRecord(metadata);
  const workshopRecord = asRecord(metadataRecord.creative_workshop);
  const hasWorkshop = Object.keys(workshopRecord).length > 0;
  const state = normalizeWorkshopState(
    hasWorkshop ? workshopRecord : metadataRecord.template_settings,
  );
  const hasOverride = hasWorkshop
    && Object.prototype.hasOwnProperty.call(asRecord(workshopRecord.overrides), destination);
  const source: DestinationCreativeSource = hasWorkshop
    ? hasOverride ? "workshop-override" : "workshop-global"
    : "legacy";
  const settings = resolveCreativeSettings(state, destination);
  const format = normalizeCreativeFormat(destination, state.formats[destination]);
  const issues: string[] = [];

  const fallbackImageUrl = cleanResourceUrl(resources.fallbackImageUrl);
  const selectedAsset = settings.imageAssetId
    ? resources.assets?.find(asset => asset.id === settings.imageAssetId)
    : undefined;
  const selectedImageUrl = selectedAsset ? resolveCreativeAssetUrl(selectedAsset) : null;
  const imageUrl = settings.imageAssetId
    ? selectedImageUrl ?? fallbackImageUrl
    : fallbackImageUrl;
  const imageResolution: DestinationCreativeResolution["imageResolution"] = settings.imageAssetId
    ? selectedImageUrl ? "exact" : fallbackImageUrl ? "fallback" : "none"
    : fallbackImageUrl ? "fallback" : "none";
  if (settings.imageAssetId && !selectedImageUrl) {
    issues.push(fallbackImageUrl
      ? "The selected Workshop image is not available to this destination. The campaign fallback image is shown."
      : "The selected Workshop image is not available to this destination.");
  }

  const fallbackDestinationUrl = cleanDestinationUrl(resources.fallbackDestinationUrl);
  const selectedQr = settings.qrId
    ? resources.qrLinks?.find(qr => qr.id === settings.qrId)
    : undefined;
  const selectedQrUrl = selectedQr ? cleanDestinationUrl(selectedQr.publicUrl) : null;
  const qrDestinationUrl = settings.showQr
    ? settings.qrId ? selectedQrUrl : fallbackDestinationUrl
    : null;
  const qrResolution: DestinationCreativeResolution["qrResolution"] = settings.showQr
    ? settings.qrId
      ? selectedQrUrl ? "exact" : "none"
      : fallbackDestinationUrl ? "fallback" : "none"
    : "none";
  if (settings.showQr && settings.qrId && !selectedQrUrl) {
    issues.push("The selected QR Studio artwork is not available to this destination, so no substitute QR is shown.");
  }
  if (settings.showQr && !settings.qrId && !qrDestinationUrl) {
    issues.push("A public campaign destination is required before the QR code can be shown.");
  }

  return {
    source,
    state,
    settings,
    renderSettings: qrDestinationUrl ? settings : { ...settings, showQr: false },
    format,
    rendererDestination: destinationToRenderer(destination, format),
    imageAssetId: settings.imageAssetId,
    qrId: settings.qrId,
    imageUrl,
    qrDestinationUrl,
    imageResolution,
    qrResolution,
    issues,
  };
}

export function updateCreativeSettings(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
  scope: "global" | "destination",
  patch: Partial<CreativeSettings>,
): CreativeWorkshopState {
  const next = scope === "global"
    ? {
        ...state,
        global: normalizeCreativeSettings({ ...state.global, ...patch }),
      }
    : {
        ...state,
        overrides: {
          ...state.overrides,
          [destination]: normalizeCreativeSettings({
            ...resolveCreativeSettings(state, destination),
            ...patch,
          }),
        },
      };
  if (!Object.prototype.hasOwnProperty.call(patch, "template")) return next;
  const affectedDestinations = scope === "global"
    ? CREATIVE_DESTINATION_KEYS.filter(item => !next.overrides[item])
    : [destination];
  return reconcileCreativeDirectorConcepts(next, affectedDestinations);
}

export function resetCreativeDestination(state: CreativeWorkshopState, destination: CreativeDestination) {
  const overrides = { ...state.overrides };
  delete overrides[destination];
  return reconcileCreativeDirectorConcepts({
    ...state,
    overrides,
    formats: {
      ...state.formats,
      [destination]: DEFAULT_CREATIVE_FORMATS[destination],
    },
  }, [destination]);
}

export function affectsPrint(previous: CreativeWorkshopState, next: CreativeWorkshopState) {
  return PRINT_CREATIVE_DESTINATIONS.some(destination =>
    JSON.stringify(resolveCreativeSettings(previous, destination))
      !== JSON.stringify(resolveCreativeSettings(next, destination))
    || normalizeCreativeFormat(destination, previous.formats?.[destination])
      !== normalizeCreativeFormat(destination, next.formats?.[destination]));
}

export function createHistory<T>(initial: T) {
  return { past: [] as T[], present: initial, future: [] as T[] };
}

export function pushHistory<T>(history: ReturnType<typeof createHistory<T>>, next: T) {
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history;
  return { past: [...history.past, history.present].slice(-50), present: next, future: [] as T[] };
}

export function undoHistory<T>(history: ReturnType<typeof createHistory<T>>) {
  const previous = history.past[history.past.length - 1];
  if (!previous) return history;
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redoHistory<T>(history: ReturnType<typeof createHistory<T>>) {
  const next = history.future[0];
  if (!next) return history;
  return { past: [...history.past, history.present], present: next, future: history.future.slice(1) };
}
function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function resolveCreativeAssetUrl(
  asset: CreativeAssetReference | null | undefined,
  rendition: CreativeAssetRendition = "full",
): string | null {
  if (!asset) return null;
  const preferred = rendition === "thumbnail"
    ? [asset.thumbnail_url, asset.file_url, asset.external_url]
    : [asset.file_url, asset.thumbnail_url, asset.external_url];
  for (const candidate of preferred) {
    const url = cleanResourceUrl(candidate);
    if (url) return url;
  }
  return null;
}

export function listActiveCreativeAssetOptions<T extends CreativeAssetReference>(
  assets: readonly T[],
): T[] {
  return assets.filter(asset => asset.is_active === true);
}

function cleanResourceUrl(value: unknown): string | null {
  return typeof value === "string" && /^(?:https?:|data:image\/|blob:)/i.test(value.trim())
    ? value.trim()
    : null;
}

function cleanDestinationUrl(value: unknown): string | null {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim())
    ? value.trim()
    : null;
}

export function inferCreativeRecipeId(
  template: CampaignTemplateSettings["template"],
): CreativeRecipeId {
  if (template === "offer-first") return "impact";
  if (template === "hero-visual") return "cinematic";
  return "editorial";
}

export function reconcileCreativeDirectorConcepts(
  state: CreativeWorkshopState,
  destinations: readonly CreativeDestination[],
  savedConcepts?: Partial<
    Record<CreativeDestination, CreativeConceptSelection>
  >,
): CreativeWorkshopState {
  const concepts = { ...state.director.concepts };
  for (const destination of new Set(destinations)) {
    const recipeId = inferCreativeRecipeId(
      resolveCreativeSettings(state, destination).template,
    );
    const saved = savedConcepts?.[destination];
    concepts[destination] = {
      recipeId,
      refinements:
        saved?.recipeId === recipeId ? [...saved.refinements] : [],
    };
  }
  return {
    ...state,
    director: normalizeCreativeDirectorState({
      ...state.director,
      concepts,
    }),
  };
}
