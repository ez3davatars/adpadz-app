import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import QRCode from "qrcode";
import { CAMPAIGN_TEMPLATE_REGISTRY, resolveTemplateLayout } from "./templateRegistry";
import type { CampaignTemplateContent, CampaignTemplateDestination, CampaignTemplateSettings, NormalizedBox } from "./types";
import type { CreativeElementKey, CreativeSettings } from "./creativeWorkshop";

type Props = {
  content: CampaignTemplateContent;
  settings: CampaignTemplateSettings | CreativeSettings;
  destination: CampaignTemplateDestination;
  className?: string;
  inspection?: CampaignTemplateInspection;
  qrArtwork?: ReactNode;
  qrBoxOverride?: NormalizedBox;
};

export type CampaignTemplateInspection = {
  selectedElement: CreativeElementKey;
  onSelect: (element: NonNullable<CreativeElementKey>) => void;
  onClear?: () => void;
};

export function CampaignTemplateRenderer({
  content,
  settings,
  destination,
  className = "",
  inspection,
  qrArtwork,
  qrBoxOverride,
}: Props) {
  const creative = settings as Partial<CreativeSettings>;
  const layout = useMemo(() => {
    const base = resolveTemplateLayout(settings.template);
    return qrBoxOverride ? { ...base, qr: qrBoxOverride } : base;
  }, [qrBoxOverride, settings.template]);
  const light = settings.theme === "light";
  const compact = destination === "mailer" || destination === "discovery";
  const renderLogo = creative.showLogo !== false && Boolean(content.businessLogoUrl);
  const renderBusinessName = Boolean(content.businessName)
    && (creative.showBusinessName === true
      || (creative.showBusinessName === undefined && !content.businessLogoUrl));
  const showHeadline = creative.showHeadline !== false;
  const showOffer = creative.showOffer !== false && Boolean(content.offer);
  const showCta = creative.showCta !== false;
  const showSponsorBadge = creative.showSponsorBadge !== false;
  const showPhone = creative.showPhone === true && Boolean(content.businessPhone);
  const showWebsite = creative.showWebsite === true && Boolean(content.businessWebsite);
  const textAlign = creative.textAlign ?? "left";
  const headlineSize = creative.headlineSize ?? "medium";
  const textPanel = creative.textPanel ?? "none";
  const rootStyle = {
    "--campaign-primary": creative.primaryColorOverride || content.primaryColor,
    "--campaign-accent": creative.accentColorOverride || content.accentColor,
    "--campaign-ink": light ? "#10150f" : "#ffffff",
    "--campaign-surface": light ? "#f7f8f4" : content.primaryColor,
  } as CSSProperties;
  const overlayInspectionProps = inspection
    ? inspectionProps("overlay", inspection)
    : {};
  return (
    <article
      className={`relative isolate h-full w-full overflow-hidden bg-[var(--campaign-surface)] text-[var(--campaign-ink)] ${className}`}
      style={rootStyle}
      data-template={settings.template}
      data-destination={destination}
      aria-label={`${content.businessName}: ${content.headline}`}
      onClick={inspection?.onClear}
    >
      {content.imageUrl && (
        <div
          className={`absolute overflow-hidden ${inspectionClass("image", inspection)}`}
          style={boxStyle(layout.image)}
          {...inspectionProps("image", inspection)}
        >
          <img
            src={content.imageUrl}
            alt=""
            className="h-full w-full"
            style={{
              objectFit: settings.imageFit,
              objectPosition: `${settings.imagePositionX}% ${settings.imagePositionY}%`,
              transform: `scale(${settings.imageZoom}) rotate(${creative.rotation ?? 0}deg)`,
              filter: `brightness(${creative.brightness ?? 100}%) contrast(${creative.contrast ?? 100}%) saturate(${creative.saturation ?? 100}%) blur(${creative.blur ?? 0}px)`,
            }}
          />
        </div>
      )}

      {creative.overlayEnabled && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: creativeOverlayBackground(creative) }}
          aria-hidden="true"
        />
      )}
      {creative.overlayEnabled === undefined && (
        <div
          className={`pointer-events-none absolute inset-0 ${light ? "bg-gradient-to-t from-white via-white/55 to-transparent" : "bg-gradient-to-t from-black/90 via-black/30 to-black/5"}`}
        />
      )}      {inspection && creative.overlayEnabled !== false && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="false">
          <div
            className={`pointer-events-auto absolute inset-x-[28%] top-0 h-[12%] min-h-6 ${inspectionClass("overlay", inspection)}`}
            data-testid="creative-overlay-hit-target"
            {...overlayInspectionProps}
          />
          <div
            className="pointer-events-auto absolute inset-y-0 left-0 w-[8%] cursor-pointer hover:bg-white/10"
            onClick={overlayInspectionProps.onClick}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto absolute inset-y-0 right-0 w-[8%] cursor-pointer hover:bg-white/10"
            onClick={overlayInspectionProps.onClick}
            aria-hidden="true"
          />
          <div
            className="pointer-events-auto absolute inset-x-[8%] bottom-0 h-[8%] cursor-pointer hover:bg-white/10"
            onClick={overlayInspectionProps.onClick}
            aria-hidden="true"
          />
        </div>
      )}
      {(renderLogo || renderBusinessName) && (
        <div className={`${inspection ? "pointer-events-none " : ""}absolute flex items-center gap-[1cqw] overflow-hidden`} style={boxStyle(layout.logo)}>
          {renderLogo && (
            <div
              className={`${renderBusinessName ? "h-full w-[38%] shrink-0" : "h-full w-full"} overflow-hidden ${inspectionClass("logo", inspection)}`}
              {...inspectionProps("logo", inspection)}
            >
              <img src={content.businessLogoUrl ?? ""} alt={`${content.businessName} logo`} className="h-full w-full object-contain object-left" />
            </div>
          )}
          {renderBusinessName && (
            <p
              className={`${renderLogo ? "min-w-0 flex-1" : "w-full"} truncate text-[clamp(.5rem,2.25cqw,1rem)] font-black ${inspectionClass("business-name", inspection)}`}
              {...inspectionProps("business-name", inspection)}
            >
              {content.businessName}
            </p>
          )}
        </div>
      )}
      <div className={`${inspection ? "pointer-events-none " : ""}absolute flex flex-col justify-end overflow-hidden ${textPanel === "none" ? "" : "rounded-lg"}`} style={{ ...boxStyle(layout.copy), textAlign, background: creativeTextPanelBackground(textPanel, light) }}>
        {settings.template === "offer-first" && showOffer && (
          <p
            className={`mb-[2cqw] text-[clamp(1rem,7cqw,4rem)] font-black leading-[.92] text-[var(--campaign-accent)] ${inspectionClass("offer", inspection)}`}
            {...inspectionProps("offer", inspection)}
          >
            {content.offer}
          </p>
        )}
        {showHeadline && (
          <h2
            className={`line-clamp-3 ${HEADLINE_SIZE_CLASSES[headlineSize]} font-black leading-[1.02] ${inspectionClass("headline", inspection)}`}
            {...inspectionProps("headline", inspection)}
          >
            {content.headline}
          </h2>
        )}
        {settings.template !== "offer-first" && showOffer && (
          <p
            className={`mt-[1.5cqw] line-clamp-2 text-[clamp(.65rem,3.3cqw,1.8rem)] font-black text-[var(--campaign-accent)] ${inspectionClass("offer", inspection)}`}
            {...inspectionProps("offer", inspection)}
          >
            {content.offer}
          </p>
        )}
        {!compact && (content.offerDetails || content.description) && <p className="mt-[1.4cqw] line-clamp-3 text-[clamp(.5rem,2.1cqw,1.2rem)] opacity-85">{content.offerDetails || content.description}</p>}
        {(showPhone || showWebsite) && (
          <div className={`mt-[1cqw] flex min-w-0 items-center gap-[2cqw] ${compact ? "text-[clamp(.38rem,1.45cqw,.7rem)]" : "text-[clamp(.45rem,1.7cqw,.9rem)]"}`}>
            {showPhone && (
              <span
                className={`min-w-0 flex-1 truncate font-bold ${inspectionClass("phone", inspection)}`}
                title={content.businessPhone ?? undefined}
                {...inspectionProps("phone", inspection)}
              >
                {content.businessPhone}
              </span>
            )}
            {showWebsite && (
              <span
                className={`min-w-0 flex-1 truncate font-bold ${inspectionClass("website", inspection)}`}
                title={content.businessWebsite ?? undefined}
                {...inspectionProps("website", inspection)}
              >
                {displayWebsite(content.businessWebsite ?? "")}
              </span>
            )}
          </div>
        )}
      </div>
      {showCta && (
        <div
          className={`absolute flex items-center ${inspectionClass("cta", inspection)}`}
          style={boxStyle(layout.cta)}
          {...inspectionProps("cta", inspection)}
        >
          <span className="max-w-full truncate rounded-full bg-[var(--campaign-accent)] px-[4cqw] py-[1.6cqw] text-[clamp(.5rem,2.3cqw,1rem)] font-black text-black">{content.ctaLabel}</span>
        </div>
      )}
      {settings.showQr && content.destinationUrl && (
        qrArtwork ? (
          <div
            className={`absolute overflow-hidden ${inspectionClass("qr", inspection)}`}
            style={boxStyle(layout.qr)}
            aria-label="Campaign QR code"
            {...inspectionProps("qr", inspection)}
          >
            {qrArtwork}
          </div>
        ) : (
          <QrMark destination={content.destinationUrl} style={boxStyle(layout.qr)} inspection={inspection} />
        )
      )}

      {settings.showExpiration && content.expiration && (
        <time
          className={`absolute truncate text-[clamp(.4rem,1.7cqw,.8rem)] font-bold opacity-80 ${inspectionClass("expiration", inspection)}`}
          style={boxStyle(layout.expiration)}
          dateTime={content.expiration}
          {...inspectionProps("expiration", inspection)}
        >
          Ends {formatDate(content.expiration)}
        </time>
      )}
      {settings.template === "featured-sponsor" && showSponsorBadge && (
        <span
          className={`absolute right-[5%] top-[4%] rounded-full bg-[var(--campaign-accent)] px-[3%] py-[1.3%] text-[clamp(.4rem,1.6cqw,.75rem)] font-black uppercase tracking-wider text-black ${inspectionClass("sponsor-badge", inspection)}`}
          {...inspectionProps("sponsor-badge", inspection)}
        >
          Featured sponsor
        </span>
      )}
      {inspection?.selectedElement === "image" && content.imageUrl && (
        <div className="pointer-events-none absolute z-20 outline outline-2 outline-offset-[-2px] outline-[var(--campaign-accent)]" style={boxStyle(layout.image)} aria-hidden="true" />
      )}
      {inspection?.selectedElement === "overlay" && creative.overlayEnabled !== false && (
        <div className="pointer-events-none absolute inset-0 z-20 outline outline-2 outline-offset-[-2px] outline-[var(--campaign-accent)]" aria-hidden="true" />
      )}
      <span className="sr-only">{CAMPAIGN_TEMPLATE_REGISTRY[settings.template].label} template</span>
    </article>
  );
}

