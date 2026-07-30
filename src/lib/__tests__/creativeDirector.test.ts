import { describe, expect, it } from "vitest";
import { canonicalCommunityMailerCreativePlacement } from "../communityMailerProductionContracts";
import {
  CREATIVE_RECIPES,
  applyCreativeRecipe,
  getDestinationSafeBounds,
  optimizeCampaignCreative,
  resetCreativeRefinements,
  selectCreativeDestination,
  selectCreativeRecipe,
} from "../../features/campaign-templates/creativeDirector";
import {
  CREATIVE_OPTIMIZER_ACTIONS,
  normalizeCreativeDirectorState,
  type CreativeOptimizerAction,
} from "../../features/campaign-templates/creativeDirectorSchema";
import {
  DEFAULT_CREATIVE_SETTINGS,
  DEFAULT_WORKSHOP_STATE,
  normalizeWorkshopState,
  resolveCreativeSettings,
  type CreativeSettings,
  type CreativeWorkshopState,
} from "../../features/campaign-templates/creativeWorkshop";
import {
  createDisplayHeadline,
  normalizeCampaignContent,
} from "../../features/campaign-templates/normalizeCampaignContent";
import { isCreativeWorkshopUnsaved } from "../../features/campaign-templates/creativeWorkshopState";
import type {
  CreativeDestination,
  CreativeFormatKey,
} from "../../features/campaign-templates/creativeDestinations";
import type { CampaignRecord } from "../ads";

const CONTENT_REFERENCES = {
  imageAssetId: "asset-hero-1",
  qrId: "qr-campaign-1",
  imagePositionX: 31,
  imagePositionY: 67,
  imageZoom: 1.24,
  primaryColorOverride: "#123456",
  accentColorOverride: "#abcdef",
  showExpiration: true,
} as const;

function createDirectorState(
  settings: Partial<CreativeSettings> = {},
): CreativeWorkshopState {
  return normalizeWorkshopState({
    ...DEFAULT_WORKSHOP_STATE,
    global: {
      ...DEFAULT_CREATIVE_SETTINGS,
      ...CONTENT_REFERENCES,
      ...settings,
    },
  });
}

function createCampaign(
  patch: Partial<CampaignRecord> = {},
): CampaignRecord {
  return {
    id: "campaign-1",
    owner_id: "owner-1",
    title: "Summer Tune-Up",
    headline: "Cool Comfort Starts Here",
    description: "Dependable local service for every season.",
    offer_title: "$49 Seasonal Tune-Up",
    offer_description: "New customers only.",
    cta_label: "Schedule today",
    cta_url: "https://example.com/schedule",
    status: "draft",
    ...patch,
  };
}

describe("Creative Director recipes", () => {
  it("selects a recipe for the active destination and clears stale refinements", () => {
    const state = createDirectorState();
    const refined = optimizeCampaignCreative(
      state,
      "mailer",
      "simplify",
    );
    const selected = selectCreativeRecipe(refined, "mailer", "cinematic");
    const settings = resolveCreativeSettings(selected, "mailer");

    expect(selected.director.destination).toBe("mailer");
    expect(selected.director.concepts.mailer).toEqual({
      recipeId: "cinematic",
      refinements: [],
    });
    expect(settings).toMatchObject({
      template: "hero-visual",
      theme: "dark",
      overlayEnabled: true,
      overlayStyle: "bottom-fade",
      imageAssetId: CONTENT_REFERENCES.imageAssetId,
      qrId: CONTENT_REFERENCES.qrId,
      showQr: true,
    });
    expect(state).toEqual(createDirectorState());
  });

  it("produces three compositionally distinct concepts from the same references", () => {
    const base = createDirectorState().global;
    const outputs = CREATIVE_RECIPES.map(recipe => ({
      id: recipe.id,
      composition: recipe.composition,
      settings: applyCreativeRecipe(
        base,
        recipe.id,
        "mailer",
        "promote-offer",
        "premium",
      ),
    }));

    expect(outputs.map(output => output.id)).toEqual([
      "editorial",
      "cinematic",
      "impact",
    ]);
    expect(new Set(outputs.map(output => output.settings.template))).toEqual(
      new Set(["brand-focus", "hero-visual", "offer-first"]),
    );
    expect(new Set(
      outputs.map(output => JSON.stringify(output.composition)),
    )).toHaveLength(3);
    expect(new Set(
      outputs.map(output => JSON.stringify({
        template: output.settings.template,
        theme: output.settings.theme,
        overlayEnabled: output.settings.overlayEnabled,
        overlayStyle: output.settings.overlayStyle,
        overlayOpacity: output.settings.overlayOpacity,
        textPanel: output.settings.textPanel,
        qrEmphasis: output.settings.qrEmphasis,
      })),
    )).toHaveLength(3);
    for (const output of outputs) {
      expect(output.settings).toMatchObject(CONTENT_REFERENCES);
      expect(output.settings.showQr).toBe(true);
    }
  });
});

