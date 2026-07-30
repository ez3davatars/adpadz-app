import { describe, expect, it } from "vitest";
import {
  CREATIVE_DESTINATION_KEYS,
  DEFAULT_WORKSHOP_STATE,
  normalizeCreativeSettings,
  resetCreativeDestination,
  resolveCreativeSettings,
  updateCreativeSettings,
  type CreativeDestination,
  type CreativeWorkshopState,
} from "../../features/campaign-templates/creativeWorkshop";
import {
  createCreativeVersionSnapshot,
  prepareCreativeSettingsForDestination,
  restoreCreativeVersionState,
} from "../../features/campaign-templates/creativeWorkshopState";
import type {
  CreativeConceptSelection,
} from "../../features/campaign-templates/creativeDirectorSchema";

function withConcept(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
  selection: CreativeConceptSelection,
): CreativeWorkshopState {
  return {
    ...state,
    director: {
      ...state.director,
      concepts: {
        ...state.director.concepts,
        [destination]: selection,
      },
    },
  };
}

describe("Creative Director and Advanced Edit synchronization", () => {
  it("maps an Advanced destination template change to its guided recipe and clears refinements", () => {
    const refined = withConcept(DEFAULT_WORKSHOP_STATE, "mailer", {
      recipeId: "cinematic",
      refinements: ["make-more-premium", "improve-readability"],
    });

    const changed = updateCreativeSettings(
      refined,
      "mailer",
      "destination",
      { template: "offer-first" },
    );

    expect(resolveCreativeSettings(changed, "mailer").template)
      .toBe("offer-first");
    expect(changed.director.concepts.mailer).toEqual({
      recipeId: "impact",
      refinements: [],
    });
  });

  it("reconciles a global template change only for destinations using global settings", () => {
    const withSocialOverride = updateCreativeSettings(
      DEFAULT_WORKSHOP_STATE,
      "social",
      "destination",
      { imageZoom: 1.25 },
    );
    const refined = CREATIVE_DESTINATION_KEYS.reduce(
      (state, destination) => withConcept(state, destination, {
        recipeId: "cinematic",
        refinements: ["simplify"],
      }),
      withSocialOverride,
    );

    const changed = updateCreativeSettings(
      refined,
      "mailer",
      "global",
      { template: "offer-first" },
    );

    for (const destination of ["mailer", "discovery", "qr"] as const) {
      expect(resolveCreativeSettings(changed, destination).template)
        .toBe("offer-first");
      expect(changed.director.concepts[destination]).toEqual({
        recipeId: "impact",
        refinements: [],
      });
    }
    expect(resolveCreativeSettings(changed, "social").template)
      .toBe("hero-visual");
    expect(changed.director.concepts.social).toEqual({
      recipeId: "cinematic",
      refinements: ["simplify"],
    });
  });

  it("reconciles an Advanced history copy after destination sanitization", () => {
    const source = normalizeCreativeSettings({
      ...DEFAULT_WORKSHOP_STATE.global,
      template: "offer-first",
      overlayOpacity: 82,
    });
    const target = withConcept(DEFAULT_WORKSHOP_STATE, "social", {
      recipeId: "editorial",
      refinements: ["increase-stop-power"],
    });

    const copied = updateCreativeSettings(
      target,
      "social",
      "destination",
      prepareCreativeSettingsForDestination(source, "social"),
    );

    expect(resolveCreativeSettings(copied, "social").template)
      .toBe("offer-first");
    expect(copied.director.concepts.social).toEqual({
      recipeId: "impact",
      refinements: [],
    });
  });

  it("reconciles the guided selection when an Advanced override is reset", () => {
    const override = updateCreativeSettings(
      DEFAULT_WORKSHOP_STATE,
      "discovery",
      "destination",
      { template: "offer-first" },
    );
    const refined = withConcept(override, "discovery", {
      recipeId: "impact",
      refinements: ["improve-readability"],
    });

    const reset = resetCreativeDestination(refined, "discovery");

    expect(resolveCreativeSettings(reset, "discovery").template)
      .toBe("hero-visual");
    expect(reset.director.concepts.discovery).toEqual({
      recipeId: "cinematic",
      refinements: [],
    });
  });

  it("restores saved director refinements and infers a safe recipe for legacy history", () => {
    const historicalSettings = updateCreativeSettings(
      DEFAULT_WORKSHOP_STATE,
      "social",
      "destination",
      { template: "offer-first", contrast: 128 },
    );
    const historical = withConcept(historicalSettings, "social", {
      recipeId: "impact",
      refinements: ["increase-stop-power"],
    });
    const snapshot = createCreativeVersionSnapshot(
      historical,
      "social",
      "destination",
    );
    const current = updateCreativeSettings(
      DEFAULT_WORKSHOP_STATE,
      "social",
      "destination",
      { template: "brand-focus" },
    );

    const restoredSaved = restoreCreativeVersionState(current, snapshot, {
      directorConcepts: historical.director.concepts,
    });
    expect(resolveCreativeSettings(restoredSaved, "social").template)
      .toBe("offer-first");
    expect(restoredSaved.director.concepts.social).toEqual({
      recipeId: "impact",
      refinements: ["increase-stop-power"],
    });

    const restoredLegacy = restoreCreativeVersionState(current, snapshot);
    expect(resolveCreativeSettings(restoredLegacy, "social").template)
      .toBe("offer-first");
    expect(restoredLegacy.director.concepts.social).toEqual({
      recipeId: "impact",
      refinements: [],
    });
  });
});
