import {
  CREATIVE_DESTINATION_KEYS,
  getCreativeDestinationCapabilities,
  isCreativeDestination,
} from "./creativeDestinations";
import {
  DEFAULT_CREATIVE_SETTINGS,
  DEFAULT_WORKSHOP_STATE,
  normalizeCreativeFormat,
  normalizeCreativeSettings,
  normalizeWorkshopState,
  pushHistory,
  resolveCreativeSettings,
  type CreativeDestination,
  type CreativeElementKey,
  type CreativeFormatKey,
  type CreativeScope,
  type CreativeSettings,
  type CreativeWorkshopState,
} from "./creativeWorkshop";
import {
  getQrEmbeddedArtworkBytes,
  MAX_QR_EMBEDDED_ARTWORK_BYTES,
} from "../../lib/qr/qrArtwork";

export type CreativeInspectorSection =
  | "Template"
  | "Image"
  | "Overlay"
  | "QR"
  | "Text"
  | "Branding"
  | "Visibility"
  | "Print Safety";

export type CreativeResetSection =
  | "image"
  | "overlay"
  | "qr"
  | "text"
  | "branding"
  | "visibility"
  | "print-safety";

export type CreativeVersionSnapshot = {
  version: 1;
  destination: CreativeDestination;
  scope: CreativeScope;
  formatKey: CreativeFormatKey;
  settings: CreativeSettings;
  hasDestinationOverride?: boolean;
};

export type CreativeChangeImpact = "unchanged" | "print-affecting" | "digital-only";

export type CreativeChangeClassification = {
  impact: CreativeChangeImpact;
  affectsPrint: boolean;
  digitalOnly: boolean;
  createsOverride: boolean;
  destinations: CreativeDestination[];
};

export type CreativeHistory<T> = {
  past: T[];
  present: T;
  future: T[];
};

export type CreativeRestoreOptions = {
  destination?: CreativeDestination;
  scope?: CreativeScope;
};

const DESTINATIONS: readonly CreativeDestination[] = CREATIVE_DESTINATION_KEYS;

/**
 * Editor view preferences stored alongside creative settings for continuity,
 * but excluded from change accounting: toggling a guide overlay is not a
 * creative change, must not dirty the session, and must never create a
 * Creative History version.
 */
export const EPHEMERAL_CREATIVE_SETTING_KEYS = [
  "safeAreaVisible",
  "bleedVisible",
  "qrMinimumVisible",
] as const satisfies readonly (keyof CreativeSettings)[];

function stripEphemeralCreativeSettings(settings: CreativeSettings): CreativeSettings {
  const material = { ...settings };
  for (const key of EPHEMERAL_CREATIVE_SETTING_KEYS) material[key] = DEFAULT_CREATIVE_SETTINGS[key];
  return material;
}

function stripEphemeralWorkshopState(state: CreativeWorkshopState): CreativeWorkshopState {
  const overrides: CreativeWorkshopState["overrides"] = {};
  for (const destination of DESTINATIONS) {
    const override = state.overrides[destination];
    if (override) overrides[destination] = stripEphemeralCreativeSettings(override);
  }
  return { ...state, global: stripEphemeralCreativeSettings(state.global), overrides };
}

const ELEMENT_LABELS: Record<Exclude<CreativeElementKey, null>, string> = {
  image: "Image",
  logo: "Logo",
  "business-name": "Business name",
  headline: "Headline",
  offer: "Offer",
  cta: "Call to action",
  qr: "QR code",
  expiration: "Expiration",
  phone: "Phone",
  website: "Website",
  "sponsor-badge": "Sponsor badge",
  overlay: "Overlay",
};

const ELEMENT_INSPECTORS: Record<Exclude<CreativeElementKey, null>, CreativeInspectorSection> = {
  image: "Image",
  logo: "Branding",
  "business-name": "Text",
  headline: "Text",
  offer: "Text",
  cta: "Text",
  qr: "QR",
  expiration: "Text",
  phone: "Text",
  website: "Text",
  "sponsor-badge": "Visibility",
  overlay: "Overlay",
};

