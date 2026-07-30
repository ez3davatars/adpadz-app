const POINTS_PER_INCH = 72;

/**
 * Converts a physical print minimum into a container-width-relative font size.
 * The browser preview and 300-DPI candidate raster therefore retain the same
 * composition while the printed type cannot fall below the requested points.
 */
export function mailerPrintFontSize(
  preferredCqw: number,
  minimumPoints: number,
  physicalWidthInches?: number | null,
): string | undefined {
  if (
    !Number.isFinite(preferredCqw)
    || preferredCqw <= 0
    || !Number.isFinite(minimumPoints)
    || minimumPoints <= 0
    || !physicalWidthInches
    || !Number.isFinite(physicalWidthInches)
    || physicalWidthInches <= 0
  ) return undefined;

  const minimumCqw =
    minimumPoints / POINTS_PER_INCH / physicalWidthInches * 100;
  return `max(${preferredCqw}cqw, ${formatCqw(minimumCqw)}cqw)`;
}

function formatCqw(value: number) {
  return Number(value.toFixed(6)).toString();
}
