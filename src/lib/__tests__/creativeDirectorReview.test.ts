import { describe, expect, it } from "vitest";
import {
  applyCreativeRecipe,
  hasAdvancedCreativeOverrides,
  optimizeCampaignCreative,
  selectCreativeRecipe,
  updateCreativeBrief,
} from "../../features/campaign-templates/creativeDirector";
import {
  DEFAULT_CREATIVE_SETTINGS,
  DEFAULT_WORKSHOP_STATE,
  normalizeWorkshopState,
  resolveCreativeSettings,
  updateCreativeSettings,
  type CreativeWorkshopState,
} from "../../features/campaign-templates/creativeWorkshop";
import {
  CREATIVE_DESTINATION_KEYS,
} from "../../features/campaign-templates/creativeDestinations";

function createState(): CreativeWorkshopState {
  return normalizeWorkshopState({
    ...DEFAULT_WORKSHOP_STATE,
    global: {
      ...DEFAULT_CREATIVE_SETTINGS,
      imageAssetId: "asset-hero",
      qrId: "qr-campaign",
      showQr: false,
    },
  });
}

describe("Creative Director review regressions", () => {
  it("keeps the default selected concept aligned with the default preview template", () => {
    const selection = DEFAULT_WORKSHOP_STATE.director.concepts.mailer;
    const applied = applyCreativeRecipe(
      DEFAULT_WORKSHOP_STATE.global,
      selection.recipeId,
      "mailer",
      DEFAULT_WORKSHOP_STATE.director.goal,
      DEFAULT_WORKSHOP_STATE.director.direction,
    );

    expect(selection.recipeId).toBe("cinematic");
    expect(applied.template).toBe(DEFAULT_WORKSHOP_STATE.global.template);
  });

  it("turns QR visibility back on for destinations where QR is optional", () => {
    const optimized = optimizeCampaignCreative(
      createState(),
      "discovery",
      "improve-qr-visibility",
    );

    expect(resolveCreativeSettings(optimized, "discovery")).toMatchObject({
      showQr: true,
      qrEmphasis: "prominent",
    });
  });

  it("applies a global brief change to every selected destination recipe", () => {
    let state = createState();
    state = selectCreativeRecipe(state, "mailer", "impact");
    state = selectCreativeRecipe(state, "discovery", "editorial");
    state = selectCreativeRecipe(state, "qr", "impact");
    state = selectCreativeRecipe(state, "social", "cinematic");
    state = optimizeCampaignCreative(state, "mailer", "simplify");
    state = optimizeCampaignCreative(state, "social", "improve-readability");

    const updated = updateCreativeBrief(state, {
      goal: "generate-calls",
      direction: "bold",
    });

    expect(updated.director.destination).toBe("social");
    expect(updated.director.goal).toBe("generate-calls");
    expect(updated.director.direction).toBe("bold");
    expect(
      Object.fromEntries(
        CREATIVE_DESTINATION_KEYS.map(destination => [
          destination,
          updated.director.concepts[destination].recipeId,
        ]),
      ),
    ).toEqual({
      mailer: "impact",
      discovery: "editorial",
      qr: "impact",
      social: "cinematic",
    });

    for (const destination of CREATIVE_DESTINATION_KEYS) {
      expect(updated.director.concepts[destination].refinements).toEqual([]);
      expect(resolveCreativeSettings(updated, destination)).toMatchObject({
        contrast: 122,
        showPhone: true,
        showDescription: false,
      });
    }
  });

  it("preserves Global inheritance when a brief changes", () => {
    const state = createState();
    const updated = updateCreativeBrief(state, {
      goal: "generate-calls",
      direction: "bold",
    });

    expect(updated.overrides).toEqual({});
    expect(updated.global).toMatchObject({
      template: "hero-visual",
      contrast: 122,
      showPhone: true,
      showDescription: false,
    });
    for (const destination of CREATIVE_DESTINATION_KEYS) {
      expect(resolveCreativeSettings(updated, destination)).toEqual(
        updated.global,
      );
    }
  });

  it("updates existing destination overrides without creating new ones", () => {
    const mailerOverride = selectCreativeRecipe(
      createState(),
      "mailer",
      "impact",
    );
    const updated = updateCreativeBrief(mailerOverride, {
      goal: "generate-calls",
    });

    expect(Object.keys(updated.overrides)).toEqual(["mailer"]);
    expect(resolveCreativeSettings(updated, "mailer")).toMatchObject({
      template: "offer-first",
      showPhone: true,
    });
    expect(resolveCreativeSettings(updated, "social")).toEqual(
      updated.global,
    );
    expect(updateCreativeBrief(updated, { goal: "generate-calls" })).toBe(
      updated,
    );
  });

  it("does not materialize new optional defaults when normalizing legacy settings", () => {
    const legacy = normalizeWorkshopState({
      global: {
        template: "hero-visual",
      },
      overrides: {},
    });

    expect(legacy.global).not.toHaveProperty("qrEmphasis");
    expect(legacy.global).not.toHaveProperty("showDescription");
  });

  it("distinguishes recorded Director refinements from same-template Advanced overrides", () => {
    const inferredLegacy = createState();
    const selected = selectCreativeRecipe(
      inferredLegacy,
      "mailer",
      "cinematic",
    );
    const refined = optimizeCampaignCreative(
      selected,
      "mailer",
      "improve-readability",
    );
    const customized = updateCreativeSettings(
      refined,
      "mailer",
      "destination",
      {
        brightness: 137,
        overlayOpacity: 41,
        showDescription: true,
      },
    );
    const guideOnly = updateCreativeSettings(
      refined,
      "mailer",
      "destination",
      { safeAreaVisible: true },
    );
    const featuredSponsor = updateCreativeSettings(
      selected,
      "mailer",
      "destination",
      { template: "featured-sponsor" },
    );

    expect(hasAdvancedCreativeOverrides(inferredLegacy, "mailer")).toBe(false);
    expect(hasAdvancedCreativeOverrides(selected, "mailer")).toBe(false);
    expect(hasAdvancedCreativeOverrides(refined, "mailer")).toBe(false);
    expect(hasAdvancedCreativeOverrides(guideOnly, "mailer")).toBe(false);
    expect(hasAdvancedCreativeOverrides(customized, "mailer")).toBe(true);
    expect(hasAdvancedCreativeOverrides(featuredSponsor, "mailer")).toBe(true);
    expect(
      hasAdvancedCreativeOverrides(
        selectCreativeRecipe(customized, "mailer", "cinematic"),
        "mailer",
      ),
    ).toBe(false);
  });

  it("does not treat preserved campaign references and crop as Advanced overrides", () => {
    const selected = selectCreativeRecipe(
      createState(),
      "mailer",
      "editorial",
    );
    const withReferences = updateCreativeSettings(
      selected,
      "mailer",
      "destination",
      {
        imageAssetId: "asset-reframed",
        imagePositionX: 19,
        imagePositionY: 73,
        imageZoom: 1.42,
        qrId: "qr-reframed",
        primaryColorOverride: "#112233",
        accentColorOverride: "#aabbcc",
        showExpiration: false,
      },
    );

    expect(hasAdvancedCreativeOverrides(withReferences, "mailer")).toBe(false);
  });
});