const SECTION_KEYS: Record<CreativeResetSection, readonly (keyof CreativeSettings)[]> = {
  image: [
    "imageAssetId",
    "imageFit",
    "imagePositionX",
    "imagePositionY",
    "imageZoom",
    "rotation",
    "brightness",
    "contrast",
    "saturation",
    "blur",
  ],
  overlay: [
    "overlayEnabled",
    "overlayStyle",
    "overlayColor",
    "overlayOpacity",
    "overlayDirection",
    "overlaySpread",
  ],
  qr: ["qrId", "showQr"],
  text: ["headlineSize", "textAlign", "textPanel"],
  branding: ["theme", "primaryColorOverride", "accentColorOverride"],
  visibility: [
    "showLogo",
    "showBusinessName",
    "showHeadline",
    "showOffer",
    "showCta",
    "showQr",
    "showExpiration",
    "showPhone",
    "showWebsite",
    "showSponsorBadge",
  ],
  "print-safety": ["safeAreaVisible", "bleedVisible", "qrMinimumVisible"],
};

const SETTING_CHANGE_LABELS: readonly {
  keys: readonly (keyof CreativeSettings)[];
  label: string;
}[] = [
  { keys: ["template"], label: "Template" },
  { keys: ["imageAssetId"], label: "Image asset" },
  { keys: ["imageFit"], label: "Image fit" },
  { keys: ["imagePositionX", "imagePositionY"], label: "Image position" },
  { keys: ["imageZoom"], label: "Image zoom" },
  { keys: ["rotation"], label: "Image rotation" },
  { keys: ["brightness"], label: "Brightness" },
  { keys: ["contrast"], label: "Contrast" },
  { keys: ["saturation"], label: "Saturation" },
  { keys: ["blur"], label: "Blur" },
  { keys: ["overlayEnabled"], label: "Overlay visibility" },
  { keys: ["overlayStyle"], label: "Overlay style" },
  { keys: ["overlayColor"], label: "Overlay color" },
  { keys: ["overlayOpacity"], label: "Overlay opacity" },
  { keys: ["overlayDirection"], label: "Overlay direction" },
  { keys: ["overlaySpread"], label: "Overlay spread" },
  { keys: ["qrId"], label: "QR selection" },
  { keys: ["showQr"], label: "QR visibility" },
  { keys: ["headlineSize"], label: "Headline size" },
  { keys: ["textAlign"], label: "Text alignment" },
  { keys: ["textPanel"], label: "Text treatment" },
  { keys: ["theme"], label: "Color theme" },
  { keys: ["primaryColorOverride"], label: "Primary color" },
  { keys: ["accentColorOverride"], label: "Accent color" },
  { keys: ["showLogo"], label: "Logo visibility" },
  { keys: ["showBusinessName"], label: "Business-name visibility" },
  { keys: ["showHeadline"], label: "Headline visibility" },
  { keys: ["showOffer"], label: "Offer visibility" },
  { keys: ["showCta"], label: "CTA visibility" },
  { keys: ["showExpiration"], label: "Expiration visibility" },
  { keys: ["showPhone"], label: "Phone visibility" },
  { keys: ["showWebsite"], label: "Website visibility" },
  { keys: ["showSponsorBadge"], label: "Sponsor-badge visibility" },
];

/** Material (non-ephemeral) setting keys owned by an inspector reset section. */
export function creativeSectionKeys(
  section: CreativeResetSection,
): readonly (keyof CreativeSettings)[] {
  return SECTION_KEYS[section];
}

/**
 * Lists the material settings on a destination override that differ from the
 * global baseline. Ephemeral editor preferences and the schema version are
 * never reported, so the result is exactly the set of fields the override
 * detaches from Global.
 */
