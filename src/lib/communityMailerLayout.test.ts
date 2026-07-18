import { describe, expect, it } from "vitest";
import {
  EDDM_CENTER_BAND_HEIGHT_PERCENT,
  EDDM_CENTER_BAND_TOP_PERCENT,
  type CommunityCardRecord,
  fixedNineByTwelveSlots,
  getCommunityCardLayout,
} from "./communityCards";
import {
  beginLayoutSave,
  canDeletePlacement,
  canEditPlacement,
  canSelectPlacement,
  constrainGeometry,
  createLayoutSaveState,
  EDDM_12X9_GEOMETRY,
  EDDM_12X9_PERCENTAGES,
  finishLayoutSave,
  layoutFingerprint,
  type LayoutPlacement,
  MAILER_ASPECT_RATIOS,
  markLayoutChanged,
  normalizeGeometry,
  placementDefinitionForFormat,
  placementsForSide,
  placementsOverlap,
  validateMailerLayout,
} from "./communityMailerLayout";

const mailer: CommunityCardRecord & {
  consumer_headline: string;
  layout_locked: boolean;
} = {
  id: "mailer",
  owner_id: "owner",
  title: "Mailer",
  zone_name: "Zone",
  public_slug: "zone",
  format: "postcard_9x12",
  layout_key: "community-appreciation-9x12",
  mailing_date: null,
  household_count: 1000,
  status: "draft",
  sales_open: true,
  is_published: false,
  created_at: "",
  updated_at: "",
  consumer_headline: "Support Local. Save Local.",
  layout_locked: false,
};
function placement(overrides: Partial<LayoutPlacement> = {}): LayoutPlacement {
  return {
    id: "slot-a",
    community_card_id: "mailer",
    slot_key: "slot-a",
    label: "Slot A",
    side: "front",
    x: 3,
    y: 3,
    width: 20,
    height: 20,
    price_cents: 25000,
    status: "available",
    advertiser_name: null,
    ad_image_url: null,
    placement_type: "standard",
    placement_tier: "standard",
    z_index: 1,
    is_featured: false,
    is_locked: false,
    discount_cents: 0,
    category_exclusive: false,
    ...overrides,
  };
}

describe("Community Mailer geometry", () => {
  it.each(
    [
      ["singles", 4, [1, 1, 1, 1]],
      ["double_left", 3, [2, 1, 1]],
      ["double_center", 3, [1, 2, 1]],
      ["double_right", 3, [1, 1, 2]],
      ["double_pair", 2, [2, 2]],
      ["full", 1, [4]],
    ] as const,
  )("builds the approved %s row pattern", (pattern, count, units) => {
    const slots = fixedNineByTwelveSlots("front", pattern, "full");
    const top = slots.filter((slot) => slot.y === 0.75);
    expect(top).toHaveLength(count);
    expect(top.map((slot) => slot.price_cents / 25000)).toEqual(units);
    expect(Math.min(...top.map((slot) => slot.x))).toBe(0.75);
    expect(Math.max(...top.map((slot) => slot.x + slot.width))).toBeCloseTo(
      99.25,
    );
    expect(slots[slots.length - 1]?.placement_type).toBe("large");
    const bottom = slots.filter((slot) => slot.slot_key.includes("-bottom-"));
    expect(top[0]?.height).toBeCloseTo(44.3425, 4);
    expect(bottom[0]?.y).toBeCloseTo(54.9075, 4);
    expect(bottom[0]?.height).toBeCloseTo(44.3425, 4);
    expect(EDDM_CENTER_BAND_TOP_PERCENT).toBeCloseTo(45.0925, 4);
    expect(EDDM_CENTER_BAND_HEIGHT_PERCENT).toBeCloseTo(9.815, 4);
  });
  it("rounds persisted geometry without repairing invalid values", () => {
    expect(normalizeGeometry({ x: -0.0014, y: 99.9996, width: 0, height: 101 }))
      .toEqual({ x: -0.001, y: 100, width: 0, height: 101 });
  });
  it("constrains editor movement to normalized bounds", () => {
    expect(constrainGeometry({ x: -5, y: 95, width: 20, height: 20 })).toEqual({
      x: 0,
      y: 80,
      width: 20,
      height: 20,
    });
  });
  it("detects nested overlap but permits edge touch, opposite sides, and self", () => {
    const first = placement(),
      nested = placement({ id: "b", x: 5, y: 5, width: 5, height: 5 });
    expect(placementsOverlap(first, nested)).toBe(true);
    expect(placementsOverlap(first, placement({ id: "c", x: 23 }))).toBe(false);
    expect(placementsOverlap(first, placement({ id: "d", side: "back" }))).toBe(
      false,
    );
    expect(placementsOverlap(first, first)).toBe(false);
  });
  it("filters front and back while excluding legacy system brand rows", () => {
    const items = [
      placement(),
      placement({ id: "b", side: "back" }),
      placement({ id: "brand", placement_type: "adpadz" }),
    ];
    expect(placementsForSide(items, "front").map((item) => item.id)).toEqual([
      "slot-a",
    ]);
    expect(placementsForSide(items, "back").map((item) => item.id)).toEqual([
      "b",
    ]);
  });
});

