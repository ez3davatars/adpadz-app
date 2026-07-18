export type CommunityCardFormat = "postcard_9x12" | "community_card_6x11";
export type CommunityCardSide = "front" | "back";
export type CommunityCardStatus =
  | "draft"
  | "selling"
  | "proof"
  | "approved"
  | "mailed"
  | "archived";
export type CommunityCardSlotStatus =
  | "available"
  | "reserved"
  | "sold"
  | "proof"
  | "approved"
  | "unavailable"
  | "intake";

export type CommunityCardRecord = {
  id: string;
  owner_id: string;
  title: string;
  zone_name: string | null;
  public_slug: string;
  format: CommunityCardFormat;
  layout_key: string;
  mailing_date: string | null;
  household_count: number | null;
  status: CommunityCardStatus;
  sales_open: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};
export type CommunityCardSlotRecord = {
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
  status: CommunityCardSlotStatus;
  advertiser_name: string | null;
  ad_image_url: string | null;
  buyer_user_id: string | null;
  created_at: string;
  updated_at: string;
};
export type CommunityCardLayout = {
  key: string;
  name: string;
  format: CommunityCardFormat;
  description: string;
  sellable_spaces: number;
  slots: Array<
    Omit<
      CommunityCardSlotRecord,
      | "id"
      | "community_card_id"
      | "advertiser_name"
      | "ad_image_url"
      | "buyer_user_id"
      | "created_at"
      | "updated_at"
    > & {
      template_index: number;
      placement_type: "standard" | "wide" | "large";
    }
  >;
};

const fixedSpot = (
  slot_key: string,
  label: string,
  side: CommunityCardSide,
  template_index: number,
  x: number,
  y: number,
  width: number,
  height: number,
  placement_type: "standard" | "wide" | "large",
): CommunityCardLayout["slots"][number] => ({
  slot_key,
  label,
  side,
  template_index,
  x,
  y,
  width,
  height,
  placement_type,
  price_cents: placement_type === "large"
    ? 100000
    : placement_type === "wide"
    ? 50000
    : 25000,
  status: "available",
});

export type CommunityMailerRowPattern =
  | "singles"
  | "double_left"
  | "double_center"
  | "double_right"
  | "double_pair"
  | "full";

const ROW_PATTERN_UNITS: Record<CommunityMailerRowPattern, number[]> = {
  singles: [1, 1, 1, 1],
  double_left: [2, 1, 1],
  double_center: [1, 2, 1],
  double_right: [1, 1, 2],
  double_pair: [2, 2],
  full: [4],
};
const BLEED_INSET = 0.75;
const GUTTER = 0.6;
const UNIT_WIDTH = (100 - BLEED_INSET * 2 - GUTTER * 3) / 4;
export const EDDM_POSTAL_BLOCK_WIDTH_PERCENT = 23.357;
export const EDDM_CENTER_BAND_HEIGHT_PERCENT = 9.815;
export const EDDM_CENTER_BAND_TOP_PERCENT =
  (100 - EDDM_CENTER_BAND_HEIGHT_PERCENT) / 2;
const ROW_HEIGHT = EDDM_CENTER_BAND_TOP_PERCENT - BLEED_INSET;
const BOTTOM_ROW_TOP = EDDM_CENTER_BAND_TOP_PERCENT +
  EDDM_CENTER_BAND_HEIGHT_PERCENT;

function fixedRowSlots(
  side: CommunityCardSide,
  row: "top" | "bottom",
  pattern: CommunityMailerRowPattern,
  indexOffset: number,
) {
  let unitStart = 0;
  return ROW_PATTERN_UNITS[pattern].map((unitCount, index) => {
    const x = BLEED_INSET + unitStart * (UNIT_WIDTH + GUTTER);
    const width = unitCount * UNIT_WIDTH + (unitCount - 1) * GUTTER;
    unitStart += unitCount;
    const placementType = unitCount === 4
      ? "large"
      : unitCount === 2
      ? "wide"
      : "standard";
    return fixedSpot(
      `${side}-${row}-${index + 1}`,
      `${side === "front" ? "Front" : "Back"} ${row} ${index + 1}`,
      side,
      indexOffset + index + 1,
      x,
      row === "top" ? BLEED_INSET : BOTTOM_ROW_TOP,
      width,
      ROW_HEIGHT,
      placementType,
    );
  });
}

