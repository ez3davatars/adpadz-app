import { Check, ChevronDown, ExternalLink, QrCode, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  CAMPAIGN_TEMPLATES,
} from "../../features/campaign-templates";
import type {
  CreativeDestination,
  CreativeElementKey,
  CreativeSettings,
} from "../../features/campaign-templates/creativeWorkshop";
import {
  isCreativeQrUsable,
  isCreativeQrUsableForCampaign,
} from "../../features/campaign-templates/creativeWorkshopState";
import {
  MIN_PRODUCTION_QR_CONTRAST_RATIO,
  qrContrastRatio,
} from "../../lib/qr/qrArtwork";
import type { QRLinkRecord } from "../../lib/qr/qrTypes";
import { AdpadzButton } from "../adpadz-ui";
import QRStudioPreview from "../qr/QRStudioPreview";

export type CreativeInspectorSection =
  | "Template"
  | "Image"
  | "Overlay"
  | "QR"
  | "Text"
  | "Branding"
  | "Visibility"
  | "Print Safety";

export type CreativeAssetOption = {
  id: string;
  title: string;
  file_url: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
};

type CreativeInspectorProps = {
  settings: CreativeSettings;
  destination: CreativeDestination;
  campaignId: string;
  campaignOwnerId: string;
  campaignBusinessId: string | null;
  qrs: QRLinkRecord[];
  assets: CreativeAssetOption[];
  activeSection: CreativeInspectorSection;
  selectedElement: CreativeElementKey;
  mobileSheetOpen: boolean;
  onCloseMobileSheet: () => void;
  onSectionChange: (section: CreativeInspectorSection) => void;
  onChange: (patch: Partial<CreativeSettings>) => void;
  onResetSection: (section: CreativeInspectorSection) => void;
};

const TEXT_VISIBILITY_KEYS = {
  "business-name": "showBusinessName",
  headline: "showHeadline",
  offer: "showOffer",
  cta: "showCta",
  expiration: "showExpiration",
  phone: "showPhone",
  website: "showWebsite",
} as const;


const sections: CreativeInspectorSection[] = [
  "Template",
  "Image",
  "Overlay",
  "QR",
  "Text",
  "Branding",
  "Visibility",
  "Print Safety",
];

