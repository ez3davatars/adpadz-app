import { memo, useEffect, useMemo, useRef, type CSSProperties } from "react";
import {
  CampaignTemplateRenderer,
} from "../../features/campaign-templates";
import {
  destinationToRenderer,
  type CreativeDestination,
  type CreativeElementKey,
  type CreativeFormatKey,
  type CreativeSettings,
} from "../../features/campaign-templates/creativeWorkshop";
import { projectOriginalCreativeTreatment } from "../../features/campaign-templates/creativeWorkshopState";
import { getDestinationSafeBounds } from "../../features/campaign-templates/creativeDestinations";
import { resolveCreativeTemplateLayout } from "../../features/campaign-templates/templateRegistry";
import type { CampaignTemplateContent, NormalizedBox } from "../../features/campaign-templates/types";
import { resolveCommunityMailerPreviewQrPrintBox } from "../../lib/communityMailerQrGeometry";
import { canonicalCommunityMailerCreativePlacement } from "../../lib/communityMailerProductionContracts";
import type { QRLinkRecord } from "../../lib/qr/qrTypes";
import QRStudioPreview from "../qr/QRStudioPreview";

type CreativePreviewCanvasProps = {
  content: CampaignTemplateContent;
  settings: CreativeSettings;
  destination: CreativeDestination;
  formatKey?: CreativeFormatKey;
  selectedQr: QRLinkRecord | null;
  selectedElement?: CreativeElementKey;
  onSelectElement?: (element: Exclude<CreativeElementKey, null>) => void;
  onClearSelection?: () => void;
  showOriginal?: boolean;
  interactive?: boolean;
  showGuides?: boolean;
  safeAreaOverride?: boolean;
  className?: string;
  /**
   * When set, the canvas measures whether this element's rendered content
   * overflows its layout box and reports it. The canvas owns this DOM read so
   * no other component has to reach into the preview subtree.
   */
  measureOverflowElement?: CreativeElementKey;
  onOverflowChange?: (overflows: boolean | null) => void;
};

function CreativePreviewCanvasBase({
  content,
  settings,
  destination,
  formatKey,
  selectedQr,
  selectedElement = null,
  onSelectElement,
  onClearSelection,
  showOriginal = false,
  interactive = true,
  showGuides = true,
  safeAreaOverride,
  className = "",
  measureOverflowElement = null,
  onOverflowChange,
}: CreativePreviewCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const applied = useMemo(
    () => showOriginal ? projectOriginalCreativeTreatment(settings) : settings,
    [settings, showOriginal],
  );
  const mailerPlacement = useMemo(
    () => destination === "mailer"
      ? canonicalCommunityMailerCreativePlacement(formatKey)
      : null,
    [destination, formatKey],
  );
  const layout = useMemo(
    () => resolveCreativeTemplateLayout(applied.template, applied.qrEmphasis ?? "standard"),
    [applied.qrEmphasis, applied.template],
  );
  const safeBounds = useMemo(
    () => getDestinationSafeBounds(destination, formatKey, mailerPlacement),
    [destination, formatKey, mailerPlacement],
  );
  const mailerQrPrint = useMemo(
    () => destination === "mailer"
      ? resolveCommunityMailerPreviewQrPrintBox({
          formatKey,
          settings: applied,
          artwork: selectedQr,
          safeBounds,
        })
      : null,
    [applied, destination, formatKey, safeBounds, selectedQr],
  );
  const rendererSettings = useMemo(
    () => ({
      ...applied,
      showQr: Boolean(
        selectedQr
        && applied.showQr
        && (destination !== "mailer" || mailerQrPrint),
      ),
    }),
    [applied, destination, mailerQrPrint, selectedQr],
  );
  const inspection = useMemo(
    () => interactive && onSelectElement
      ? {
          selectedElement,
          onSelect: onSelectElement,
          onClear: onClearSelection,
        }
      : undefined,
    [interactive, onClearSelection, onSelectElement, selectedElement],
  );
  const qrGuideStyle = useMemo(
    () => destination === "mailer"
      ? mailerQrPrint ? boxStyle(mailerQrPrint.box) : undefined
      : boxStyle(layout.qr),
    [destination, layout.qr, mailerQrPrint],
  );
  const safeGuideStyle = useMemo(() => ({
    top: `${safeBounds.top * 100}%`,
    right: `${safeBounds.right * 100}%`,
    bottom: `${safeBounds.bottom * 100}%`,
    left: `${safeBounds.left * 100}%`,
  }), [safeBounds]);


  useEffect(() => {
    if (!onOverflowChange) return;
    if (!measureOverflowElement) {
      onOverflowChange(null);
      return;
    }
    const container = canvasRef.current;
    if (!container) return;
    let frame = 0;
    const measure = () => {
      const target = container.querySelector<HTMLElement>(
        `[data-creative-element="${measureOverflowElement}"]`,
      );
      onOverflowChange(target
        ? target.scrollHeight > target.clientHeight + 1 || target.scrollWidth > target.clientWidth + 1
        : null);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measureOverflowElement, onOverflowChange, rendererSettings, content]);

  return (
    <div
      ref={canvasRef}
      data-testid="creative-preview-canvas"
      data-original-treatment={showOriginal ? "true" : "false"}
      className={`relative isolate h-full w-full overflow-hidden rounded-2xl bg-black ${className}`}
      style={{ containerType: "inline-size" }}
    >
      <CampaignTemplateRenderer
        content={content}
        settings={rendererSettings}
        destination={destinationToRenderer(destination, formatKey)}
        physicalWidthInches={mailerPlacement?.widthInches}
        inspection={inspection}
        qrArtwork={selectedQr ? <QRStudioPreview qr={selectedQr} /> : undefined}
        qrBoxOverride={mailerQrPrint?.box}
        className="rounded-2xl"
      />

      {showGuides && applied.bleedVisible && (
        <div className="pointer-events-none absolute inset-[2%] z-40 rounded-xl border border-dashed border-red-400" data-guide="bleed" aria-hidden="true" />
      )}
      {showGuides && (safeAreaOverride ?? applied.safeAreaVisible) && (
        <div className="pointer-events-none absolute z-40 rounded-xl border border-dashed border-amber-300" style={safeGuideStyle} data-guide="safe-area" data-destination={destination} aria-hidden="true" />
      )}
      {showGuides && applied.qrMinimumVisible && qrGuideStyle && (
        <div className="pointer-events-none absolute z-40 rounded-lg border-2 border-dashed border-neon" style={qrGuideStyle} data-guide="qr-minimum" aria-hidden="true" />
      )}
      {showOriginal && (
        <span className="pointer-events-none absolute left-3 top-3 z-50 rounded-full bg-black/75 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          Before · original treatment
        </span>
      )}
    </div>
  );
}

const CreativePreviewCanvas = memo(CreativePreviewCanvasBase);
export default CreativePreviewCanvas;

function boxStyle(box: NormalizedBox): CSSProperties {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
  };
}
