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
};

export default function DiscoveryFeedStage({
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
}: Props) {
  const businessName = content.businessName || null;

  return (
    <div className="flex w-full flex-col items-center gap-0">
      {/* Feed context: placeholder cards above */}
      <div
        className="w-full max-w-[520px] space-y-2 px-2 pb-2 opacity-40"
        aria-hidden="true"
      >
        <PlaceholderCard wide />
        <PlaceholderCard />
      </div>

      {/* Featured ad slot */}
      <div className="relative w-full max-w-[520px] px-2">
        {/* "Sponsored" chip */}
        <div
          className="mb-1.5 flex items-center gap-2 px-1"
          aria-hidden="true"
        >
          {businessName && (
            <span className="truncate text-[11px] font-semibold text-[var(--text-secondary)]">
              {businessName}
            </span>
          )}
          <span className="ml-auto rounded-full border border-white/[0.1] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
            Sponsored
          </span>
        </div>

        {/* Canvas */}
        <div
          className={`w-full ${previewScaleClass} shadow-[0_8px_32px_-8px_rgba(0,0,0,0.7)]`}
          style={{ aspectRatio }}
        >
          <CreativePreviewCanvas
            content={content}
            settings={settings}
            destination="discovery"
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

        {/* Engagement strip below ad */}
        <div
          className="mt-2 flex gap-3 px-1 opacity-30"
          aria-hidden="true"
        >
          {["Save offer", "Directions", "Share"].map((label) => (
            <div
              key={label}
              className="h-7 w-20 rounded-full bg-white/[0.08]"
            />
          ))}
        </div>
      </div>

      {/* Feed context: placeholder cards below */}
      <div
        className="w-full max-w-[520px] space-y-2 px-2 pt-2 opacity-30"
        aria-hidden="true"
      >
        <PlaceholderCard />
        <PlaceholderCard wide />
      </div>
    </div>
  );
}

function PlaceholderCard({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-3">
      <div className="h-12 w-12 shrink-0 rounded-xl bg-white/[0.06]" />
      <div className="min-w-0 flex-1 space-y-2 py-1">
        <div
          className="h-2.5 rounded-full bg-white/[0.08]"
          style={{ width: wide ? "75%" : "55%" }}
        />
        <div
          className="h-2 rounded-full bg-white/[0.05]"
          style={{ width: wide ? "55%" : "70%" }}
        />
      </div>
    </div>
  );
}