export default function CreativeInspector({
  settings,
  destination,
  campaignId,
  campaignOwnerId,
  campaignBusinessId,
  qrs,
  assets,
  activeSection,
  selectedElement,
  mobileSheetOpen,
  onCloseMobileSheet,
  onSectionChange,
  onChange,
  onResetSection,
}: CreativeInspectorProps) {
  const selectedQr = qrs.find(qr => qr.id === settings.qrId) ?? null;
  const selectedLabel = selectedElement ? elementLabel(selectedElement) : null;
  const inspectorRef = useRef<HTMLElement>(null);
  const [mobileViewport, setMobileViewport] = useState(false);
  const [selectedTextOverflows, setSelectedTextOverflows] = useState<boolean | null>(null);
  const sheetActive = mobileSheetOpen && mobileViewport;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const sync = () => setMobileViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!selectedElement || !TEXT_VISIBILITY_KEYS[selectedElement as keyof typeof TEXT_VISIBILITY_KEYS]) {
      setSelectedTextOverflows(null);
      return;
    }
    const measure = () => {
      const target = document.querySelector<HTMLElement>(`[data-testid="creative-preview-canvas"] [data-creative-element="${selectedElement}"]`);
      setSelectedTextOverflows(target ? target.scrollHeight > target.clientHeight + 1 || target.scrollWidth > target.clientWidth + 1 : null);
    };
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [selectedElement, settings]);

  useEffect(() => {
    if (!sheetActive) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => document.getElementById(`inspector-${activeSection.replace(" ", "-").toLowerCase()}`)?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [activeSection, sheetActive]);

  return (
    <>
      {sheetActive && <button type="button" aria-label="Close inspector" className="fixed inset-0 z-40 bg-black/65 xl:hidden" onClick={onCloseMobileSheet} />}
      <aside
        ref={inspectorRef}
        role={sheetActive ? "dialog" : undefined}
        aria-modal={sheetActive ? "true" : undefined}
        aria-label="Creative inspector"
        tabIndex={sheetActive ? -1 : undefined}
        onKeyDown={sheetActive ? event => trapInspectorFocus(event, inspectorRef.current, onCloseMobileSheet) : undefined}
        className={`${sheetActive ? "fixed inset-x-0 bottom-0 z-50 max-h-[78dvh] overflow-y-auto rounded-t-3xl border-t shadow-2xl" : "relative rounded-3xl border"} min-w-0 max-w-full border-white/10 bg-neutral-950/95 p-3 backdrop-blur-xl xl:static xl:max-h-none xl:overflow-visible xl:rounded-3xl xl:border`}
      >
        <div className="mb-2 flex items-center justify-between gap-3 px-1 xl:hidden">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">Inspector</p>
            <p className="text-xs font-black">{selectedLabel ? `Selected: ${selectedLabel}` : activeSection}</p>
          </div>
          <AdpadzButton type="button" variant="icon" size="sm" aria-label="Close creative inspector" onClick={onCloseMobileSheet}>
            <X className="h-4 w-4" />
          </AdpadzButton>
        </div>
        {selectedLabel && (
          <div role="status" aria-live="polite" className="mb-2 hidden rounded-2xl border border-neon/20 bg-neon/[0.06] px-3 py-2 text-[10px] font-black xl:block">
            Selected: <span className="text-neon">{selectedLabel}</span>
          </div>
        )}
        {sections.map(section => (
          <InspectorSection
            key={section}
            title={section}
            open={activeSection === section}
            onToggle={() => onSectionChange(section)}
            onReset={() => onResetSection(section)}
          >
            {section === "Template" && <TemplateControls settings={settings} change={onChange} destination={destination} />}
            {section === "Image" && <ImageControls settings={settings} change={onChange} assets={assets} />}
            {section === "Overlay" && <OverlayControls settings={settings} change={onChange} />}
            {section === "QR" && (
              <QrControls
                qrs={qrs}
                selectedQr={selectedQr}
                settings={settings}
                change={onChange}
                campaignId={campaignId}
                campaignOwnerId={campaignOwnerId}
                campaignBusinessId={campaignBusinessId}
                destination={destination}
              />
            )}
            {section === "Text" && <TextControls settings={settings} change={onChange} selectedElement={selectedElement} overflows={selectedTextOverflows} />}
            {section === "Branding" && <BrandControls settings={settings} change={onChange} />}
            {section === "Visibility" && <VisibilityControls settings={settings} change={onChange} destination={destination} />}
            {section === "Print Safety" && <PrintControls settings={settings} change={onChange} destination={destination} />}
          </InspectorSection>
        ))}
      </aside>
    </>
  );
}