describe("Community Mailer validation", () => {
  it("uses the physical landscape ratios", () => {
    expect(MAILER_ASPECT_RATIOS.postcard_9x12).toBe(4 / 3);
    expect(MAILER_ASPECT_RATIOS.community_card_6x11).toBe(11 / 6);
  });
  it("maps the verified EDDM 12x9 bleed, trim, and safe geometry", () => {
    expect(EDDM_12X9_GEOMETRY).toMatchObject({
      dpi: 300,
      bleedWidthInches: 12.25,
      bleedHeightInches: 9.25,
      trimWidthInches: 12,
      trimHeightInches: 9,
      bleedInsetInches: 0.125,
      safeInsetFromTrimInches: 0.125,
    });
    expect(EDDM_12X9_PERCENTAGES.trimLeft).toBeCloseTo(1.0204, 3);
    expect(EDDM_12X9_PERCENTAGES.trimTop).toBeCloseTo(1.3514, 3);
    expect(EDDM_12X9_PERCENTAGES.trimWidth).toBeCloseTo(97.9592, 3);
    expect(EDDM_12X9_PERCENTAGES.trimHeight).toBeCloseTo(97.2973, 3);
  });
  it("uses placement defaults that fit each format's protected brand area", () => {
    expect(
      placementDefinitionForFormat("featured", "postcard_9x12").height,
    ).toBeLessThanOrEqual(44);
    expect(
      placementDefinitionForFormat("featured", "community_card_6x11").height,
    ).toBe(58);
  });
  it("reports invalid dimensions, bounds, and the protected brand region", () => {
    const issues = validateMailerLayout({
      mailer,
      placements: [
        placement({ width: 0 }),
        placement({ id: "outside", x: 99, width: 2 }),
        placement({ id: "brand-cross", y: 47, height: 2 }),
      ],
    });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "invalid_dimensions",
        "out_of_bounds",
        "overlap",
      ]),
    );
  });
  it("reports missing brand identity and duplicate featured sponsors", () => {
    const issues = validateMailerLayout({
      mailer: { ...mailer, consumer_headline: "" },
      placements: [
        placement({ placement_type: "featured", is_featured: true }),
        placement({
          id: "featured-2",
          x: 25,
          placement_type: "featured",
          is_featured: true,
        }),
      ],
    });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["missing_brand_area", "duplicate_featured"]),
    );
  });
  it("reports assignment, creative, pricing, discount, and category conflicts", () => {
    const issues = validateMailerLayout({
      mailer,
      placements: [
        placement({ id: "free", price_cents: 0 }),
        placement({ id: "discount", x: 25, discount_cents: 30000 }),
        placement({
          id: "sold-a",
          x: 3,
          y: 60,
          status: "sold",
          category: "dentist",
          category_exclusive: true,
        }),
        placement({
          id: "sold-b",
          x: 25,
          y: 60,
          status: "sold",
          category: "Dentist",
          business_id: "business",
          ad_image_url: "https://example.com/ad.png",
        }),
      ],
    });
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "unpriced_inventory",
        "invalid_discount",
        "missing_business",
        "missing_creative",
        "category_conflict",
      ]),
    );
  });
});