export function fixedNineByTwelveSlots(
  side: CommunityCardSide,
  topPattern: CommunityMailerRowPattern,
  bottomPattern: CommunityMailerRowPattern,
) {
  return [
    ...fixedRowSlots(side, "top", topPattern, 0),
    ...fixedRowSlots(
      side,
      "bottom",
      bottomPattern,
      ROW_PATTERN_UNITS[topPattern].length,
    ),
  ];
}

const fixedNineByTwelve = (
  key: string,
  name: string,
  topPattern: CommunityMailerRowPattern,
  bottomPattern: CommunityMailerRowPattern,
): CommunityCardLayout => ({
  key,
  name,
  format: "postcard_9x12",
  sellable_spaces: fixedNineByTwelveSlots("front", topPattern, bottomPattern)
    .length * 2,
  description:
    "Edge-to-edge approved row grid with independently merged one-, two-, or four-unit placements.",
  slots: [
    ...fixedNineByTwelveSlots("front", topPattern, bottomPattern),
    ...fixedNineByTwelveSlots("back", topPattern, bottomPattern),
  ],
});

const nineByTwelveFlexible = fixedNineByTwelve(
  "community-appreciation-9x12-row-grid",
  "Community Appreciation - 9 x 12 row grid",
  "double_pair",
  "singles",
);
const sixByEleven: CommunityCardLayout = {
  key: "community-appreciation-6x11",
  name: "Community Appreciation - 6 x 11",
  format: "community_card_6x11",
  sellable_spaces: 8,
  description:
    "Four standard normalized spaces per side with a protected Adpadz identity and mailing area.",
  slots: [
    ...[0, 1, 2, 3].map((i) =>
      fixedSpot(
        `front-${i + 1}`,
        `Front ${i + 1}`,
        "front",
        i + 1,
        BLEED_INSET + i * (UNIT_WIDTH + GUTTER),
        33,
        UNIT_WIDTH,
        64,
        "standard",
      )
    ),
    ...[0, 1, 2, 3].map((i) =>
      fixedSpot(
        `back-${i + 1}`,
        `Back ${i + 1}`,
        "back",
        i + 1,
        BLEED_INSET + i * (UNIT_WIDTH + GUTTER),
        33,
        UNIT_WIDTH,
        64,
        "standard",
      )
    ),
  ],
};

export const COMMUNITY_CARD_LAYOUTS = [
  nineByTwelveFlexible,
  sixByEleven,
] as const;
const LEGACY_LAYOUT_KEYS: Record<string, CommunityCardLayout> = {
  "community-appreciation-9x12": nineByTwelveFlexible,
  "community-appreciation-9x12-double-top": nineByTwelveFlexible,
  "community-appreciation-9x12-double-bottom": nineByTwelveFlexible,
  "9x12-spotlight": nineByTwelveFlexible,
  "9x12-community-grid": nineByTwelveFlexible,
  "6x11-feature-grid": sixByEleven,
  "6x11-directory": sixByEleven,
};
export const getCommunityCardLayout = (key: string) =>
  COMMUNITY_CARD_LAYOUTS.find((layout) => layout.key === key) ??
    LEGACY_LAYOUT_KEYS[key];
export const getCommunityCardLayouts = (format: CommunityCardFormat) =>
  COMMUNITY_CARD_LAYOUTS.filter((layout) => layout.format === format);
export const formatCommunityCardFormat = (format: CommunityCardFormat) =>
  format === "postcard_9x12" ? "9 x 12 postcard" : "6 x 11 community card";
export const formatCurrency = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
export const slotPrice = (count: number) => count * 25000;
