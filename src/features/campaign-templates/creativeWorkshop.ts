import {
  DEFAULT_TEMPLATE_SETTINGS,
  normalizeTemplateSettings,
} from "./templateRegistry";
import type {
  CampaignTemplateDestination,
  CampaignTemplateSettings,
} from "./types";

export type CreativeDestination = "mailer" | "discovery" | "qr" | "social";
export type OverlayStyle = "solid" | "linear" | "radial" | "bottom-fade" | "top-fade";
export type TextSize = "small" | "medium" | "large";
export type TextAlignment = "left" | "center" | "right";
export type TextPanel = "none" | "soft" | "solid" | "gradient";

export type CreativeSettings = CampaignTemplateSettings & {
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
  primaryColorOverride: string | null;
  accentColorOverride: string | null;
  showLogo: boolean;
  showBusinessName: boolean;
  showHeadline: boolean;
  showOffer: boolean;
  showCta: boolean;
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
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export const DEFAULT_CREATIVE_SETTINGS: CreativeSettings = Object.freeze({
  ...DEFAULT_TEMPLATE_SETTINGS,
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

export const DEFAULT_WORKSHOP_STATE: CreativeWorkshopState = Object.freeze({
  version: 1,
  global: DEFAULT_CREATIVE_SETTINGS,
  overrides: {},
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
    primaryColorOverride: color(input.primaryColorOverride, null),
    accentColorOverride: color(input.accentColorOverride, null),
    showLogo: input.showLogo !== false,
    showBusinessName: input.showBusinessName !== false,
    showHeadline: input.showHeadline !== false,
    showOffer: input.showOffer !== false,
    showCta: input.showCta !== false,
    showPhone: input.showPhone === true,
    showWebsite: input.showWebsite === true,
    showSponsorBadge: input.showSponsorBadge !== false,
    safeAreaVisible: input.safeAreaVisible === true,
    bleedVisible: input.bleedVisible === true,
    qrMinimumVisible: input.qrMinimumVisible === true,
  };
}

export function normalizeWorkshopState(value: unknown): CreativeWorkshopState {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const overridesInput = input.overrides && typeof input.overrides === "object"
    ? input.overrides as Record<string, unknown>
    : {};
  const overrides: CreativeWorkshopState["overrides"] = {};
  for (const destination of ["mailer", "discovery", "qr", "social"] as const) {
    if (overridesInput[destination]) overrides[destination] = normalizeCreativeSettings(overridesInput[destination]);
  }
  return {
    version: 1,
    global: normalizeCreativeSettings(input.global ?? input),
    overrides,
  };
}

export function resolveCreativeSettings(state: CreativeWorkshopState, destination: CreativeDestination) {
  return state.overrides[destination] ?? state.global;
}

export function updateCreativeSettings(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
  scope: "global" | "destination",
  patch: Partial<CreativeSettings>,
): CreativeWorkshopState {
  if (scope === "global") return { ...state, global: normalizeCreativeSettings({ ...state.global, ...patch }) };
  const current = resolveCreativeSettings(state, destination);
  return {
    ...state,
    overrides: { ...state.overrides, [destination]: normalizeCreativeSettings({ ...current, ...patch }) },
  };
}

export function resetCreativeDestination(state: CreativeWorkshopState, destination: CreativeDestination) {
  const overrides = { ...state.overrides };
  delete overrides[destination];
  return { ...state, overrides };
}

export function destinationToRenderer(destination: CreativeDestination): CampaignTemplateDestination {
  if (destination === "social") return "social-square";
  return destination;
}

export function affectsPrint(previous: CreativeWorkshopState, next: CreativeWorkshopState) {
  return JSON.stringify(resolveCreativeSettings(previous, "mailer"))
    !== JSON.stringify(resolveCreativeSettings(next, "mailer"));
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
