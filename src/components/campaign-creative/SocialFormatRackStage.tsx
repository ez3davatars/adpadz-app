import { ExternalLink, Save } from "lucide-react";
import CreativePreviewCanvas from "./CreativePreviewCanvas";
import { CREATIVE_DESTINATION_MAP } from "../../features/campaign-templates/creativeDestinations";
import type {
  CreativeElementKey,
  CreativeFormatKey,
  CreativeSettings,
} from "../../features/campaign-templates/creativeWorkshop";
import type { CampaignTemplateContent } from "../../features/campaign-templates/types";
import type { QRLinkRecord } from "../../lib/qr/qrTypes";

const socialFormatList = CREATIVE_DESTINATION_MAP.social.formats;

type Props = {
  content: CampaignTemplateContent;
  settings: CreativeSettings;
  selectedQr: QRLinkRecord | null;
  selectedFormat: CreativeFormatKey;
  onFormatChange: (format: string) => void;
  dirty: boolean;
  campaignId: string;
  selectedElement: CreativeElementKey;
  onSelectElement: (el: Exclude<CreativeElementKey, null>) => void;
  onClearSelection: () => void;
  showOriginal: boolean;
  measureOverflowElement: CreativeElementKey;
  onOverflowChange: (overflows: boolean | null) => void;
  previewScaleClass: string;
};

export default function SocialFormatRackStage({
  content,
  settings,
  selectedQr,
  selectedFormat,
  onFormatChange,
  dirty,
  campaignId,
  selectedElement,
  onSelectElement,
  onClearSelection,
  showOriginal,
  measureOverflowElement,
  onOverflowChange,
  previewScaleClass,
}: Props) {
  const selectedFormatDef =
    socialFormatList.find((f) => f.key === selectedFormat) ?? socialFormatList[0];
  const distributionHref = `/app/business/campaigns/${campaignId}/distribution/social`;

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {/* Format rack — all 4 formats simultaneously */}
      <div
        className="w-full"
        role="listbox"
        aria-label="Social media formats"
        aria-orientation="horizontal"
      >
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          All formats
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {socialFormatList.map((fmt) => {
            const active = fmt.key === selectedFormat;
            return (
              <button
                key={fmt.key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onFormatChange(fmt.key)}
                className={`group flex flex-col items-center gap-2 rounded-2xl border p-2.5 text-left transition ${
                  active
                    ? "border-neon/60 bg-neon/[0.06]"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]"
                }`}
              >
                {/* Thumbnail */}
                <div
                  className="w-full overflow-hidden rounded-xl border border-white/[0.06] bg-black/40"
                  style={{ aspectRatio: fmt.ratio, maxHeight: "90px" }}
                  aria-hidden="true"
                >
                  <CreativePreviewCanvas
                    content={content}
                    settings={settings}
                    destination="social"
                    formatKey={fmt.key}
                    selectedQr={selectedQr}
                    interactive={false}
                    showGuides={false}
                    showOriginal={false}
                  />
                </div>
                {/* Label */}
                <div className="w-full min-w-0 px-0.5">
                  <p
                    className={`truncate text-[11px] font-bold ${active ? "text-neon" : ""}`}
                  >
                    {fmt.label}
                  </p>
                  <p className="truncate text-[10px] text-[var(--text-muted)]">
                    {fmt.detail}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Focused preview of selected format */}
      <div className="flex w-full flex-col items-center gap-3">
        <p className="self-start px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          {selectedFormatDef.label} preview
        </p>
        <div
          className={`w-full ${previewScaleClass} shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8)]`}
          style={{ aspectRatio: selectedFormatDef.ratio }}
        >
          <CreativePreviewCanvas
            content={content}
            settings={settings}
            destination="social"
            formatKey={selectedFormat}
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

      {/* Export CTA */}
      <div className="w-full max-w-[720px] rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold">Export social graphics</p>
            <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
              {dirty
                ? "Save the creative first — Distribution exports the last saved version."
                : "Download PNG files for each format in Distribution."}
            </p>
          </div>
          {dirty ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-amber-300/30 bg-amber-300/[0.06] px-3 py-2 text-[11px] font-semibold text-amber-300">
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              Save before exporting
            </div>
          ) : (
            <a
              href={distributionHref}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/[0.1] px-3 text-[11px] font-semibold text-[var(--text-secondary)] transition hover:border-white/20 hover:text-white"
              aria-label="Open Distribution workspace to export social graphics"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Open Distribution
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
