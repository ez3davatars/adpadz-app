import { describe, expect, it } from "vitest";
import {
  MIN_PRODUCTION_QR_CONTRAST_RATIO,
  qrContrastRatio,
} from "../qr/qrArtwork";

describe("QR Studio production contrast", () => {
  it("uses the WCAG relative-luminance ratio for valid six-digit colors", () => {
    expect(qrContrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(qrContrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("identifies colors below the print threshold", () => {
    const ratio = qrContrastRatio("#777777", "#ffffff");
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeLessThan(MIN_PRODUCTION_QR_CONTRAST_RATIO);
  });

  it("fails closed for missing or malformed colors", () => {
    expect(qrContrastRatio(null, "#ffffff")).toBeNull();
    expect(qrContrastRatio("#not-a-color", "#ffffff")).toBeNull();
    expect(qrContrastRatio("#000", "#ffffff")).toBeNull();
  });
});