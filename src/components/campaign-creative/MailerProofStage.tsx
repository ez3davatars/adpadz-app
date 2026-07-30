import { useMemo } from "react";
import CreativePreviewCanvas from "./CreativePreviewCanvas";
import type {
  CreativeElementKey,
  CreativeFormatKey,
  CreativeSettings,
} from "../../features/campaign-templates/creativeWorkshop";
import type { CampaignTemplateContent } from "../../features/campaign-templates/types";
import type { QRLinkRecord } from "../../lib/qr/qrTypes";

type Props = {
  content: CampaignTemplateContent;
  settings: CreativeSettings;
  formatKey: CreativeFormatKey;
  selectedQr: QRLinkRecord | null;
  selectedElement: CreativeElementKey;
  onSelectElement: (el: Exclude<CreativeElementKey, null>) => void;
  onClearSelection: () => void;
  showOriginal: boolean;
  measureOverflowElement: CreativeElementKey;
  onOverflowChange: (overflows: boolean | null) => void;
  previewScaleClass: string;
  aspectRatio: string;
  guideOverrides: { safe: boolean; bleed: boolean; qr: boolean };
};

export default function MailerProofStage({
  content,
  settings,
  formatKey,
  selectedQr,
  selectedElement,
  onSelectElement,
  onClearSelection,
  showOriginal,
  measureOverflowElement,
  onOverflowChange,
  previewScaleClass,
  aspectRatio,
  guideOverrides,
}: Props) {
  const displaySettings = useMemo(
    () => ({
      ...settings,
      safeAreaVisible: guideOverrides.safe || settings.safeAreaVisible,
      bleedVisible: guideOverrides.bleed || settings.bleedVisible,
      qrMinimumVisible: guideOverrides.qr || settings.qrMinimumVisible,
    }),
    [settings, guideOverrides],
  );

  return (
    <div
      className="flex w-full items-center justify-center rounded-2xl p-6 sm:p-10"
      style={{ background: "linear-gradient(135deg,#f7f3ec 0%,#ede8df 100%)" }}
      aria-label="Paper proof view"
    >
      <div
        className={`w-full ${previewScaleClass} shadow-[0_12px_48px_-12px_rgba(0,0,0,0.45),0_0_0_1px_rgba(0,0,0,0.07)]`}
        style={{ aspectRatio }}
      >
        <CreativePreviewCanvas
          content={content}
          settings={displaySettings}
          destination="mailer"
          formatKey={formatKey}
          selectedQr={selectedQr}
          selectedElement={selectedElement}
          onSelectElement={onSelectElement}
          onClearSelection={onClearSelection}
          showOriginal={showOriginal}
          showGuides
          measureOverflowElement={measureOverflowElement}
          onOverflowChange={onOverflowChange}
        />
      </div>
    </div>
  );
}