describe("Creative Director optimizer", () => {
  const transformations: Array<[
    CreativeOptimizerAction,
    Partial<CreativeSettings>,
  ]> = [
    [
      "make-more-premium",
      {
        imageZoom: 1,
        contrast: 110,
        saturation: 92,
        overlayOpacity: 58,
        headlineSize: "large",
        textPanel: "none",
        showDescription: false,
        showPhone: false,
        showWebsite: false,
      },
    ],
    [
      "simplify",
      {
        showDescription: false,
        showPhone: false,
        showWebsite: false,
        textPanel: "none",
      },
    ],
    [
      "increase-stop-power",
      {
        headlineSize: "large",
        contrast: 128,
        saturation: 112,
        overlayEnabled: true,
        overlayOpacity: 72,
        showDescription: false,
        blur: 0,
      },
    ],
    [
      "improve-readability",
      {
        headlineSize: "medium",
        overlayEnabled: true,
        overlayOpacity: 78,
        contrast: 116,
        textAlign: "left",
        textPanel: "solid",
      },
    ],
    [
      "improve-qr-visibility",
      {
        showQr: true,
        qrEmphasis: "prominent",
      },
    ],
  ];

  it.each(transformations)(
    "applies the %s transformation immediately and preserves essentials",
    (action, expected) => {
      const state = createDirectorState({
        imageZoom: 1,
        headlineSize: "small",
        showLogo: false,
        showBusinessName: false,
        showHeadline: false,
        showOffer: false,
        showCta: false,
        showQr: false,
        showDescription: true,
        showPhone: true,
        showWebsite: true,
        blur: 5,
      });
      const once = optimizeCampaignCreative(state, "mailer", action);
      const twice = optimizeCampaignCreative(once, "mailer", action);
      const settings = resolveCreativeSettings(twice, "mailer");

      expect(settings).toMatchObject(expected);
      expect(settings).toMatchObject({
        imageAssetId: CONTENT_REFERENCES.imageAssetId,
        qrId: CONTENT_REFERENCES.qrId,
        showLogo: true,
        showBusinessName: true,
        showHeadline: true,
        showOffer: true,
        showCta: true,
        showQr: true,
        showExpiration: true,
      });
      expect(twice.director.concepts.mailer.refinements).toEqual([action]);
    },
  );

  it("covers every declared optimizer transformation", () => {
    expect(transformations.map(([action]) => action)).toEqual(
      CREATIVE_OPTIMIZER_ACTIONS,
    );
  });

  it("resets recipe refinements while preserving the concept and content references", () => {
    const selected = selectCreativeRecipe(
      createDirectorState(),
      "mailer",
      "impact",
    );
    const refined = optimizeCampaignCreative(
      optimizeCampaignCreative(selected, "mailer", "simplify"),
      "mailer",
      "improve-readability",
    );
    const reset = resetCreativeRefinements(refined, "mailer");
    const settings = resolveCreativeSettings(reset, "mailer");

    expect(reset.director.concepts.mailer).toEqual({
      recipeId: "impact",
      refinements: [],
    });
    expect(settings).toMatchObject({
      template: "offer-first",
      theme: "dark",
      overlayEnabled: true,
      overlayStyle: "linear",
      overlayOpacity: 82,
      textPanel: "solid",
      blur: 0,
      qrEmphasis: "prominent",
      showQr: true,
      ...CONTENT_REFERENCES,
    });
  });
});