function InspectorSection({
  title,
  open,
  onToggle,
  onReset,
  children,
}: {
  title: CreativeInspectorSection;
  open: boolean;
  onToggle: () => void;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-white/10" aria-labelledby={`inspector-${title.replace(" ", "-").toLowerCase()}`}>
      <div className="flex min-h-12 items-center gap-2">
        <h3 className="contents">
          <button
            id={`inspector-${title.replace(" ", "-").toLowerCase()}`}
            type="button"
            className="flex min-h-12 min-w-0 flex-1 items-center justify-between text-left text-xs font-black"
            aria-expanded={open}
            onClick={onToggle}
          >
            <span>{title}</span>
            <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180 text-neon" : "text-[var(--text-muted)]"}`} />
          </button>
        </h3>
        {open && (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[9px] font-black text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-white"
            aria-label={`Reset ${title}`}
            onClick={onReset}
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>
      {open && <div className="space-y-3 pb-4">{children}</div>}
    </section>
  );
}

function TemplateControls({ settings, change, destination }: { settings: CreativeSettings; change: Change; destination: CreativeDestination }) {
  return (
    <div className="grid gap-2">
      {CAMPAIGN_TEMPLATES.filter(template => template.key !== "featured-sponsor" || destination === "mailer").map(template => (
        <button
          key={template.key}
          type="button"
          aria-pressed={settings.template === template.key}
          onClick={() => change({ template: template.key })}
          className={`rounded-2xl border p-3 text-left ${settings.template === template.key ? "border-neon bg-neon/[0.08]" : "border-white/10"}`}
        >
          <span className="flex items-center justify-between text-xs font-black">
            {template.label}{settings.template === template.key && <Check className="h-4 w-4 text-neon" />}
          </span>
          <span className="mt-1 block text-[9px] leading-relaxed text-[var(--text-muted)]">{template.description}</span>
          <span className="mt-2 block text-[9px] font-bold text-[var(--text-secondary)]">{template.bestFor}</span>
        </button>
      ))}
    </div>
  );
}

function ImageControls({ settings, change, assets }: { settings: CreativeSettings; change: Change; assets: CreativeAssetOption[] }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black">Campaign image</p>
        <AdpadzButton href="/app/business/assets" variant="ghost" size="sm">Asset Library <ExternalLink className="h-3 w-3" /></AdpadzButton>
      </div>
      <div role="listbox" aria-label="Replace creative image from Asset Library" className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          role="option"
          aria-selected={!settings.imageAssetId}
          onClick={() => change({ imageAssetId: null })}
          className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border p-2 text-center text-[9px] font-black ${!settings.imageAssetId ? "border-neon bg-neon/10" : "border-white/10"}`}
        >
          Campaign default
        </button>
        {assets.map(asset => {
          const src = asset.thumbnail_url || asset.file_url || asset.external_url;
          return (
            <button
              key={asset.id}
              type="button"
              role="option"
              aria-label={`Use ${asset.title}`}
              aria-selected={settings.imageAssetId === asset.id}
              onClick={() => change({ imageAssetId: asset.id })}
              className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border ${settings.imageAssetId === asset.id ? "border-neon ring-2 ring-neon/20" : "border-white/10"}`}
            >
              {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <span className="p-2 text-[8px]">{asset.title}</span>}
              <span className="absolute inset-x-1 bottom-1 truncate rounded bg-black/75 px-1 py-0.5 text-[7px] font-bold">{asset.title}</span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Choice selected={settings.imageFit === "cover"} onClick={() => change({ imageFit: "cover" })}>Fill</Choice>
        <Choice selected={settings.imageFit === "contain"} onClick={() => change({ imageFit: "contain", imageZoom: 1 })}>Contain</Choice>
      </div>
      <Range label="Horizontal position" value={settings.imagePositionX} min={0} max={100} suffix="%" onChange={imagePositionX => change({ imagePositionX })} />
      <Range label="Vertical position" value={settings.imagePositionY} min={0} max={100} suffix="%" onChange={imagePositionY => change({ imagePositionY })} />
      <Range label="Zoom" value={settings.imageZoom} min={1} max={3} step={0.05} suffix="×" onChange={imageZoom => change({ imageZoom })} />
      <Range label="Rotation" value={settings.rotation} min={-5} max={5} step={0.5} suffix="°" onChange={rotation => change({ rotation })} />
      <Range label="Brightness" value={settings.brightness} min={25} max={175} suffix="%" onChange={brightness => change({ brightness })} />
      <Range label="Contrast" value={settings.contrast} min={25} max={175} suffix="%" onChange={contrast => change({ contrast })} />
      <Range label="Saturation" value={settings.saturation} min={0} max={200} suffix="%" onChange={saturation => change({ saturation })} />
      <Range label="Blur" value={settings.blur} min={0} max={12} step={0.5} suffix="px" onChange={blur => change({ blur })} />
    </>
  );
}

function OverlayControls({ settings, change }: { settings: CreativeSettings; change: Change }) {
  return (
    <>
      <Toggle label="Enable overlay" checked={settings.overlayEnabled} onChange={overlayEnabled => change({ overlayEnabled })} />
      <label className="block text-[10px] font-bold">
        Overlay style
        <select className="input-field mt-1" value={settings.overlayStyle} onChange={event => change({ overlayStyle: event.target.value as CreativeSettings["overlayStyle"] })}>
          <option value="bottom-fade">Bottom fade</option>
          <option value="top-fade">Top fade</option>
          <option value="linear">Linear gradient</option>
          <option value="radial">Radial gradient</option>
          <option value="solid">Solid</option>
        </select>
      </label>
      <label className="flex items-center justify-between text-[10px] font-bold">
        Overlay color
        <input aria-label="Overlay color" type="color" value={settings.overlayColor} onChange={event => change({ overlayColor: event.target.value })} className="h-11 w-14 rounded-lg bg-transparent" />
      </label>
      <Range label="Opacity" value={settings.overlayOpacity} min={0} max={100} suffix="%" onChange={overlayOpacity => change({ overlayOpacity })} />
      <Range label="Direction" value={settings.overlayDirection} min={0} max={360} suffix="°" onChange={overlayDirection => change({ overlayDirection })} />
      <Range label="Spread" value={settings.overlaySpread} min={0} max={100} suffix="%" onChange={overlaySpread => change({ overlaySpread })} />
    </>
  );
}

