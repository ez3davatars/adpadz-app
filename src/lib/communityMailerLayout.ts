import {
  EDDM_CENTER_BAND_HEIGHT_PERCENT,
  EDDM_CENTER_BAND_TOP_PERCENT,
} from "./communityCards";
import { COMMUNITY_MAILER_GEOMETRY } from "./communityMailerProductionContracts";
import type {
  CommunityCardFormat,
  CommunityCardRecord,
  CommunityCardSide,
  CommunityCardSlotStatus,
} from "./communityCards";
export type CommunityMailerMode =
  | "admin-edit"
  | "business-review"
  | "public-booking"
  | "print-preview";
export type CommunityMailerRenderRecord =
  & Pick<
    CommunityCardRecord,
    "id" | "title" | "zone_name" | "format" | "sales_open"
  >
  & {
    consumer_headline?: string | null;
    layout_locked?: boolean;
    discovery_qr_destination_url?: string | null;
  };
export type PlacementType =
  | "standard"
  | "mini"
  | "wide"
  | "tall"
  | "large"
  | "featured"
  | "ribbon"
  | "brand"
  | "adpadz";
export type LayoutPlacement = {
  id: string;
  community_card_id: string;
  slot_key: string;
  label: string;
  side: CommunityCardSide;
  x: number;
  y: number;
  width: number;
  height: number;
  price_cents: number;
  status: CommunityCardSlotStatus | "occupied" | "unavailable";
  advertiser_name: string | null;
  ad_image_url: string | null;
  placement_type: PlacementType;
  placement_tier: string;
  z_index: number;
  template_index?: number | null;
  is_featured: boolean;
  is_locked: boolean;
  discount_cents: number;
  category_exclusive: boolean;
  public_creative_visible?: boolean;
  buyer_user_id?: string | null;
  created_at?: string;
  updated_at?: string;
  business_id?: string | null;
  campaign_id?: string | null;
  business_name?: string | null;
  creative_asset_id?: string | null;
  creative_asset_url?: string | null;
  qr_link_id?: string | null;
  qr_title?: string | null;
  qr_destination_url?: string | null;
  payment_status?: string;
  proof_status?: string;
  production_status?: string;
  offer_text?: string | null;
  category?: string | null;
  internal_notes?: string | null;
};
export type MailerLayout = {
  mailer: Pick<CommunityCardRecord, "format" | "mailing_date"> & {
    layout_locked?: boolean;
    consumer_headline?: string | null;
  };
  placements: LayoutPlacement[];
};
export type LayoutIssue = {
  code:
    | "out_of_bounds"
    | "overlap"
    | "duplicate_featured"
    | "missing_brand_area"
    | "missing_creative"
    | "missing_business"
    | "invalid_side"
    | "invalid_dimensions"
    | "unpriced_inventory"
    | "invalid_discount"
    | "category_conflict"
    | "missing_mailing_date";
  placementId?: string;
  message: string;
};
export type SaveStatus = "saved" | "dirty" | "saving" | "error";
export type LayoutSaveState = {
  status: SaveStatus;
  revision: number;
  savedRevision: number;
  pendingRevision: number | null;
  error: string | null;
};
export const MODE_PERMISSIONS: Record<
  CommunityMailerMode,
  {
    select: boolean;
    book: boolean;
    move: boolean;
    resize: boolean;
    mutate: boolean;
    internal: boolean;
  }
> = {
  "admin-edit": {
    select: true,
    book: false,
    move: true,
    resize: true,
    mutate: true,
    internal: true,
  },
  "business-review": {
    select: true,
    book: false,
    move: false,
    resize: false,
    mutate: false,
    internal: false,
  },
  "public-booking": {
    select: true,
    book: true,
    move: false,
    resize: false,
    mutate: false,
    internal: false,
  },
  "print-preview": {
    select: false,
    book: false,
    move: false,
    resize: false,
    mutate: false,
    internal: false,
  },
};
export type PlacementLibraryItem = {
  label: string;
  width: number;
  height: number;
  priceCents: number;
  featured: boolean;
  sides: CommunityCardSide[];
  multiple: boolean;
  categoryExclusivity: boolean;
};
export const MAILER_ASPECT_RATIOS = {
  postcard_9x12: COMMUNITY_MAILER_GEOMETRY.postcard_9x12.finishedWidthInches / COMMUNITY_MAILER_GEOMETRY.postcard_9x12.finishedHeightInches,
  community_card_6x11: COMMUNITY_MAILER_GEOMETRY.community_card_6x11.finishedWidthInches / COMMUNITY_MAILER_GEOMETRY.community_card_6x11.finishedHeightInches,
} as const;