export function listOverriddenCreativeSettingKeys(
  override: CreativeSettings,
  baseline: CreativeSettings,
): (keyof CreativeSettings)[] {
  const normalizedOverride = normalizeCreativeSettings(override);
  const normalizedBaseline = normalizeCreativeSettings(baseline);
  return (Object.keys(normalizedOverride) as (keyof CreativeSettings)[]).filter(key =>
    key !== "version"
    && !(EPHEMERAL_CREATIVE_SETTING_KEYS as readonly string[]).includes(key)
    && stableSerializeCreativeValue(normalizedOverride[key])
      !== stableSerializeCreativeValue(normalizedBaseline[key]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalize(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map(item => canonicalize(item, seen));
  if (!isRecord(value)) return null;
  if (seen.has(value)) throw new TypeError("Creative settings cannot contain circular references.");
  seen.add(value);
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (item === undefined || typeof item === "function" || typeof item === "symbol") continue;
    result[key] = canonicalize(item, seen);
  }
  seen.delete(value);
  return result;
}

function fingerprintPayload(value: unknown) {
  const bytes = new TextEncoder().encode(stableSerializeCreativeValue(value));
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `cw1-${hash.toString(16).padStart(16, "0")}`;
}

function fieldChanged(
  previous: CreativeSettings,
  next: CreativeSettings,
  keys: readonly (keyof CreativeSettings)[],
) {
  return keys.some(key => stableSerializeCreativeValue(previous[key]) !== stableSerializeCreativeValue(next[key]));
}

export function resolveEffectiveCreativeDestination(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
) {
  return {
    formatKey: resolveCreativeFormat(state, destination),
    settings: resolveCreativeSettings(state, destination),
  };
}

export function stableSerializeCreativeValue(value: unknown) {
  return JSON.stringify(canonicalize(value, new WeakSet<object>()));
}

export function resolveCreativeFormat(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
): CreativeFormatKey {
  return normalizeCreativeFormat(destination, state.formats?.[destination]);
}

export function isEffectiveCreativeDestinationUnsaved(
  saved: CreativeWorkshopState,
  current: CreativeWorkshopState,
  destination: CreativeDestination,
) {
  const definition = (state: CreativeWorkshopState) => {
    const effective = resolveEffectiveCreativeDestination(state, destination);
    return {
      ...effective,
      settings: stripEphemeralCreativeSettings(effective.settings),
      hasDestinationOverride: Object.prototype.hasOwnProperty.call(state.overrides, destination),
    };
  };
  return stableSerializeCreativeValue(definition(saved))
    !== stableSerializeCreativeValue(definition(current));
}

export function updateCreativeFormat(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
  formatKey: unknown,
): CreativeWorkshopState {
  const nextFormat = normalizeCreativeFormat(destination, formatKey);
  if (resolveCreativeFormat(state, destination) === nextFormat) return state;
  return {
    ...state,
    formats: {
      ...state.formats,
      [destination]: nextFormat,
    },
  };
}

export function createCreativeVersionSnapshot(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
  scope: CreativeScope,
): CreativeVersionSnapshot {
  return {
    version: 1,
    destination,
    scope,
    formatKey: resolveCreativeFormat(state, destination),
    settings: normalizeCreativeSettings(
      scope === "destination"
        ? state.overrides[destination] ?? resolveCreativeSettings(state, destination)
        : state.global,
    ),
  };
}

export function parseCreativeVersionSnapshot(value: unknown): CreativeVersionSnapshot | null {
  let input: unknown = value;
  if (typeof input === "string") {
    try {
      input = JSON.parse(input) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(input) || (input.version !== undefined && input.version !== 1)) return null;
  const destination = input.destination;
  if (!isCreativeDestination(destination)) return null;
  const resolvedDestination = destination;
  const scopeCandidate = input.scope ?? input.destination_scope;
  if (scopeCandidate !== "global" && scopeCandidate !== "destination") return null;
  const settingsCandidate = input.settings ?? input.settings_snapshot;
  if (!isRecord(settingsCandidate)) return null;
  const formatCandidate = input.formatKey ?? input.format_key;
  return {
    version: 1,
    destination: resolvedDestination,
    scope: scopeCandidate,
    formatKey: normalizeCreativeFormat(resolvedDestination, formatCandidate),
    settings: normalizeCreativeSettings(settingsCandidate),
    ...(typeof input.hasDestinationOverride === "boolean"
      ? { hasDestinationOverride: input.hasDestinationOverride }
      : {}),
  };
}

export function serializeCreativeVersionSnapshot(snapshot: CreativeVersionSnapshot) {
  return stableSerializeCreativeValue({
    ...snapshot,
    formatKey: normalizeCreativeFormat(snapshot.destination, snapshot.formatKey),
    settings: normalizeCreativeSettings(snapshot.settings),
  });
}

export function fingerprintCreativeSettings(settings: CreativeSettings) {
  return fingerprintPayload(stripEphemeralCreativeSettings(normalizeCreativeSettings(settings)));
}

export function fingerprintCreativeSnapshot(snapshot: CreativeVersionSnapshot) {
  const canonical = JSON.parse(serializeCreativeVersionSnapshot(snapshot)) as CreativeVersionSnapshot;
  return fingerprintPayload({
    ...canonical,
    settings: stripEphemeralCreativeSettings(normalizeCreativeSettings(canonical.settings)),
  });
}

export function fingerprintCreativeWorkshopState(state: CreativeWorkshopState) {
  return fingerprintPayload(stripEphemeralWorkshopState(normalizeWorkshopState(state)));
}

export function shouldCreateCreativeVersion(
  latest: CreativeVersionSnapshot | null | undefined,
  next: CreativeVersionSnapshot,
) {
  return !latest || fingerprintCreativeSnapshot(latest) !== fingerprintCreativeSnapshot(next);
}

export function listMaterialCreativeChanges(
  previous: CreativeVersionSnapshot | null | undefined,
  next: CreativeVersionSnapshot,
): string[] {
  if (!previous) return ["Initial creative version"];
  const changes: string[] = [];
  if (previous.destination !== next.destination) changes.push("Destination");
  if (previous.scope !== next.scope) changes.push("Destination scope");
  if (previous.formatKey !== next.formatKey) changes.push("Format");
  const previousSettings = normalizeCreativeSettings(previous.settings);
  const nextSettings = normalizeCreativeSettings(next.settings);
  for (const group of SETTING_CHANGE_LABELS) {
    if (fieldChanged(previousSettings, nextSettings, group.keys)) changes.push(group.label);
  }
  return changes;
}

export function createCreativeChangeSummary(
  previous: CreativeVersionSnapshot | null | undefined,
  next: CreativeVersionSnapshot,
  visibleChangeLimit = 4,
) {
  const changes = listMaterialCreativeChanges(previous, next);
  if (changes.length === 0) return "No material changes";
  if (changes[0] === "Initial creative version") return changes[0];
  const safeLimit = Math.max(1, Math.floor(visibleChangeLimit));
  const visible = changes.slice(0, safeLimit);
  const remainder = changes.length - visible.length;
  return `Changed: ${visible.join(", ")}${remainder > 0 ? ` +${remainder} more` : ""}`;
}

export function classifyCreativeChanges(
  previous: CreativeWorkshopState,
  next: CreativeWorkshopState,
): CreativeChangeClassification {
  const materialDefinition = (state: CreativeWorkshopState, destination: CreativeDestination) => {
    const effective = resolveEffectiveCreativeDestination(state, destination);
    return { ...effective, settings: stripEphemeralCreativeSettings(effective.settings) };
  };
  const destinations = DESTINATIONS.filter(destination =>
    stableSerializeCreativeValue(materialDefinition(previous, destination))
      !== stableSerializeCreativeValue(materialDefinition(next, destination)));
  const printChanged = destinations.some(destination =>
    getCreativeDestinationCapabilities(destination).affectsPrint);
  const unchanged = destinations.length === 0;
  return {
    impact: unchanged ? "unchanged" : printChanged ? "print-affecting" : "digital-only",
    affectsPrint: printChanged,
    digitalOnly: !unchanged && !printChanged,
    createsOverride: destinations.some(destination =>
      previous.overrides[destination] === undefined && next.overrides[destination] !== undefined),
    destinations,
  };
}

export function getCreativeElementLabel(element: CreativeElementKey) {
  return element ? ELEMENT_LABELS[element] : null;
}

export function getInspectorSectionForElement(
  element: CreativeElementKey,
): CreativeInspectorSection | null {
  return element ? ELEMENT_INSPECTORS[element] : null;
}

export function isCreativeElementVisible(
  element: CreativeElementKey,
  settings: CreativeSettings,
) {
  if (!element) return false;
  if (element === "image") return true;
  if (element === "overlay") return settings.overlayEnabled;
  if (element === "logo") return settings.showLogo;
  if (element === "business-name") return settings.showBusinessName;
  if (element === "headline") return settings.showHeadline;
  if (element === "offer") return settings.showOffer;
  if (element === "cta") return settings.showCta;
  if (element === "qr") return settings.showQr;
  if (element === "expiration") return settings.showExpiration;
  if (element === "phone") return settings.showPhone;
  if (element === "website") return settings.showWebsite;
  return settings.showSponsorBadge;
}

export function reconcileCreativeSelection(
  selection: CreativeElementKey,
  settings: CreativeSettings,
  availableElements?: readonly NonNullable<CreativeElementKey>[],
): CreativeElementKey {
  if (!selection || !isCreativeElementVisible(selection, settings)) return null;
  return availableElements && !availableElements.includes(selection) ? null : selection;
}

export function resetCreativeSettingsSection(
  current: CreativeSettings,
  section: CreativeResetSection,
  baseline: CreativeSettings = DEFAULT_CREATIVE_SETTINGS,
) {
  const patch = Object.fromEntries(
    SECTION_KEYS[section].map(key => [key, baseline[key]]),
  ) as Partial<CreativeSettings>;
  return normalizeCreativeSettings({ ...current, ...patch });
}

export function sectionResetRequiresMailerQrPreservation(
  section: CreativeResetSection,
  destination: CreativeDestination,
  scope: CreativeScope,
) {
  return (section === "qr" || section === "visibility")
    && (getCreativeDestinationCapabilities(destination).requiresQr || scope === "global");
}

export function resetCreativeSectionInState(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
  scope: CreativeScope,
  section: CreativeResetSection,
): CreativeWorkshopState {
  if (scope === "global") {
    return {
      ...state,
      global: enforceCreativeQrRestrictions(
        resetCreativeSettingsSection(state.global, section),
        destination,
      ),
    };
  }
  const current = resolveCreativeSettings(state, destination);
  const reset = enforceCreativeQrRestrictions(
    resetCreativeSettingsSection(current, section, state.global),
    destination,
  );
  return {
    ...state,
    overrides: {
      ...state.overrides,
      [destination]: reset,
    },
  };
}

export function resetAllCreativeSettings() {
  return normalizeWorkshopState(DEFAULT_WORKSHOP_STATE);
}

export function projectOriginalCreativeTreatment(settings: CreativeSettings) {
  return normalizeCreativeSettings({
    ...settings,
    imagePositionX: DEFAULT_CREATIVE_SETTINGS.imagePositionX,
    imagePositionY: DEFAULT_CREATIVE_SETTINGS.imagePositionY,
    imageZoom: DEFAULT_CREATIVE_SETTINGS.imageZoom,
    rotation: DEFAULT_CREATIVE_SETTINGS.rotation,
    brightness: DEFAULT_CREATIVE_SETTINGS.brightness,
    contrast: DEFAULT_CREATIVE_SETTINGS.contrast,
    saturation: DEFAULT_CREATIVE_SETTINGS.saturation,
    blur: DEFAULT_CREATIVE_SETTINGS.blur,
    overlayEnabled: false,
  });
}

export function createBeforeAfterProjection(settings: CreativeSettings) {
  const after = normalizeCreativeSettings(settings);
  return {
    before: projectOriginalCreativeTreatment(after),
    after,
  };
}

export function restoreCreativeVersionState(
  current: CreativeWorkshopState,
  snapshot: CreativeVersionSnapshot,
  options: CreativeRestoreOptions = {},
): CreativeWorkshopState {
  const destination = options.destination ?? snapshot.destination;
  const scope = options.scope ?? snapshot.scope;
  const settings = enforceCreativeQrRestrictions(snapshot.settings, destination);
  const stateWithFormat = updateCreativeFormat(current, destination, snapshot.formatKey);
  if (scope === "global") {
    return {
      ...stateWithFormat,
      global: settings,
    };
  }
  if (snapshot.hasDestinationOverride === false) {
    const overrides = { ...stateWithFormat.overrides };
    delete overrides[destination];
    return { ...stateWithFormat, overrides };
  }
  return {
    ...stateWithFormat,
    overrides: {
      ...stateWithFormat.overrides,
      [destination]: settings,
    },
  };
}

export function restoreCreativeVersion(
  history: CreativeHistory<CreativeWorkshopState>,
  snapshot: CreativeVersionSnapshot,
  options: CreativeRestoreOptions = {},
) {
  return pushHistory(history, restoreCreativeVersionState(history.present, snapshot, options));
}

export function isCreativeWorkshopUnsaved(
  saved: CreativeWorkshopState,
  current: CreativeWorkshopState,
) {
  return fingerprintCreativeWorkshopState(saved) !== fingerprintCreativeWorkshopState(current);
}

export const MIN_DIGITAL_QR_OPACITY = 60;

export function canHideCreativeQr(destination: CreativeDestination) {
  return !getCreativeDestinationCapabilities(destination).requiresQr;
}

export function restrictCreativeQrOpacity(destination: CreativeDestination, value: unknown) {
  if (getCreativeDestinationCapabilities(destination).requiresQr) return 100;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 100;
  return Math.min(100, Math.max(MIN_DIGITAL_QR_OPACITY, numeric));
}

export function prepareCreativeSettingsForDestination(
  settings: CreativeSettings,
  destination: CreativeDestination,
) {
  const normalized = normalizeCreativeSettings(settings);
  return enforceCreativeQrRestrictions({
    ...normalized,
    template: !getCreativeDestinationCapabilities(destination).allowsFeaturedSponsor
      && normalized.template === "featured-sponsor"
      ? DEFAULT_CREATIVE_SETTINGS.template
      : normalized.template,
  }, destination);
}

export function enforceCreativeQrRestrictions(
  settings: CreativeSettings,
  destination: CreativeDestination,
) {
  const normalized = normalizeCreativeSettings(settings);
  if (
    !getCreativeDestinationCapabilities(destination).requiresQr
    || !normalized.qrId
    || normalized.showQr
  ) return normalized;
  return {
    ...normalized,
    showQr: true,
  };
}

export function isCreativeQrUsable(
  qr: {
    owner_user_id: string | null;
    status: string;
    expires_at: string | null;
    logo_data_url?: unknown;
    outer_background_image_data_url?: unknown;
    rim_band_image_data_url?: unknown;
  } | null | undefined,
  ownerId: string,
  now = Date.now(),
) {
  if (!qr || qr.owner_user_id !== ownerId || qr.status !== "active") return false;
  if (!qr.expires_at) return true;
  const expiresAt = Date.parse(qr.expires_at);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

export function isCreativeQrUsableForCampaign(
  qr: {
    owner_user_id: string | null;
    business_id: string | null;
    destination_type: string;
    destination_id: string | null;
    status: string;
    expires_at: string | null;
    logo_data_url?: unknown;
    outer_background_image_data_url?: unknown;
    rim_band_image_data_url?: unknown;
  } | null | undefined,
  campaign: {
    id: string;
    ownerId: string;
    businessId: string | null | undefined;
  },
  now = Date.now(),
) {
  return Boolean(
    campaign.businessId
    && isCreativeQrUsable(qr, campaign.ownerId, now)
    && qr?.business_id === campaign.businessId
    && qr.destination_type === "campaign"
    && qr.destination_id === campaign.id
    && getQrEmbeddedArtworkBytes(qr) <= MAX_QR_EMBEDDED_ARTWORK_BYTES
  );
}
