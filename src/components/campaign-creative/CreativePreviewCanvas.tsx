import { useMemo, type CSSProperties } from "react";
import {
  CampaignTemplateRenderer,
} from "../../features/campaign-templates";
import {
  type CreativeDestination,
  type CreativeElementKey,
  type CreativeFormatKey,
  type CreativeSettings,
} from "../../features/campaign-templates/creativeWorkshop";
import { projectOriginalCreativeTreatment } from "../../features/campaign-templates/creativeWorkshopState";
import { resolveTemplateLayout } from "../../features/campaign-templates/templateRegistry";
import type { CampaignTemplateContent, NormalizedBox } from "../../features/campaign-templates/types";
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
};

export default function CreativePreviewCanvas({
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
}: CreativePreviewCanvasProps) {
  const applied = useMemo(
    () => showOriginal ? projectOriginalCreativeTreatment(settings) : settings,
    [settings, showOriginal],
  );
  const layout = useMemo(() => resolveTemplateLayout(applied.template), [applied.template]);
  const rendererSettings = useMemo(
    () => ({ ...applied, showQr: Boolean(selectedQr && applied.showQr) }),
    [applied, selectedQr],
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
  const qrGuideStyle = useMemo(() => boxStyle(layout.qr), [layout.qr]);

  return (
    <div
      data-testid="creative-preview-canvas"
      data-original-treatment={showOriginal ? "true" : "false"}
      className={`relative isolate h-full w-full overflow-hidden rounded-2xl bg-black ${className}`}
      style={{ containerType: "inline-size" }}
    >
      <CampaignTemplateRenderer
        content={content}
        settings={rendererSettings}
        destination={rendererDestination(destination, formatKey)}
        inspection={inspection}
        qrArtwork={selectedQr ? <QRStudioPreview qr={selectedQr} /> : undefined}
        className="rounded-2xl"
      />

      {showGuides && applied.bleedVisible && (
        <div className="pointer-events-none absolute inset-[2%] z-40 rounded-xl border border-dashed border-red-400" aria-label="Bleed overlay" />
      )}
      {showGuides && (safeAreaOverride ?? applied.safeAreaVisible) && (
        <div className="pointer-events-none absolute inset-[7%] z-40 rounded-xl border border-dashed border-amber-300" aria-label="Safe area overlay" />
      )}
      {showGuides && applied.qrMinimumVisible && (
        <div className="pointer-events-none absolute z-40 rounded-lg border-2 border-dashed border-neon" style={qrGuideStyle} aria-label="Minimum QR size overlay" />
      )}
      {showOriginal && (
        <span className="pointer-events-none absolute left-3 top-3 z-50 rounded-full bg-black/75 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white">
          Before · original treatment
        </span>
      )}
    </div>
  );
}

function boxStyle(box: NormalizedBox): CSSProperties {
  return {
    left: `${box.x * 100}%`,
    top: `${box.y * 100}%`,
    width: `${box.width * 100}%`,
    height: `${box.height * 100}%`,
  };
}

function rendererDestination(destination: CreativeDestination, formatKey?: CreativeFormatKey) {
  if (destination !== "social") return destination;
  if (formatKey === "portrait") return "social-portrait";
  if (formatKey === "landscape") return "social-landscape";
  if (formatKey === "story") return "social-story";
  return "social-square";
}