const productionGeometry9x12 = COMMUNITY_MAILER_GEOMETRY.postcard_9x12;
export const EDDM_12X9_GEOMETRY = {
  dpi: productionGeometry9x12.dpi,
  bleedWidthInches: productionGeometry9x12.bleedWidthInches,
  bleedHeightInches: productionGeometry9x12.bleedHeightInches,
  trimWidthInches: productionGeometry9x12.finishedWidthInches,
  trimHeightInches: productionGeometry9x12.finishedHeightInches,
  bleedInsetInches: (productionGeometry9x12.bleedWidthInches - productionGeometry9x12.finishedWidthInches) / 2,
  safeInsetFromTrimInches: productionGeometry9x12.safeInsetInches,
} as const;

export const EDDM_12X9_PERCENTAGES = {
  trimLeft: EDDM_12X9_GEOMETRY.bleedInsetInches /
    EDDM_12X9_GEOMETRY.bleedWidthInches * 100,
  trimTop: EDDM_12X9_GEOMETRY.bleedInsetInches /
    EDDM_12X9_GEOMETRY.bleedHeightInches * 100,
  trimWidth: EDDM_12X9_GEOMETRY.trimWidthInches /
    EDDM_12X9_GEOMETRY.bleedWidthInches * 100,
  trimHeight: EDDM_12X9_GEOMETRY.trimHeightInches /
    EDDM_12X9_GEOMETRY.bleedHeightInches * 100,
  safeLeft: (EDDM_12X9_GEOMETRY.bleedInsetInches +
    EDDM_12X9_GEOMETRY.safeInsetFromTrimInches) /
    EDDM_12X9_GEOMETRY.bleedWidthInches * 100,
  safeTop: (EDDM_12X9_GEOMETRY.bleedInsetInches +
    EDDM_12X9_GEOMETRY.safeInsetFromTrimInches) /
    EDDM_12X9_GEOMETRY.bleedHeightInches * 100,
  safeWidth: (EDDM_12X9_GEOMETRY.trimWidthInches -
    EDDM_12X9_GEOMETRY.safeInsetFromTrimInches * 2) /
    EDDM_12X9_GEOMETRY.bleedWidthInches * 100,
  safeHeight: (EDDM_12X9_GEOMETRY.trimHeightInches -
    EDDM_12X9_GEOMETRY.safeInsetFromTrimInches * 2) /
    EDDM_12X9_GEOMETRY.bleedHeightInches * 100,
} as const;
export const PLACEMENT_LIBRARY: Record<
  Exclude<PlacementType, "brand" | "adpadz">,
  PlacementLibraryItem
