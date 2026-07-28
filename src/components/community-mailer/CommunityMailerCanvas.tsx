import type { CampaignTemplateSettings } from "../../features/campaign-templates";
import type { CommunityCardSide } from "../../lib/communityCards";
import {
  canSelectPlacement,
  EDDM_12X9_PERCENTAGES,
  type CommunityMailerMode,
  type CommunityMailerRenderRecord,
  type LayoutPlacement,
  placementsForSide,
} from "../../lib/communityMailerLayout";
import CommunityMailerPlacement from "./CommunityMailerPlacement";
import CommunityMailerProductionGuides from "./CommunityMailerProductionGuides";
import MailerBrandArea from "./MailerBrandArea";

type Props = {
  mailer: CommunityMailerRenderRecord;
  placements: LayoutPlacement[];
  side: CommunityCardSide;
  mode: CommunityMailerMode;
  selectedId?: string;
  highlightIds?: string[];
  bookingSelection?: string[];
  onSelect?: (placement: LayoutPlacement) => void;
  showProductionGuides?: boolean;
  /**
   * Saved Mailer creative settings keyed by placement id, resolved by
   * surfaces that are authorized to read them. Placements without an entry
   * keep the synthesized presentation fallback.
   */
  creativeSettingsById?: Record<string, CampaignTemplateSettings>;
};
export default function CommunityMailerCanvas(
  {
    mailer,
    placements,
    side,
    mode,
    selectedId,
    highlightIds = [],
    bookingSelection = [],
    onSelect,
    showProductionGuides = false,
    creativeSettingsById,
  }: Props,
) {
  const aspect = mailer.format === "postcard_9x12"
    ? "aspect-[4/3]"
    : "aspect-[11/6]";
  const canvas = (
    <div
      data-format={mailer.format}
      className={`community-mailer-canvas relative mx-auto w-full max-w-5xl touch-pan-y overflow-hidden border-[6px] border-[#1d4378] bg-[#f5f0df] shadow-2xl ${aspect} ${
        mode === "print-preview" ? "border-0 shadow-none" : ""
      }`}
      aria-label={`${side} side of ${mailer.title}`}
    >
      <MailerBrandArea
        zone={mailer.zone_name}
        headline={mailer.consumer_headline}
        side={side}
        format={mailer.format}
        qrDestination={mailer.discovery_qr_destination_url}
      />
      {placementsForSide(placements, side).map((placement) => (
        <CommunityMailerPlacement
          key={placement.id}
          placement={placement}
          mode={mode}
          selected={selectedId === placement.id ||
            bookingSelection.includes(placement.id)}
          highlighted={highlightIds.includes(placement.id)}
          selectable={Boolean(onSelect) &&
            canSelectPlacement(mode, placement, mailer.sales_open)}
          onSelect={onSelect}
          creativeSettings={creativeSettingsById?.[placement.id] ?? null}
        />
      ))}
    </div>
  );
  if (mailer.format !== "postcard_9x12" || !showProductionGuides) return canvas;
  const geometry = EDDM_12X9_PERCENTAGES;
  return (
    <div className="community-mailer-production-sheet relative mx-auto aspect-[49/37] w-full max-w-5xl overflow-hidden bg-[#1d4378] shadow-2xl">
      <div
        className="absolute"
        style={{
          left: `${geometry.trimLeft}%`,
          top: `${geometry.trimTop}%`,
          width: `${geometry.trimWidth}%`,
          height: `${geometry.trimHeight}%`,
        }}
      >
        {canvas}
      </div>
      <CommunityMailerProductionGuides />
    </div>
  );
}
