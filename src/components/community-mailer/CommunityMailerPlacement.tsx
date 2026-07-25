import type { KeyboardEvent, PointerEvent } from "react";
import { Lock } from "lucide-react";
import { CampaignTemplateRenderer, normalizeCampaignContent, normalizeTemplateSettings } from "../../features/campaign-templates";
import type {
  CommunityMailerMode,
  LayoutPlacement,
} from "../../lib/communityMailerLayout";

type Props = {
  placement: LayoutPlacement;
  mode: CommunityMailerMode;
  selected: boolean;
  highlighted: boolean;
  editable: boolean;
  selectable: boolean;
  onSelect?: (p: LayoutPlacement) => void;
  onPointerDown?: (e: PointerEvent, p: LayoutPlacement) => void;
  onResizePointerDown?: (e: PointerEvent, p: LayoutPlacement) => void;
  onKeyboardMove?: (p: LayoutPlacement, dx: number, dy: number) => void;
};
export default function CommunityMailerPlacement(
  {
    placement,
    mode,
    selected,
    highlighted,
    editable,
    selectable,
    onSelect,
    onPointerDown,
    onResizePointerDown,
    onKeyboardMove,
  }: Props,
) {
  const creative = placement.creative_asset_url || placement.ad_image_url;
  function key(event: KeyboardEvent) {
    if (!editable) return;
    const step = event.shiftKey ? 5 : 1;
    const delta = event.key === "ArrowLeft"
      ? [-step, 0]
      : event.key === "ArrowRight"
      ? [step, 0]
      : event.key === "ArrowUp"
      ? [0, -step]
      : event.key === "ArrowDown"
      ? [0, step]
      : null;
    if (delta) {
      event.preventDefault();
      onKeyboardMove?.(placement, delta[0], delta[1]);
    }
  }
  const publicLabel = placement.status === "available"
    ? "Available"
    : placement.status === "unavailable"
    ? "Unavailable"
    : mode === "public-booking"
    ? "Occupied"
    : placement.status === "reserved"
    ? "Reserved"
    : "Occupied";
  const tone = placement.status === "available"
    ? "border-dashed border-white/60 bg-[#355684]"
    : placement.status === "reserved"
    ? "border-amber-300 bg-[#253753]"
    : "border-neon/70 bg-[#12233e]";
  return (
    <button
      type="button"
      tabIndex={mode === "print-preview" || (!selectable && !editable) ? -1 : 0}
      aria-label={`${placement.label}: ${publicLabel}`}
      aria-disabled={!selectable && !editable}
      onClick={() => selectable && onSelect?.(placement)}
      onPointerDown={(event) => editable && onPointerDown?.(event, placement)}
      onKeyDown={key}
      className={`group absolute overflow-hidden border-2 text-left text-white transition ${
        mode === "print-preview" ? "border-transparent" : tone
      } ${
        mode === "print-preview"
          ? ""
          : selected
          ? "z-30 border-neon ring-2 ring-neon/40"
          : highlighted
          ? "border-sky-300 ring-2 ring-sky-300/40"
          : placement.is_featured
          ? "border-amber-300"
          : ""
      }`}
      style={{
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: `${placement.width}%`,
        height: `${placement.height}%`,
        zIndex: placement.z_index || 1,
      }}
    >
      {creative
        ? (
          placement.campaign_id ? <CampaignTemplateRenderer
            destination="mailer"
            content={normalizeCampaignContent({
              campaign: { id: placement.campaign_id, owner_id: placement.buyer_user_id || 'mailer', title: placement.offer_text || placement.business_name || placement.label, headline: placement.offer_text || placement.label, offer_title: placement.offer_text, status: 'active' },
              businessName: placement.business_name || placement.advertiser_name,
              imageUrl: creative,
              destinationUrl: placement.qr_destination_url,
            })}
            settings={normalizeTemplateSettings({ template: placement.is_featured ? 'featured-sponsor' : 'hero-visual', showQr: Boolean(placement.qr_destination_url), showExpiration: false })}
          /> : <img src={creative} alt="" className="h-full w-full bg-white object-contain" />
        )
        : (
          <span className="flex h-full flex-col items-center justify-center p-2 text-center">
            <b className="text-[clamp(7px,1vw,12px)]">
              {mode === "print-preview"
                ? "Artwork required"
                : mode === "public-booking" || mode === "business-review"
                ? publicLabel
                : placement.business_name || placement.advertiser_name ||
                  placement.label}
            </b>
            {mode !== "print-preview" && (
              <small className="mt-1 text-[clamp(6px,.75vw,9px)] opacity-75">
                {placement.is_featured
                  ? "Featured sponsor"
                  : placement.placement_type}
              </small>
            )}
          </span>
        )}
      {mode === "admin-edit" && (
        <>
          <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[8px] font-black uppercase">
            {placement.status}
          </span>
          {placement.is_locked && (
            <Lock className="absolute right-1 top-1 h-3 w-3" />
          )}
          {selected && editable && (
            <span
              aria-hidden="true"
              onPointerDown={(event) => {
                event.stopPropagation();
                onResizePointerDown?.(event, placement);
              }}
              className="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize border-l border-t border-black bg-neon"
            />
          )}
        </>
      )}
    </button>
  );
}