function QrControls({
  qrs,
  selectedQr,
  settings,
  change,
  campaignId,
  campaignOwnerId,
  campaignBusinessId,
  destination,
}: {
  qrs: QRLinkRecord[];
  selectedQr: QRLinkRecord | null;
  settings: CreativeSettings;
  change: Change;
  campaignId: string;
  campaignOwnerId: string;
  campaignBusinessId: string | null;
  destination: CreativeDestination;
}) {
  const requiredForPrint = destination === "mailer";
  const campaignQrContext = {
    id: campaignId,
    ownerId: campaignOwnerId,
    businessId: campaignBusinessId,
  };
  const isUsableForDestination = (qr: QRLinkRecord | null | undefined) =>
    requiredForPrint
      ? isCreativeQrUsableForCampaign(qr, campaignQrContext)
      : isCreativeQrUsable(qr, campaignOwnerId);
  const availableQrs = qrs.filter(isUsableForDestination);
  const expired = selectedQr?.expires_at
    ? !Number.isFinite(Date.parse(selectedQr.expires_at)) || Date.parse(selectedQr.expires_at) <= Date.now()
    : false;
  const active = isUsableForDestination(selectedQr);
  const contrast = selectedQr
    ? qrContrastRatio(
        selectedQr.foreground_color,
        selectedQr.inner_field_color || selectedQr.background_color,
      )
    : null;
  const owned = Boolean(selectedQr && selectedQr.owner_user_id === campaignOwnerId);
  const printContrastPass = contrast !== null
    && contrast >= MIN_PRODUCTION_QR_CONTRAST_RATIO;

  return (
    <>
      <Toggle label="Show QR for current destination" checked={settings.showQr} disabled={requiredForPrint} onChange={showQr => change({ showQr })} />
      {requiredForPrint && <p className="text-[9px] text-amber-200">Mailer QR visibility is locked for print scannability.</p>}
      {selectedQr && (
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-3">
          <div className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
            <div className="overflow-hidden rounded-full bg-white">
              <QRStudioPreview qr={selectedQr} size={260} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-black">{selectedQr.title}</p>
              <p className="mt-1 truncate text-[9px] text-[var(--text-muted)]">{selectedQr.destination_url}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-[8px] font-black uppercase tracking-wide">
                <span className={`rounded-full px-2 py-1 ${active ? "bg-neon/10 text-neon" : "bg-amber-400/10 text-amber-200"}`}>{active ? "Active" : expired ? "Expired" : selectedQr.status}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-1">{selectedQr.scan_count} scans</span>
              </div>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[9px]">
            <QrFact label="Source" value="QR Studio" />
            <QrFact label="Physical size" value={requiredForPrint ? "0.75 in module field minimum" : "Digital placement"} />
            <QrFact label="Margin" value="4-module quiet zone" />
            <QrFact
              label="Contrast"
              value={contrast === null
                ? (requiredForPrint ? "Unknown · Fails print" : "Unknown")
                : `${contrast.toFixed(1)}:1 ${printContrastPass ? "Pass" : requiredForPrint ? "Fails print" : "Review"}`}
              warning={requiredForPrint
                ? !printContrastPass
                : contrast !== null && contrast < MIN_PRODUCTION_QR_CONTRAST_RATIO}
            />
            <QrFact
              label={requiredForPrint ? "Campaign binding" : "Ownership"}
              value={(requiredForPrint ? active : owned) ? "Verified" : "Review required"}
              warning={requiredForPrint ? !active : !owned}
            />
          </dl>
        </div>
      )}
      {!selectedQr && <p className="rounded-xl bg-amber-400/[0.08] p-2 text-[9px] text-amber-100">Choose an active QR Studio code to make this destination scan-ready.</p>}
      <p className="text-[10px] font-black">Replace with a QR Studio code</p>
      <div role="listbox" aria-label="Choose from QR Studio" className="max-h-64 space-y-2 overflow-y-auto">
        {availableQrs.map(qr => {
          const selectable = isUsableForDestination(qr);
          const qrExpired = qr.expires_at
            ? !Number.isFinite(Date.parse(qr.expires_at)) || Date.parse(qr.expires_at) <= Date.now()
            : false;
          return (
            <button
              key={qr.id}
              type="button"
              role="option"
              aria-selected={settings.qrId === qr.id}
              aria-disabled={!selectable}
              disabled={!selectable}
              onClick={() => change({ qrId: qr.id, showQr: true })}
              className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left disabled:cursor-not-allowed disabled:opacity-50 ${settings.qrId === qr.id ? "border-neon bg-neon/[0.08]" : "border-white/10"}`}
            >
              <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white"><QRStudioPreview qr={qr} size={240} /></span>
              <span className="min-w-0">
                <span className="block truncate text-[10px] font-black">{qr.title}</span>
                <span className="block text-[9px] text-[var(--text-muted)]">{qrExpired ? "expired" : qr.status}{" \u00b7 "}{qr.scan_count} scans</span>
                <span className="block truncate text-[9px] text-[var(--text-muted)]">/q/{qr.slug}</span>
              </span>
            </button>
          );
        })}
        {availableQrs.length === 0 && (
          <p className="rounded-xl bg-amber-400/[0.08] p-2 text-[9px] text-amber-100">
            {requiredForPrint
              ? "Create an active Campaign QR for this business before saving Mailer creative."
              : "Create an active, unexpired QR Studio code for this destination."}
          </p>
        )}
      </div>
      <AdpadzButton href={`/app/business/qr-studio?campaign=${campaignId}`} variant="secondary" size="sm" fullWidth>
        <QrCode className="h-4 w-4" /> Open QR Studio
      </AdpadzButton>
    </>
  );
}

function TextControls({
  settings,
  change,
  selectedElement,
  overflows,
}: {
  settings: CreativeSettings;
  change: Change;
  selectedElement: CreativeElementKey;
  overflows: boolean | null;
}) {
  const visibilityKey = selectedElement
    ? TEXT_VISIBILITY_KEYS[selectedElement as keyof typeof TEXT_VISIBILITY_KEYS]
    : undefined;
  return (
    <>
      {visibilityKey && selectedElement && (
        <>
          <Toggle label={`${elementLabel(selectedElement)} visibility`} checked={Boolean(settings[visibilityKey])} onChange={visible => change({ [visibilityKey]: visible })} />
          <p role="status" className={`rounded-xl p-2 text-[9px] ${overflows ? "bg-amber-400/[0.08] text-amber-100" : "bg-white/[0.04] text-[var(--text-muted)]"}`}>
            Overflow: {overflows === null ? "Checking current template…" : overflows ? "Content may clip—shorten Campaign copy or choose a roomier treatment." : "Fits the current template."}
          </p>
        </>
      )}
      <label className="block text-[10px] font-bold">
        Headline size
        <select className="input-field mt-1" value={settings.headlineSize} onChange={event => change({ headlineSize: event.target.value as CreativeSettings["headlineSize"] })}>
          <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
        </select>
      </label>
      <div className="grid grid-cols-3 gap-1">
        {(["left", "center", "right"] as const).map(value => <Choice key={value} selected={settings.textAlign === value} onClick={() => change({ textAlign: value })}>{value}</Choice>)}
      </div>
      <label className="block text-[10px] font-bold">
        Text panel
        <select className="input-field mt-1" value={settings.textPanel} onChange={event => change({ textPanel: event.target.value as CreativeSettings["textPanel"] })}>
          <option value="none">None</option><option value="soft">Soft panel</option><option value="solid">Solid panel</option><option value="gradient">Gradient panel</option>
        </select>
      </label>
    </>
  );
}

function BrandControls({ settings, change }: { settings: CreativeSettings; change: Change }) {
  return (
    <>
      <p className="text-[9px] leading-relaxed text-[var(--text-muted)]">Defaults come from Business Hub. Overrides remain presentation metadata.</p>
      <label className="flex items-center justify-between text-[10px] font-bold">Primary color<input aria-label="Primary color" type="color" value={settings.primaryColorOverride ?? "#14251b"} onChange={event => change({ primaryColorOverride: event.target.value })} className="h-11 w-14 rounded-lg bg-transparent" /></label>
      <label className="flex items-center justify-between text-[10px] font-bold">Accent color<input aria-label="Accent color" type="color" value={settings.accentColorOverride ?? "#b6ff00"} onChange={event => change({ accentColorOverride: event.target.value })} className="h-11 w-14 rounded-lg bg-transparent" /></label>
      <div className="grid grid-cols-2 gap-2">
        <Choice selected={settings.theme === "dark"} onClick={() => change({ theme: "dark" })}>Light copy</Choice>
        <Choice selected={settings.theme === "light"} onClick={() => change({ theme: "light" })}>Dark copy</Choice>
      </div>
    </>
  );
}

function VisibilityControls({ settings, change, destination }: { settings: CreativeSettings; change: Change; destination: CreativeDestination }) {
  const items: Array<[keyof CreativeSettings, string, boolean]> = [
    ["showLogo", "Logo", false],
    ["showBusinessName", "Business name", false],
    ["showHeadline", "Headline", false],
    ["showOffer", "Offer", false],
    ["showCta", "CTA", false],
    ["showQr", "QR", destination === "mailer"],
    ["showExpiration", "Expiration", false],
    ["showPhone", "Phone", false],
    ["showWebsite", "Website", false],
    ["showSponsorBadge", "Sponsor badge", false],
  ];
  return (
    <>
      {items.map(([key, label, required]) => (
        <div key={key}>
          <Toggle label={label} checked={Boolean(settings[key])} disabled={required} onChange={value => change({ [key]: value })} />
          {required && <p className="mt-1 text-[9px] text-amber-200">Required for this print placement.</p>}
        </div>
      ))}
    </>
  );
}

function PrintControls({ settings, change, destination }: { settings: CreativeSettings; change: Change; destination: CreativeDestination }) {
  return (
    <>
      <Toggle label="Safe area overlay" checked={settings.safeAreaVisible} onChange={safeAreaVisible => change({ safeAreaVisible })} />
      <Toggle label="Bleed overlay" checked={settings.bleedVisible} disabled={destination !== "mailer"} onChange={bleedVisible => change({ bleedVisible })} />
      <Toggle label="QR minimum-size overlay" checked={settings.qrMinimumVisible} onChange={qrMinimumVisible => change({ qrMinimumVisible })} />
      <p className="rounded-xl bg-amber-400/[0.08] p-2 text-[9px] leading-relaxed text-amber-100">
        {destination === "mailer"
          ? "Saving print changes increments the rendered revision, invalidates preflight, and makes the Production Candidate stale."
          : "A destination-only digital override leaves Mailer production current."}
      </p>
    </>
  );
}

type Change = (patch: Partial<CreativeSettings>) => void;

function Range({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-[10px] font-bold">
        <span>{label}</span>
        <span className="text-[var(--text-muted)]">{value.toFixed(step < 1 ? 1 : 0)}{suffix}</span>
      </span>
      <input aria-label={label} aria-valuetext={`${value}${suffix}`} type="range" className="h-11 w-full accent-[var(--brand-primary)]" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} />
    </label>
  );
}

function Toggle({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-11 items-center justify-between gap-3 text-[10px] font-bold"><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} className="h-5 w-5 accent-[var(--brand-primary)]" /></label>;
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`min-h-11 rounded-xl border px-2 text-[10px] font-black capitalize ${selected ? "border-neon bg-neon/10 text-neon" : "border-white/10"}`}>{children}</button>;
}

function QrFact({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className="rounded-xl bg-black/25 p-2"><dt className="text-[8px] uppercase tracking-wider text-[var(--text-muted)]">{label}</dt><dd className={`mt-1 font-black ${warning ? "text-amber-200" : "text-white"}`}>{value}</dd></div>;
}

function elementLabel(element: Exclude<CreativeElementKey, null>) {
  return {
    image: "Image",
    logo: "Logo",
    "business-name": "Business name",
    headline: "Headline",
    offer: "Offer",
    cta: "CTA",
    qr: "QR Code",
    expiration: "Expiration",
    phone: "Phone",
    website: "Website",
    "sponsor-badge": "Sponsor badge",
    overlay: "Overlay",
  }[element];
}

function trapInspectorFocus(event: KeyboardEvent, container: HTMLElement | null, onClose: () => void) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    onClose();
    return;
  }
  if (event.key !== "Tab" || !container) return;
  const focusable = [...container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter(element => !element.hasAttribute("hidden"));
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