> = {
  standard: {
    label: "Standard",
    width: 21.1,
    height: 38.9,
    priceCents: 25000,
    featured: false,
    sides: ["front", "back"],
    multiple: true,
    categoryExclusivity: true,
  },
  mini: {
    label: "Mini",
    width: 16,
    height: 24,
    priceCents: 15000,
    featured: false,
    sides: ["front", "back"],
    multiple: true,
    categoryExclusivity: false,
  },
  wide: {
    label: "Wide",
    width: 44,
    height: 26,
    priceCents: 45000,
    featured: false,
    sides: ["front", "back"],
    multiple: true,
    categoryExclusivity: true,
  },
  tall: {
    label: "Tall",
    width: 21.1,
    height: 58,
    priceCents: 40000,
    featured: false,
    sides: ["front", "back"],
    multiple: true,
    categoryExclusivity: true,
  },
  large: {
    label: "Large",
    width: 44,
    height: 58,
    priceCents: 75000,
    featured: false,
    sides: ["front", "back"],
    multiple: true,
    categoryExclusivity: true,
  },
  featured: {
    label: "Featured sponsor",
    width: 44,
    height: 58,
    priceCents: 100000,
    featured: true,
    sides: ["front"],
    multiple: false,
    categoryExclusivity: true,
  },
  ribbon: {
    label: "Ribbon",
    width: 91,
    height: 14,
    priceCents: 50000,
    featured: false,
    sides: ["front", "back"],
    multiple: true,
    categoryExclusivity: true,
  },
};
export function placementDefinitionForFormat(
  type: Exclude<PlacementType, "brand" | "adpadz">,
  format: CommunityCardFormat,
): PlacementLibraryItem {
  const definition = PLACEMENT_LIBRARY[type];
  if (
    format === "postcard_9x12" &&
    ["tall", "large", "featured"].includes(type)
  ) {
    return { ...definition, height: 44 };
  }
  return definition;
}
const round = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
export function normalizeGeometry(
  r: Pick<LayoutPlacement, "x" | "y" | "width" | "height">,
) {
  return {
    x: round(r.x),
    y: round(r.y),
    width: round(r.width),
    height: round(r.height),
  };
}
export function constrainGeometry(
  r: Pick<LayoutPlacement, "x" | "y" | "width" | "height">,
) {
  const width = clamp(r.width, 1, 100), height = clamp(r.height, 1, 100);
  return {
    x: round(clamp(r.x, 0, 100 - width)),
    y: round(clamp(r.y, 0, 100 - height)),
    width: round(width),
    height: round(height),
  };
}
export const movePlacement = (
  p: LayoutPlacement,
  x: number,
  y: number,
): LayoutPlacement => ({ ...p, ...constrainGeometry({ ...p, x, y }) });
export const resizePlacement = (
  p: LayoutPlacement,
  width: number,
  height: number,
): LayoutPlacement => ({ ...p, ...constrainGeometry({ ...p, width, height }) });
export function placementsOverlap(a: LayoutPlacement, b: LayoutPlacement) {
  return a.side === b.side && a.id !== b.id && a.x < b.x + b.width &&
    a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
export const placementsForSide = (
  items: LayoutPlacement[],
  side: CommunityCardSide,
) =>
  items.filter((p) =>
    p.side === side && !["brand", "adpadz"].includes(p.placement_type)
  );
export const normalizeLayoutForSave = (items: LayoutPlacement[]) =>
  items.map((item) => ({
    id: item.id,
    side: item.side,
    ...normalizeGeometry(item),
    z_index: item.z_index,
  })).sort((first, second) => first.id.localeCompare(second.id));
export const layoutFingerprint = (items: LayoutPlacement[]) =>
  JSON.stringify(normalizeLayoutForSave(items));
export function canEditPlacement(
  mode: CommunityMailerMode,
  p: LayoutPlacement,
  locked = false,
) {
  return MODE_PERMISSIONS[mode].mutate && !locked && !p.is_locked &&
    !["brand", "adpadz"].includes(p.placement_type);
}
export function canDeletePlacement(
  mode: CommunityMailerMode,
  p: LayoutPlacement,
  locked = false,
) {
  return canEditPlacement(mode, p, locked) && p.status === "available" &&
    !p.business_id && !p.buyer_user_id;
}
export function canSelectPlacement(
  mode: CommunityMailerMode,
  p: LayoutPlacement,
  salesOpen = true,
) {
  if (!MODE_PERMISSIONS[mode].select) return false;
  if (mode === "business-review") return Boolean(p.business_id);
  return mode === "public-booking"
    ? salesOpen && p.status === "available"
    : true;
}
export function validateMailerLayout(layout: MailerLayout): LayoutIssue[] {
  const issues: LayoutIssue[] = [], ps = layout.placements;
  if (!layout.mailer.consumer_headline?.trim()) {
    issues.push({
      code: "missing_brand_area",
      message: "The required Adpadz brand headline is missing.",
    });
  }
  if (!layout.mailer.mailing_date) {
    issues.push({
      code: "missing_mailing_date",
      message: "Set a mailing date before production export.",
    });
  }
  if (
    ps.filter((p) => p.is_featured || p.placement_type === "featured").length >
      1
  ) {
    issues.push({
      code: "duplicate_featured",
      message: "Only one featured sponsor placement is allowed.",
    });
  }
  for (const p of ps) {
    const def = p.placement_type in PLACEMENT_LIBRARY
      ? PLACEMENT_LIBRARY[p.placement_type as keyof typeof PLACEMENT_LIBRARY]
      : undefined;
    if (
      ![p.x, p.y, p.width, p.height].every(Number.isFinite) || p.width <= 0 ||
      p.height <= 0
    ) {
      issues.push({
        code: "invalid_dimensions",
        placementId: p.id,
        message: `${p.label} has invalid dimensions.`,
      });
    }
    if (p.x < 0 || p.y < 0 || p.x + p.width > 100 || p.y + p.height > 100) {
      issues.push({
        code: "out_of_bounds",
        placementId: p.id,
        message: `${p.label} exceeds the mailer boundary.`,
      });
    }
    const crossesBrand = layout.mailer.format === "postcard_9x12"
      ? p.y < EDDM_CENTER_BAND_TOP_PERCENT + EDDM_CENTER_BAND_HEIGHT_PERCENT &&
        p.y + p.height > EDDM_CENTER_BAND_TOP_PERCENT
      : p.y < 31;
    if (!["brand", "adpadz"].includes(p.placement_type) && crossesBrand) {
      issues.push({
        code: "overlap",
        placementId: p.id,
        message: `${p.label} overlaps the protected Adpadz brand area.`,
      });
    }
    if (
      (def && !def.sides.includes(p.side)) ||
      (p.is_featured && p.side !== "front")
    ) {
      issues.push({
        code: "invalid_side",
        placementId: p.id,
        message: `${p.label} is not allowed on the ${p.side}.`,
      });
    }
    if (p.discount_cents < 0 || p.discount_cents > p.price_cents) {
      issues.push({
        code: "invalid_discount",
        placementId: p.id,
        message: `${p.label} has an invalid discount.`,
      });
    }
    if (p.status === "available" && p.price_cents - p.discount_cents <= 0) {
      issues.push({
        code: "unpriced_inventory",
        placementId: p.id,
        message: `${p.label} requires a positive net price.`,
      });
    }
    if (
      !["available", "unavailable"].includes(p.status) && !p.business_id &&
      !p.advertiser_name
    ) {
      issues.push({
        code: "missing_business",
        placementId: p.id,
        message: `${p.label} has no assigned business.`,
      });
    }
    if (
      !["available", "reserved", "unavailable"].includes(p.status) &&
      !p.ad_image_url && !p.creative_asset_url
    ) {
      issues.push({
        code: "missing_creative",
        placementId: p.id,
        message: `${p.label} is missing creative.`,
      });
    }
  }
  ps.forEach((a, i) =>
    ps.slice(i + 1).forEach((b) => {
      if (placementsOverlap(a, b)) {
        issues.push({
          code: "overlap",
          placementId: a.id,
          message: `${a.label} overlaps ${b.label}.`,
        });
      }
      if (
        a.category && b.category &&
        a.category.toLowerCase() === b.category.toLowerCase() &&
        (a.category_exclusive || b.category_exclusive) &&
        a.status !== "available" && b.status !== "available"
      ) {
        issues.push({
          code: "category_conflict",
          placementId: a.id,
          message: `${a.label} conflicts with an exclusive category.`,
        });
      }
    })
  );
  return issues;
}
export const createLayoutSaveState = (): LayoutSaveState => ({
  status: "saved",
  revision: 0,
  savedRevision: 0,
  pendingRevision: null,
  error: null,
});
export const markLayoutChanged = (s: LayoutSaveState): LayoutSaveState => ({
  ...s,
  status: s.status === "saving" ? "saving" : "dirty",
  revision: s.revision + 1,
  error: null,
});
export const beginLayoutSave = (s: LayoutSaveState): LayoutSaveState => ({
  ...s,
  status: "saving",
  pendingRevision: s.revision,
  error: null,
});
export function finishLayoutSave(
  s: LayoutSaveState,
  revision: number,
  error?: string,
): LayoutSaveState {
  if (s.pendingRevision !== revision) return s;
  if (error) return { ...s, status: "error", pendingRevision: null, error };
  return {
    ...s,
    status: s.revision > revision ? "dirty" : "saved",
    savedRevision: revision,
    pendingRevision: null,
    error: null,
  };
}