describe("Community Mailer mode permissions", () => {
  it("allows only unlocked admin geometry edits", () => {
    expect(canEditPlacement("admin-edit", placement(), false)).toBe(true);
    expect(
      canEditPlacement("admin-edit", placement({ is_locked: true }), false),
    ).toBe(false);
    expect(canEditPlacement("admin-edit", placement(), true)).toBe(false);
    expect(canEditPlacement("business-review", placement(), false)).toBe(false);
    expect(canEditPlacement("print-preview", placement(), false)).toBe(false);
  });
  it("deletes only unused unlocked admin inventory", () => {
    expect(canDeletePlacement("admin-edit", placement(), false)).toBe(true);
    expect(
      canDeletePlacement(
        "admin-edit",
        placement({ status: "reserved" }),
        false,
      ),
    ).toBe(false);
    expect(
      canDeletePlacement(
        "admin-edit",
        placement({ business_id: "business" }),
        false,
      ),
    ).toBe(false);
  });
  it("limits public selection to open available inventory and business selection to owned rows", () => {
    expect(canSelectPlacement("public-booking", placement(), true)).toBe(true);
    expect(canSelectPlacement("public-booking", placement(), false)).toBe(
      false,
    );
    expect(
      canSelectPlacement(
        "public-booking",
        placement({ status: "occupied" }),
        true,
      ),
    ).toBe(false);
    expect(
      canSelectPlacement(
        "business-review",
        placement({ business_id: "owned" }),
      ),
    ).toBe(true);
    expect(canSelectPlacement("business-review", placement())).toBe(false);
    expect(canSelectPlacement("print-preview", placement())).toBe(false);
  });
});

describe("Community Mailer save and legacy compatibility", () => {
  it("keeps edits made during a save dirty after that save succeeds", () => {
    let state = markLayoutChanged(createLayoutSaveState());
    state = beginLayoutSave(state);
    const firstRevision = state.pendingRevision!;
    state = markLayoutChanged(state);
    state = finishLayoutSave(state, firstRevision);
    expect(state.status).toBe("dirty");
  });
  it("ignores stale responses after a newer save starts", () => {
    let state = markLayoutChanged(createLayoutSaveState());
    state = beginLayoutSave(state);
    const first = state.pendingRevision!;
    state = markLayoutChanged(state);
    state = beginLayoutSave(state);
    expect(finishLayoutSave(state, first)).toEqual(state);
  });
  it("normalizes ordering and sub-thousandth pointer jitter", () => {
    const first = placement(), second = placement({ id: "b", x: 25 });
    expect(layoutFingerprint([first, second])).toBe(
      layoutFingerprint([{ ...second, x: 25.0004 }, first]),
    );
    expect(layoutFingerprint([first, second])).not.toBe(
      layoutFingerprint([{ ...second, x: 25.001 }, first]),
    );
  });
  it.each([
    ["community-appreciation-9x12", "postcard_9x12"],
    ["9x12-spotlight", "postcard_9x12"],
    ["9x12-community-grid", "postcard_9x12"],
    ["community-appreciation-6x11", "community_card_6x11"],
    ["6x11-feature-grid", "community_card_6x11"],
    ["6x11-directory", "community_card_6x11"],
  ])("maps legacy layout key %s without guessing", (key, format) => {
    expect(getCommunityCardLayout(key)?.format).toBe(format);
  });
  it("does not silently replace an unknown layout", () => {
    expect(getCommunityCardLayout("unknown-layout")).toBeUndefined();
  });
});