describe("Creative Director compatibility and content safety", () => {
  it("normalizes older workshop data into safe recipe fallbacks", () => {
    const legacy = normalizeWorkshopState({
      global: {
        ...DEFAULT_CREATIVE_SETTINGS,
        template: "hero-visual",
      },
      overrides: {
        mailer: {
          ...DEFAULT_CREATIVE_SETTINGS,
          template: "offer-first",
        },
        discovery: {
          ...DEFAULT_CREATIVE_SETTINGS,
          template: "brand-focus",
        },
      },
      formats: {
        social: "story",
      },
    });

    expect(legacy.director).toMatchObject({
      version: 1,
      destination: "mailer",
      goal: "promote-offer",
      direction: "premium",
    });
    expect(Object.fromEntries(
      Object.entries(legacy.director.concepts).map(
        ([destination, selection]) => [destination, selection.recipeId],
      ),
    )).toEqual({
      mailer: "impact",
      discovery: "editorial",
      qr: "cinematic",
      social: "cinematic",
    });
    expect(legacy.formats).toMatchObject({
      mailer: "standard",
      discovery: "card",
      qr: "hero",
      social: "story",
    });
  });

  it("uses short source copy before deterministically shortening a long headline", () => {
    const longHeadline =
      "Book Your Complete Whole Home Air Conditioning Tune Up Today";
    const campaignWithFallback = createCampaign({ headline: longHeadline });
    const fallbackContent = normalizeCampaignContent({
      campaign: campaignWithFallback,
      businessName: "Neighborhood HVAC",
    });
    const allLong = createCampaign({
      headline: longHeadline,
      title: "Complete Seasonal Comfort Service For Every Local Home Today",
      offer_title: "Professional Preventive Maintenance For Your Entire Cooling System",
    });
    const shortened = createDisplayHeadline(allLong);

    expect(fallbackContent.headline).toBe("$49 Seasonal Tune-Up");
    expect(campaignWithFallback.headline).toBe(longHeadline);
    expect(shortened).toBe("Book Your Complete Whole Home Air\u2026");
    expect(shortened.replace(/\u2026$/, "").split(/\s+/)).toHaveLength(6);
    expect(allLong.headline).toBe(longHeadline);
  });

  it.each<[CreativeDestination, CreativeFormatKey | undefined, object]>([
    [
      "qr",
      "hero",
      { top: 0.045, right: 0.05, bottom: 0.06, left: 0.05 },
    ],
    [
      "social",
      "story",
      { top: 0.08, right: 0.05, bottom: 0.11, left: 0.05 },
    ],
    [
      "social",
      "square",
      { top: 0.055, right: 0.055, bottom: 0.07, left: 0.055 },
    ],
    [
      "discovery",
      "card",
      { top: 0.045, right: 0.045, bottom: 0.055, left: 0.045 },
    ],
  ])(
    "returns bounded print-safe margins for %s/%s",
    (destination, format, expected) => {
      const bounds = getDestinationSafeBounds(destination, format);

      expect(bounds).toEqual(expected);
      for (const margin of Object.values(bounds)) {
        expect(margin).toBeGreaterThan(0);
        expect(margin).toBeLessThan(0.5);
      }
    },
  );

  it.each(["standard", "combined", "featured"] as const)(
    "normalizes the 0.125-inch Mailer safe inset for %s geometry",
    format => {
      const placement = canonicalCommunityMailerCreativePlacement(format);
      expect(placement).not.toBeNull();
      const bounds = getDestinationSafeBounds("mailer", format);

      expect(bounds.left * placement!.widthInches).toBeCloseTo(0.125, 10);
      expect(bounds.right * placement!.widthInches).toBeCloseTo(0.125, 10);
      expect(bounds.top * placement!.heightInches).toBeCloseTo(0.125, 10);
      expect(bounds.bottom * placement!.heightInches).toBeCloseTo(0.125, 10);
    },
  );

  it("switches concepts and destinations without mutating campaign content", () => {
    const campaign = createCampaign();
    const content = normalizeCampaignContent({
      campaign,
      businessName: "Neighborhood HVAC",
      imageUrl: "https://example.com/hero.jpg",
      destinationUrl: "https://example.com/campaign",
    });
    const campaignSnapshot = JSON.parse(JSON.stringify(campaign));
    const contentSnapshot = JSON.parse(JSON.stringify(content));
    const initial = createDirectorState();

    const mailerImpact = selectCreativeRecipe(initial, "mailer", "impact");
    const socialWorkspace = selectCreativeDestination(mailerImpact, "social");
    const socialCinematic = selectCreativeRecipe(
      socialWorkspace,
      "social",
      "cinematic",
    );
    const backOnMailer = selectCreativeDestination(
      socialCinematic,
      "mailer",
    );

    expect(campaign).toEqual(campaignSnapshot);
    expect(content).toEqual(contentSnapshot);
    expect(content.campaign).toBe(campaign);
    expect(initial.overrides).toEqual({});
    expect(backOnMailer.director.concepts.mailer.recipeId).toBe("impact");
    expect(backOnMailer.director.concepts.social.recipeId).toBe("cinematic");
    expect(resolveCreativeSettings(backOnMailer, "mailer")).toMatchObject(
      CONTENT_REFERENCES,
    );
    expect(resolveCreativeSettings(backOnMailer, "social")).toMatchObject(
      CONTENT_REFERENCES,
    );
  });
});

