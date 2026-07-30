import { describe, expect, it } from "vitest";
import {
  creativeFormatAspect,
  creativeFormatRatio,
  getDestinationSafeBounds,
  type CreativeFormatKey,
} from "../../features/campaign-templates/creativeDestinations";
import { CREATIVE_RECIPES } from "../../features/campaign-templates/creativeDirector";
import { resolveCreativeTemplateLayout } from "../../features/campaign-templates/templateRegistry";
import {
  fixedNineByTwelveSlots,
  type CommunityMailerRowPattern,
} from "../communityCards";

const FORMAT_CASES: ReadonlyArray<{
  format: CreativeFormatKey;
  pattern: CommunityMailerRowPattern;
}> = [
  { format: "standard", pattern: "singles" },
  { format: "combined", pattern: "double_left" },
  { format: "featured", pattern: "full" },
];

describe("Creative Director Community Mailer geometry", () => {
  it.each(FORMAT_CASES)(
    "matches the $format preview ratio to canonical production placement geometry",
    ({ format, pattern }) => {
      const placement = fixedNineByTwelveSlots(
        "front",
        pattern,
        "singles",
      )[0];
      const productionAspect =
        (placement.width * 12) / (placement.height * 9);
      const [ratioWidth, ratioHeight] = creativeFormatRatio(
        "mailer",
        format,
      ).split("/").map(Number);

      expect(creativeFormatAspect("mailer", format)).toBeCloseTo(
        productionAspect,
        10,
      );
      expect(ratioWidth / ratioHeight).toBeCloseTo(productionAspect, 10);
    },
  );

  it("uses the canonical portrait single-unit placement as the default", () => {
    expect(creativeFormatAspect("mailer", "standard")).toBeCloseTo(
      0.7269173667098909,
      10,
    );
    expect(creativeFormatAspect("mailer", "standard")).toBeLessThan(1);
  });

  it.each(FORMAT_CASES)(
    "keeps every standard and prominent recipe QR inside the $format safe area",
    ({ format }) => {
      const safe = getDestinationSafeBounds("mailer", format);
      for (const recipe of CREATIVE_RECIPES) {
        const template = recipe.settings.template ?? "hero-visual";
        for (const emphasis of ["standard", "prominent"] as const) {
          const qr = resolveCreativeTemplateLayout(template, emphasis).qr;
          expect(qr.x, `${recipe.id}/${emphasis} left`).toBeGreaterThanOrEqual(
            safe.left,
          );
          expect(qr.y, `${recipe.id}/${emphasis} top`).toBeGreaterThanOrEqual(
            safe.top,
          );
          expect(
            qr.x + qr.width,
            `${recipe.id}/${emphasis} right`,
          ).toBeLessThanOrEqual(1 - safe.right + 1e-10);
          expect(
            qr.y + qr.height,
            `${recipe.id}/${emphasis} bottom`,
          ).toBeLessThanOrEqual(1 - safe.bottom + 1e-10);
        }
      }
    },
  );
});
