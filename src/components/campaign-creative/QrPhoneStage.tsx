import { ExternalLink, QrCode } from "lucide-react";
import CreativePreviewCanvas from "./CreativePreviewCanvas";
import type {
  CreativeElementKey,
  CreativeSettings,
} from "../../features/campaign-templates/creativeWorkshop";
import type { CampaignTemplateContent } from "../../features/campaign-templates/types";
import type { QRLinkRecord } from "../../lib/qr/qrTypes";

type Props = {
  content: CampaignTemplateContent;
  settings: CreativeSettings;
  selectedQr: QRLinkRecord | null;
  selectedElement: CreativeElementKey;
  onSelectElement: (el: Exclude<CreativeElementKey, null>) => void;
  onClearSelection: () => void;
  showOriginal: boolean;
  measureOverflowElement: CreativeElementKey;
  onOverflowChange: (overflows: boolean | null) => void;
  previewScaleClass: string;
  aspectRatio: string;
  campaignId: string;
};

export default function QrPhoneStage({
  content,
  settings,
  selectedQr,
  selectedElement,
  onSelectElement,
  onClearSelection,
  showOriginal,
  measureOverflowElement,
  onOverflowChange,
  previewScaleClass,
  aspectRatio,
  campaignId,
}: Props) {
  const qrStudioHref = `/app/business/qr-studio?campaign=${campaignId}&return=creative`;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Scan→Offer annotation */}
      <div
        className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-2"
        aria-label="QR scan to offer connection"
      >
        <QrCode className="h-4 w-4 shrink-0 text-neon" aria-hidden="true" />
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
          Scan QR → arrives at this landing experience
        </span>
      </div>

      {/* Phone chrome + canvas */}
      <div className="relative flex items-start justify-center">
        {/* Phone chrome (decorative) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 rounded-[2.75rem] border-[10px] border-white/[0.09] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),0_0_0_1px_rgba(0,0,0,0.5),0_24px_64px_-16px_rgba(0,0,0,0.8)]"
        />
        {/* Side button details */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-[13px] top-24 h-16 w-1.5 rounded-full bg-white/[0.06]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[13px] top-16 h-10 w-1.5 rounded-full bg-white/[0.06]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[13px] top-28 h-10 w-1.5 rounded-full bg-white/[0.06]"
        />

        {/* Canvas inside phone screen */}
        <div
          className={`w-full ${previewScaleClass} overflow-hidden rounded-[2.2rem]`}
          style={{ aspectRatio, maxWidth: "300px" }}
        >
          <CreativePreviewCanvas
            content={content}
            settings={settings}
            destination="qr"
            selectedQr={selectedQr}
            selectedElement={selectedElement}
            onSelectElement={onSelectElement}
            onClearSelection={onClearSelection}
            showOriginal={showOriginal}
            showGuides={false}
            measureOverflowElement={measureOverflowElement}
            onOverflowChange={onOverflowChange}
          />
        </div>
      </div>

      {/* QR Studio round-trip */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">
            {selectedQr ? selectedQr.title : "No QR selected"}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">
            {selectedQr
              ? "QR Studio code · select a different QR in the Inspector"
              : "Choose a QR code in the Inspector · QR tab"}
          </p>
        </div>
        <a
          href={qrStudioHref}
          className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/[0.1] px-3 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:border-white/20 hover:text-white"
          aria-label="Open QR Studio for this campaign"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          QR Studio
        </a>
      </div>
    </div>
  );
}