describe("Creative Director persistence", () => {
  it("treats a destination-only context change as unsaved persistence state", () => {
    const saved = createDirectorState();
    const switched = selectCreativeDestination(saved, "social");
    const unchanged = selectCreativeDestination(saved, "mailer");

    expect(isCreativeWorkshopUnsaved(saved, switched)).toBe(true);
    expect(isCreativeWorkshopUnsaved(saved, unchanged)).toBe(false);
  });

  it("round-trips selected concepts and refinements through serialized workshop state", () => {
    const mailer = selectCreativeRecipe(
      createDirectorState(),
      "mailer",
      "impact",
    );
    const refinedMailer = optimizeCampaignCreative(
      mailer,
      "mailer",
      "improve-readability",
    );
    const social = selectCreativeRecipe(
      refinedMailer,
      "social",
      "cinematic",
    );
    const refinedSocial = optimizeCampaignCreative(
      social,
      "social",
      "improve-qr-visibility",
    );
    const state = selectCreativeDestination(refinedSocial, "social");

    const serialized = JSON.stringify(state);
    const restored = normalizeWorkshopState(JSON.parse(serialized));

    expect(restored).toEqual(state);
    expect(restored.director).toMatchObject({
      version: 1,
      destination: "social",
      concepts: {
        mailer: {
          recipeId: "impact",
          refinements: ["improve-readability"],
        },
        social: {
          recipeId: "cinematic",
          refinements: ["improve-qr-visibility"],
        },
      },
    });
    expect(resolveCreativeSettings(restored, "mailer")).toMatchObject(
      CONTENT_REFERENCES,
    );
    expect(resolveCreativeSettings(restored, "social")).toMatchObject(
      CONTENT_REFERENCES,
    );
  });

  it("normalizes invalid persisted director choices and duplicate refinements", () => {
    const normalized = normalizeCreativeDirectorState(
      {
        version: 99,
        destination: "billboard",
        goal: "go-viral",
        direction: "magic",
        concepts: {
          mailer: {
            recipeId: "impact",
            refinements: [
              "simplify",
              "simplify",
              "unknown-action",
            ],
          },
          social: {
            recipeId: "unknown-recipe",
            refinements: "improve-readability",
          },
        },
      },
      { social: "cinematic" },
    );

    expect(normalized).toEqual({
      version: 1,
      destination: "mailer",
      goal: "promote-offer",
      direction: "premium",
      concepts: {
        mailer: {
          recipeId: "impact",
          refinements: ["simplify"],
        },
        discovery: {
          recipeId: "cinematic",
          refinements: [],
        },
        qr: {
          recipeId: "cinematic",
          refinements: [],
        },
        social: {
          recipeId: "cinematic",
          refinements: [],
        },
      },
    });
  });
});