function QrMark({ destination, style, inspection }: { destination: string; style: CSSProperties; inspection?: CampaignTemplateInspection }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let current = true;
    void QRCode.toDataURL(destination, { errorCorrectionLevel: "H", margin: 1, width: 256 }).then(value => { if (current) setSrc(value); });
    return () => { current = false; };
  }, [destination]);
  return (
    <div
      className={`absolute rounded-[10%] bg-white p-[1cqw] ${inspectionClass("qr", inspection)}`}
      style={style}
      {...inspectionProps("qr", inspection)}
    >
      {src && <img src={src} alt="QR code for campaign destination" className="h-full w-full object-contain" />}
    </div>
  );
}

const HEADLINE_SIZE_CLASSES: Readonly<Record<CreativeSettings["headlineSize"], string>> = Object.freeze({
  small: "text-[clamp(.75rem,4.2cqw,2.5rem)]",
  medium: "text-[clamp(.9rem,5.2cqw,3.2rem)]",
  large: "text-[clamp(1rem,6.2cqw,3.8rem)]",
});

function creativeOverlayBackground(settings: Partial<CreativeSettings>): string {
  const opacity = Math.min(100, Math.max(0, settings.overlayOpacity ?? 55));
  const alpha = Math.round(opacity * 2.55).toString(16).padStart(2, "0");
  const color = settings.overlayColor ?? "#000000";
  const opaque = `${color}${alpha}`;
  const clear = `${color}00`;
  const spread = Math.min(100, Math.max(0, settings.overlaySpread ?? 55));
  if (settings.overlayStyle === "solid") return opaque;
  if (settings.overlayStyle === "radial") return `radial-gradient(circle, ${clear}, ${opaque} ${spread}%)`;
  if (settings.overlayStyle === "top-fade") return `linear-gradient(180deg, ${opaque}, ${clear} ${spread}%)`;
  if (settings.overlayStyle === "linear") return `linear-gradient(${settings.overlayDirection ?? 180}deg, ${opaque}, ${clear} ${spread}%)`;
  return `linear-gradient(0deg, ${opaque}, ${clear} ${spread}%)`;
}

