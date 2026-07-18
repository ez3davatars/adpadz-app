import { type PointerEvent, useRef } from "react";
import type { CommunityCardSide } from "../../lib/communityCards";
import {
  canEditPlacement,
  canSelectPlacement,
  EDDM_12X9_PERCENTAGES,
  type CommunityMailerMode,
  type CommunityMailerRenderRecord,
  type LayoutPlacement,
  movePlacement,
  placementsForSide,
  resizePlacement,
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
  onChange?: (placement: LayoutPlacement) => void;
  showProductionGuides?: boolean;
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
    onChange,
    showProductionGuides = false,
  }: Props,
) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<
    { placement: LayoutPlacement; x: number; y: number; resize: boolean }
  >();
  function start(
    event: PointerEvent,
    placement: LayoutPlacement,
    resize = false,
  ) {
    if (
      !ref.current || !canEditPlacement(mode, placement, mailer.layout_locked)
    ) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { placement, x: event.clientX, y: event.clientY, resize };
  }
  function move(event: PointerEvent) {
    const current = drag.current, box = ref.current?.getBoundingClientRect();
    if (!current || !box) return;
    const dx = (event.clientX - current.x) / box.width * 100,
      dy = (event.clientY - current.y) / box.height * 100;
    onChange?.(
      current.resize
        ? resizePlacement(
          current.placement,
          current.placement.width + dx,
          current.placement.height + dy,
        )
        : movePlacement(
          current.placement,
          current.placement.x + dx,
          current.placement.y + dy,
        ),
    );
  }
  const aspect = mailer.format === "postcard_9x12"
    ? "aspect-[4/3]"
    : "aspect-[11/6]";
  const canvas = (
    <div
      ref={ref}
      data-format={mailer.format}
      onPointerMove={move}
      onPointerUp={() => {
        drag.current = undefined;
      }}
      onPointerCancel={() => {
        drag.current = undefined;
      }}
      className={`community-mailer-canvas relative mx-auto w-full max-w-5xl overflow-hidden border-[6px] border-[#1d4378] bg-[#f5f0df] shadow-2xl ${aspect} ${
        mode === "admin-edit" ? "touch-none" : "touch-pan-y"
      } ${mode === "print-preview" ? "border-0 shadow-none" : ""}`}
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
          editable={Boolean(onChange) &&
            canEditPlacement(mode, placement, mailer.layout_locked)}
          selectable={Boolean(onSelect) &&
            canSelectPlacement(mode, placement, mailer.sales_open)}
          onSelect={onSelect}
          onPointerDown={(event, item) => start(event, item)}
          onResizePointerDown={(event, item) => start(event, item, true)}
          onKeyboardMove={(item, dx, dy) =>
            onChange?.(movePlacement(item, item.x + dx, item.y + dy))}
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
