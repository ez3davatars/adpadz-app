import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, XCircle } from "lucide-react";
import CreativePreviewCanvas from "./CreativePreviewCanvas";
import { isCreativeQrUsableForCampaign } from "../../features/campaign-templates/creativeWorkshopState";
import {
  MIN_PRODUCTION_QR_CONTRAST_RATIO,
  qrContrastRatio,
} from "../../lib/qr/qrArtwork";
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
  campaignId: string;
  campaignOwnerId: string;
  campaignBusinessId: string | null;
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
  campaignId,
  campaignOwnerId,
  campaignBusinessId,
}: Props) {
  const [guideSafe, setGuideSafe] = useState(false);
  const [guideBleed, setGuideBleed] = useState(false);
  const [guideQr, setGuideQr] = useState(false);

  const displaySettings = useMemo(
    () => ({
      ...settings,
      safeAreaVisible: guideSafe || settings.safeAreaVisible,
      bleedVisible: guideBleed || settings.bleedVisible,
      qrMinimumVisible: guideQr || settings.qrMinimumVisible,
    }),
    [settings, guideSafe, guideBleed, guideQr],
  );

  const qrUsable = useMemo(
    () =>
      selectedQr != null &&
      isCreativeQrUsableForCampaign(selectedQr, {
        id: campaignId,
        ownerId: campaignOwnerId,
        businessId: campaignBusinessId,
      }),
    [selectedQr, campaignId, campaignOwnerId, campaignBusinessId],
  );

  const contrast = useMemo(
    () =>
      selectedQr
        ? qrContrastRatio(
            selectedQr.foreground_color,
            selectedQr.inner_field_color || selectedQr.background_color,
          )
        : null,
    [selectedQr],
  );

  const contrastPass =
    contrast != null && contrast >= MIN_PRODUCTION_QR_CONTRAST_RATIO;

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Paper proof frame */}
      <div
        className="flex w-full items-center justify-center rounded-2xl p-5 sm:p-8"
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

      {/* Ephemeral guide controls */}
      <div className="w-full max-w-[720px] rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Print guides
        </p>
        <div className="flex flex-wrap gap-2">
          <GuideToggle
            active={guideSafe}
            onToggle={() => setGuideSafe((v) => !v)}
            label="Safe area"
            colorClass="amber"
          />
          <GuideToggle
            active={guideBleed}
            onToggle={() => setGuideBleed((v) => !v)}
            label="Bleed"
            colorClass="red"
          />
          <GuideToggle
            active={guideQr}
            onToggle={() => setGuideQr((v) => !v)}
            label="QR minimum"
            colorClass="neon"
          />
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-muted)]">
          Guide visibility is a session-only preference — it does not change the
          creative or require saving.
        </p>
      </div>

      {/* QR proof status */}
      <div className="w-full max-w-[720px] space-y-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          QR proof status
        </p>
        {!settings.showQr ? (
          <ProofItem
            status="warn"
            label="QR code is hidden"
            detail="Enable the QR code in the Inspector for print production."
          />
        ) : !selectedQr ? (
          <ProofItem
            status="error"
            label="No QR selected"
            detail="Choose a QR in the Inspector before sending to print."
          />
        ) : !qrUsable ? (
          <ProofItem
            status="error"
            label="QR ownership issue"
            detail="This QR is not linked to this campaign or has expired."
          />
        ) : (
          <ProofItem
            status="pass"
            label="QR ownership verified"
            detail={`${selectedQr.title} is active and bound to this campaign.`}
          />
        )}
        {selectedQr &&
          (contrast == null ? (
            <ProofItem
              status="warn"
              label="Contrast not measurable"
              detail="QR colors are missing — verify colors in QR Studio."
            />
          ) : contrastPass ? (
            <ProofItem
              status="pass"
              label={`Contrast ${contrast.toFixed(1)}:1 — passes ${MIN_PRODUCTION_QR_CONTRAST_RATIO}:1`}
              detail="Meets the minimum for scannable print production."
            />
          ) : (
            <ProofItem
              status="error"
              label={`Contrast ${contrast.toFixed(1)}:1 — below ${MIN_PRODUCTION_QR_CONTRAST_RATIO}:1`}
              detail="Adjust QR foreground and background in QR Studio before print."
            />
          ))}
      </div>
    </div>
  );
}

function GuideToggle({
  active,
  onToggle,
  label,
  colorClass,
}: {
  active: boolean;
  onToggle: () => void;
  label: string;
  colorClass: "amber" | "red" | "neon";
}) {
  const activeStyles = {
    amber: "border-amber-300/60 bg-amber-300/10 text-amber-300",
    red: "border-red-400/60 bg-red-400/10 text-red-400",
    neon: "border-neon/60 bg-neon/10 text-neon",
  };
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-[11px] font-semibold transition ${
        active
          ? activeStyles[colorClass]
          : "border-white/[0.07] text-[var(--text-muted)] hover:border-white/20"
      }`}
    >
      {active ? (
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}

function ProofItem({
  status,
  label,
  detail,
}: {
  status: "pass" | "warn" | "error";
  label: string;
  detail: string;
}) {
  const Icon =
    status === "pass"
      ? CheckCircle2
      : status === "warn"
        ? AlertTriangle
        : XCircle;
  const colorClass =
    status === "pass"
      ? "text-neon"
      : status === "warn"
        ? "text-amber-300"
        : "text-red-400";
  return (
    <div className="flex gap-2">
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${colorClass}`}
        aria-hidden="true"
      />
      <div>
        <p className={`text-xs font-semibold ${colorClass}`}>{label}</p>
        <p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
          {detail}
        </p>
      </div>
    </div>
  );
}