function creativeTextPanelBackground(panel: CreativeSettings["textPanel"], light: boolean): string | undefined {
  if (panel === "none") return undefined;
  const soft = light ? "rgba(255,255,255,.68)" : "rgba(0,0,0,.38)";
  const solid = light ? "rgba(255,255,255,.92)" : "rgba(0,0,0,.78)";
  if (panel === "soft") return soft;
  if (panel === "solid") return solid;
  return `linear-gradient(90deg, ${solid}, transparent)`;
}

const INSPECTION_LABELS: Record<NonNullable<CreativeElementKey>, string> = {
  image: "image",
  logo: "logo",
  "business-name": "business name",
  headline: "headline",
  offer: "offer",
  cta: "call to action",
  qr: "QR code",
  expiration: "expiration",
  phone: "phone number",
  website: "website",
  "sponsor-badge": "sponsor badge",
  overlay: "overlay",
};

function inspectionClass(element: NonNullable<CreativeElementKey>, inspection?: CampaignTemplateInspection) {
  if (!inspection) return "";
  const selected = inspection.selectedElement === element;
  return [
    "pointer-events-auto cursor-pointer outline-offset-[-2px]",
    "hover:outline hover:outline-1 hover:outline-[var(--campaign-accent)]",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--campaign-accent)]",
    selected ? "outline outline-2 outline-[var(--campaign-accent)]" : "",
  ].filter(Boolean).join(" ");
}

function inspectionProps(
  element: NonNullable<CreativeElementKey>,
  inspection?: CampaignTemplateInspection,
): HTMLAttributes<HTMLElement> & {
  "data-creative-element"?: NonNullable<CreativeElementKey>;
  "data-selected"?: "true" | "false";
} {
  if (!inspection) return {};
  const select = (event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    event.stopPropagation();
    inspection.onSelect(element);
  };
  return {
    role: "button",
    tabIndex: 0,
    "aria-label": `Edit ${INSPECTION_LABELS[element]}`,
    "aria-pressed": inspection.selectedElement === element,
    "data-creative-element": element,
    "data-selected": inspection.selectedElement === element ? "true" : "false",
    onClick: select,
    onKeyDown: (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      select(event);
    },
  };
}

function boxStyle(box: NormalizedBox): CSSProperties {
  return { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` };
}

function displayWebsite(value: string): string {
  return value.replace(/^https?:\/\/(?:www\.)?/i, "").replace(/\/$/, "");
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
