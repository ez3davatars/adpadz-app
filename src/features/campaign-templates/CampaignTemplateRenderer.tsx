import { useEffect, useState, type CSSProperties } from "react";
import QRCode from "qrcode";
import { CAMPAIGN_TEMPLATE_REGISTRY, resolveTemplateLayout } from "./templateRegistry";
import type { CampaignTemplateContent, CampaignTemplateDestination, CampaignTemplateSettings, NormalizedBox } from "./types";

type Props = {
  content: CampaignTemplateContent;
  settings: CampaignTemplateSettings;
  destination: CampaignTemplateDestination;
  className?: string;
};

export function CampaignTemplateRenderer({ content, settings, destination, className = "" }: Props) {
  const layout = resolveTemplateLayout(settings.template);
  const light = settings.theme === "light";
  const compact = destination === "mailer" || destination === "discovery";
  const rootStyle = {
    "--campaign-primary": content.primaryColor,
    "--campaign-accent": content.accentColor,
    "--campaign-ink": light ? "#10150f" : "#ffffff",
    "--campaign-surface": light ? "#f7f8f4" : content.primaryColor,
  } as CSSProperties;
  return (
    <article
      className={`relative isolate h-full w-full overflow-hidden bg-[var(--campaign-surface)] text-[var(--campaign-ink)] ${className}`}
      style={rootStyle}
      data-template={settings.template}
      data-destination={destination}
      aria-label={`${content.businessName}: ${content.headline}`}
    >
      {content.imageUrl && (
        <div className="absolute overflow-hidden" style={boxStyle(layout.image)}>
          <img
            src={content.imageUrl}
            alt=""
            className="h-full w-full"
            style={{
              objectFit: settings.imageFit,
              objectPosition: `${settings.imagePositionX}% ${settings.imagePositionY}%`,
              transform: `scale(${settings.imageZoom})`,
            }}
          />
        </div>
      )}
      <div className={`absolute inset-0 ${light ? "bg-gradient-to-t from-white via-white/55 to-transparent" : "bg-gradient-to-t from-black/90 via-black/30 to-black/5"}`} />
      <div className="absolute overflow-hidden" style={boxStyle(layout.logo)}>
        {content.businessLogoUrl
          ? <img src={content.businessLogoUrl} alt={`${content.businessName} logo`} className="h-full w-full object-contain object-left" />
          : <p className="truncate text-[clamp(.55rem,2.6cqw,1.1rem)] font-black">{content.businessName}</p>}
      </div>
      <div className="absolute flex flex-col justify-end overflow-hidden" style={boxStyle(layout.copy)}>
        {settings.template === "offer-first" && content.offer && <p className="mb-[2cqw] text-[clamp(1rem,7cqw,4rem)] font-black leading-[.92] text-[var(--campaign-accent)]">{content.offer}</p>}
        <h2 className="line-clamp-3 text-[clamp(.9rem,5.2cqw,3.2rem)] font-black leading-[1.02]">{content.headline}</h2>
        {settings.template !== "offer-first" && content.offer && <p className="mt-[1.5cqw] line-clamp-2 text-[clamp(.65rem,3.3cqw,1.8rem)] font-black text-[var(--campaign-accent)]">{content.offer}</p>}
        {!compact && (content.offerDetails || content.description) && <p className="mt-[1.4cqw] line-clamp-3 text-[clamp(.5rem,2.1cqw,1.2rem)] opacity-85">{content.offerDetails || content.description}</p>}
      </div>
      <div className="absolute flex items-center" style={boxStyle(layout.cta)}>
        <span className="max-w-full truncate rounded-full bg-[var(--campaign-accent)] px-[4cqw] py-[1.6cqw] text-[clamp(.5rem,2.3cqw,1rem)] font-black text-black">{content.ctaLabel}</span>
      </div>
      {settings.showQr && content.destinationUrl && <QrMark destination={content.destinationUrl} style={boxStyle(layout.qr)} />}

      {settings.showExpiration && content.expiration && (
        <time className="absolute truncate text-[clamp(.4rem,1.7cqw,.8rem)] font-bold opacity-80" style={boxStyle(layout.expiration)} dateTime={content.expiration}>
          Ends {formatDate(content.expiration)}
        </time>
      )}
      {settings.template === "featured-sponsor" && <span className="absolute right-[5%] top-[4%] rounded-full bg-[var(--campaign-accent)] px-[3%] py-[1.3%] text-[clamp(.4rem,1.6cqw,.75rem)] font-black uppercase tracking-wider text-black">Featured sponsor</span>}
      <span className="sr-only">{CAMPAIGN_TEMPLATE_REGISTRY[settings.template].label} template</span>
    </article>
  );
}

function QrMark({ destination, style }: { destination: string; style: CSSProperties }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let current = true;
    void QRCode.toDataURL(destination, { errorCorrectionLevel: "H", margin: 1, width: 256 }).then(value => { if (current) setSrc(value); });
    return () => { current = false; };
  }, [destination]);
  return <div className="absolute rounded-[10%] bg-white p-[1cqw]" style={style}>{src && <img src={src} alt="QR code for campaign destination" className="h-full w-full object-contain" />}</div>;
}
function boxStyle(box: NormalizedBox): CSSProperties {
  return { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.width * 100}%`, height: `${box.height * 100}%` };
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

