import { Check, ChevronDown, ExternalLink, QrCode, RotateCcw, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { trapDialogFocus as trapInspectorFocus, useDialogBehavior } from "./dialogBehavior";
import {
  CAMPAIGN_TEMPLATES,
} from "../../features/campaign-templates";
import type {
  CreativeDestination,
  CreativeElementKey,
  CreativeSettings,
} from "../../features/campaign-templates/creativeWorkshop";
import {
  creativeSectionKeys,
  isCreativeQrUsable,
  isCreativeQrUsableForCampaign,
  listOverriddenCreativeSettingKeys,
  type CreativeResetSection,
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

type ProofGuides = { safe: boolean; bleed: boolean; qr: boolean };

type CreativeInspectorProps = {
  settings: CreativeSettings;
  /**
   * Global settings supplied only while editing a destination override.
   * Enables per-field override indicators and "Revert to Global".
   */
  baselineSettings?: CreativeSettings | null;
  destination: CreativeDestination;
  campaignId: string;
  campaignOwnerId: string;
  campaignBusinessId: string | null;
  qrs: QRLinkRecord[];
  assets: CreativeAssetOption[];
  activeSection: CreativeInspectorSection;
  selectedElement: CreativeElementKey;
  /** Reported by the preview canvas, which owns the overflow measurement. */
  selectedTextOverflows?: boolean | null;
  mobileSheetOpen: boolean;
  onCloseMobileSheet: () => void;
  onSectionChange: (section: CreativeInspectorSection) => void;
  onChange: Change;
  /**
   * Called when a continuous gesture (slider drag) finishes so the parent can
   * close the coalesced undo entry for that gesture.
   */
  onCommitGesture?: () => void;
  onResetSection: (section: CreativeInspectorSection) => void;
  /** Ephemeral guide overlay state lifted from the proof stage. Mailer only. */
  proofGuides?: ProofGuides;
  onProofGuidesChange?: (guides: ProofGuides) => void;
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

const mailerSections: CreativeInspectorSection[] = [
  "Template",
  "Image",
  "Overlay",
  "Text",
  "QR",
  "Branding",
  "Visibility",
  "Print Safety",
];

/** Print Safety is intentionally absent: guide toggles are editor preferences, not overrides. */
const SECTION_TO_RESET: Partial<Record<CreativeInspectorSection, CreativeResetSection>> = {
  Image: "image",
  Overlay: "overlay",
  QR: "qr",
  Text: "text",
  Branding: "branding",
  Visibility: "visibility",
};

type FieldMeta = {
  overridden: boolean;
  label: string;
  onRevert?: () => void;
};

type FieldFor = (keys: readonly (keyof CreativeSettings)[], label: string) => FieldMeta | undefined;

export default function CreativeInspector({
  settings,
  baselineSettings = null,
  destination,
  campaignId,
  campaignOwnerId,
  campaignBusinessId,
  qrs,
  assets,
  activeSection,
  selectedElement,
  selectedTextOverflows = null,
  mobileSheetOpen,
  onCloseMobileSheet,
  onSectionChange,
  onChange,
  onCommitGesture,
  onResetSection,
  proofGuides,
  onProofGuidesChange,
}: CreativeInspectorProps) {
  const selectedQr = qrs.find(qr => qr.id === settings.qrId) ?? null;
  const selectedLabel = selectedElement ? elementLabel(selectedElement) : null;
  const inspectorRef = useRef<HTMLElement>(null);
  const [viewportTier, setViewportTier] = useState<"phone" | "tablet" | "desktop">("desktop");
  // Phones get a modal bottom sheet; tablets get a pinned, non-modal sheet so
  // the preview stays visible and interactive while adjusting controls.
  const sheetActive = mobileSheetOpen && viewportTier === "phone";
  const pinnedActive = mobileSheetOpen && viewportTier === "tablet";

  useEffect(() => {
    const phone = window.matchMedia("(max-width: 639px)");
    const desktop = window.matchMedia("(min-width: 1280px)");
    const sync = () => setViewportTier(desktop.matches ? "desktop" : phone.matches ? "phone" : "tablet");
    sync();
    phone.addEventListener("change", sync);
    desktop.addEventListener("change", sync);
    return () => {
      phone.removeEventListener("change", sync);
      desktop.removeEventListener("change", sync);
    };
  }, []);

  const overriddenKeys = useMemo(
    () => baselineSettings
      ? new Set(listOverriddenCreativeSettingKeys(settings, baselineSettings))
      : null,
    [baselineSettings, settings],
  );
  const field = (keys: readonly (keyof CreativeSettings)[], label: string): FieldMeta | undefined => {
    if (!overriddenKeys || !baselineSettings) return undefined;
    const overridden = keys.some(key => overriddenKeys.has(key));
    return {
      overridden,
      label,
      onRevert: overridden
        ? () => onChange(Object.fromEntries(keys.map(key => [key, baselineSettings[key]])) as Partial<CreativeSettings>)
        : undefined,
    };
  };
  const sectionOverriddenCount = (section: CreativeInspectorSection): number => {
    if (!overriddenKeys) return 0;
    const reset = SECTION_TO_RESET[section];
    const keys: readonly (keyof CreativeSettings)[] = section === "Template"
      ? ["template"]
      : reset
        ? creativeSectionKeys(reset)
        : [];
    return keys.filter(key => overriddenKeys.has(key)).length;
  };

  useDialogBehavior({
    active: sheetActive,
    containerRef: inspectorRef,
    initialFocusId: `inspector-${activeSection.replace(" ", "-").toLowerCase()}`,
  });

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
        className={`${sheetActive
          ? "fixed inset-x-0 bottom-0 z-50 max-h-[78dvh] overflow-y-auto rounded-t-3xl border-t shadow-2xl"
          : pinnedActive
            ? "fixed inset-x-0 bottom-[4.5rem] z-40 max-h-[46dvh] overflow-y-auto rounded-t-3xl border-t shadow-2xl"
            : "relative rounded-3xl border"} min-w-0 max-w-full border-white/10 bg-neutral-950/95 p-3 backdrop-blur-xl xl:static xl:max-h-none xl:overflow-visible xl:rounded-3xl xl:border`}
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
        {(destination === "mailer" ? mailerSections : sections).map(section => (
          <Fragment key={section}>
            {destination === "mailer" && section === "QR" && (
              <div className="border-t border-white/[0.04] mt-1 pt-2 pb-0.5 px-1">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]/60">Production</p>
              </div>
            )}
            <InspectorSection
              title={section}
              open={activeSection === section}
              overriddenCount={sectionOverriddenCount(section)}
              onToggle={() => onSectionChange(section)}
              onReset={() => onResetSection(section)}
            >
              {section === "Template" && <TemplateControls settings={settings} change={onChange} destination={destination} field={field} />}
              {section === "Image" && <ImageControls settings={settings} change={onChange} commit={onCommitGesture} assets={assets} field={field} />}
              {section === "Overlay" && <OverlayControls settings={settings} change={onChange} commit={onCommitGesture} field={field} />}
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
                  field={field}
                />
              )}
              {section === "Text" && <TextControls settings={settings} change={onChange} selectedElement={selectedElement} overflows={selectedTextOverflows} field={field} />}
              {section === "Branding" && <BrandControls settings={settings} change={onChange} field={field} />}
              {section === "Visibility" && <VisibilityControls settings={settings} change={onChange} destination={destination} field={field} />}
              {section === "Print Safety" && <PrintControls settings={settings} change={onChange} destination={destination} proofGuides={proofGuides} onProofGuidesChange={onProofGuidesChange} />}
            </InspectorSection>
          </Fragment>
        ))}
      </aside>
    </>
  );
}

function InspectorSection({
  title,
  open,
  overriddenCount = 0,
  onToggle,
  onReset,
  children,
}: {
  title: CreativeInspectorSection;
  open: boolean;
  overriddenCount?: number;
  onToggle: () => void;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-white/10" aria-labelledby={`inspector-${title.replace(" ", "-").toLowerCase()}`}>
      <div className="flex min-h-12 items-center gap-2">
        <h3 className="min-w-0 flex-1">
          <button
            id={`inspector-${title.replace(" ", "-").toLowerCase()}`}
            type="button"
            className="flex min-h-12 w-full min-w-0 items-center justify-between text-left text-xs font-bold"
            aria-expanded={open}
            onClick={onToggle}
          >
            <span className="flex items-center gap-1.5">
              {title}
              {overriddenCount > 0 && (
                <span className="rounded-full bg-amber-300/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-300" title={`${overriddenCount} field${overriddenCount === 1 ? "" : "s"} differ from Global`}>
                  {overriddenCount}
                </span>
              )}
            </span>
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

function TemplateControls({ settings, change, destination, field }: { settings: CreativeSettings; change: Change; destination: CreativeDestination; field?: FieldFor }) {
  const meta = field?.(["template"], "Template");
  return (
    <div className="grid gap-2">
      {meta?.overridden && (
        <p className="flex items-center gap-1.5 rounded-xl bg-amber-300/[0.07] px-2 py-1.5 text-[9px] font-bold text-amber-200">
          Template differs from Global <OverrideMark meta={meta} />
        </p>
      )}
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

function ImageControls({ settings, change, commit, assets, field }: { settings: CreativeSettings; change: Change; commit?: () => void; assets: CreativeAssetOption[]; field?: FieldFor }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-black">Campaign image<OverrideMark meta={field?.(["imageAssetId"], "Image asset")} /></p>
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
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold">Image fit<OverrideMark meta={field?.(["imageFit"], "Image fit")} /></p>
        <div className="grid grid-cols-2 gap-2">
          <Choice selected={settings.imageFit === "cover"} onClick={() => change({ imageFit: "cover" })}>Fill</Choice>
          <Choice selected={settings.imageFit === "contain"} onClick={() => change({ imageFit: "contain", imageZoom: 1 })}>Contain</Choice>
        </div>
      </div>
      <Range label="Horizontal position" value={settings.imagePositionX} min={0} max={100} suffix="%" meta={field?.(["imagePositionX"], "Horizontal position")} onCommit={commit} onChange={imagePositionX => change({ imagePositionX }, { transient: true })} />
      <Range label="Vertical position" value={settings.imagePositionY} min={0} max={100} suffix="%" meta={field?.(["imagePositionY"], "Vertical position")} onCommit={commit} onChange={imagePositionY => change({ imagePositionY }, { transient: true })} />
      <Range label="Zoom" value={settings.imageZoom} min={1} max={3} step={0.05} suffix="×" meta={field?.(["imageZoom"], "Zoom")} onCommit={commit} onChange={imageZoom => change({ imageZoom }, { transient: true })} />
      <Range label="Rotation" value={settings.rotation} min={-5} max={5} step={0.5} suffix="°" meta={field?.(["rotation"], "Rotation")} onCommit={commit} onChange={rotation => change({ rotation }, { transient: true })} />
      <Range label="Brightness" value={settings.brightness} min={25} max={175} suffix="%" meta={field?.(["brightness"], "Brightness")} onCommit={commit} onChange={brightness => change({ brightness }, { transient: true })} />
      <Range label="Contrast" value={settings.contrast} min={25} max={175} suffix="%" meta={field?.(["contrast"], "Contrast")} onCommit={commit} onChange={contrast => change({ contrast }, { transient: true })} />
      <Range label="Saturation" value={settings.saturation} min={0} max={200} suffix="%" meta={field?.(["saturation"], "Saturation")} onCommit={commit} onChange={saturation => change({ saturation }, { transient: true })} />
      <Range label="Blur" value={settings.blur} min={0} max={12} step={0.5} suffix="px" meta={field?.(["blur"], "Blur")} onCommit={commit} onChange={blur => change({ blur }, { transient: true })} />
    </>
  );
}

function OverlayControls({ settings, change, commit, field }: { settings: CreativeSettings; change: Change; commit?: () => void; field?: FieldFor }) {
  return (
    <>
      <Toggle label="Enable overlay" checked={settings.overlayEnabled} meta={field?.(["overlayEnabled"], "Overlay visibility")} onChange={overlayEnabled => change({ overlayEnabled })} />
      <label className="block text-[10px] font-bold">
        <span className="flex items-center gap-1.5">Overlay style<OverrideMark meta={field?.(["overlayStyle"], "Overlay style")} /></span>
        <select className="input-field mt-1" value={settings.overlayStyle} onChange={event => change({ overlayStyle: event.target.value as CreativeSettings["overlayStyle"] })}>
          <option value="bottom-fade">Bottom fade</option>
          <option value="top-fade">Top fade</option>
          <option value="linear">Linear gradient</option>
          <option value="radial">Radial gradient</option>
          <option value="solid">Solid</option>
        </select>
      </label>
      <label className="flex items-center justify-between text-[10px] font-bold">
        <span className="flex items-center gap-1.5">Overlay color<OverrideMark meta={field?.(["overlayColor"], "Overlay color")} /></span>
        <input aria-label="Overlay color" type="color" value={settings.overlayColor} onChange={event => change({ overlayColor: event.target.value })} className="h-11 w-14 rounded-lg bg-transparent" />
      </label>
      <Range label="Opacity" value={settings.overlayOpacity} min={0} max={100} suffix="%" meta={field?.(["overlayOpacity"], "Overlay opacity")} onCommit={commit} onChange={overlayOpacity => change({ overlayOpacity }, { transient: true })} />
      <Range label="Direction" value={settings.overlayDirection} min={0} max={360} suffix="°" meta={field?.(["overlayDirection"], "Overlay direction")} onCommit={commit} onChange={overlayDirection => change({ overlayDirection }, { transient: true })} />
      <Range label="Spread" value={settings.overlaySpread} min={0} max={100} suffix="%" meta={field?.(["overlaySpread"], "Overlay spread")} onCommit={commit} onChange={overlaySpread => change({ overlaySpread }, { transient: true })} />
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
  field,
}: {
  qrs: QRLinkRecord[];
  selectedQr: QRLinkRecord | null;
  settings: CreativeSettings;
  change: Change;
  campaignId: string;
  campaignOwnerId: string;
  campaignBusinessId: string | null;
  destination: CreativeDestination;
  field?: FieldFor;
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
      <Toggle label="Show QR for current destination" checked={settings.showQr} disabled={requiredForPrint} meta={field?.(["showQr"], "QR visibility")} onChange={showQr => change({ showQr })} />
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold">
          QR emphasis<OverrideMark meta={field?.(["qrEmphasis"], "QR emphasis")} />
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(["standard", "prominent"] as const).map(value => (
            <Choice
              key={value}
              selected={(settings.qrEmphasis ?? "standard") === value}
              onClick={() => change({ qrEmphasis: value })}
            >
              {value === "standard" ? "Standard" : "Prominent"}
            </Choice>
          ))}
        </div>
      </div>
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
      <p className="flex items-center gap-1.5 text-[10px] font-black">Replace with a QR Studio code<OverrideMark meta={field?.(["qrId"], "QR selection")} /></p>
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
      <AdpadzButton href={`/app/business/qr-studio?campaign=${campaignId}&return=creative`} variant="secondary" size="sm" fullWidth>
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
  field,
}: {
  settings: CreativeSettings;
  change: Change;
  selectedElement: CreativeElementKey;
  overflows: boolean | null;
  field?: FieldFor;
}) {
  const visibilityKey = selectedElement
    ? TEXT_VISIBILITY_KEYS[selectedElement as keyof typeof TEXT_VISIBILITY_KEYS]
    : undefined;
  return (
    <>
      {visibilityKey && selectedElement && (
        <>
          <Toggle label={`${elementLabel(selectedElement)} visibility`} checked={Boolean(settings[visibilityKey])} meta={field?.([visibilityKey], `${elementLabel(selectedElement)} visibility`)} onChange={visible => change({ [visibilityKey]: visible })} />
          <p role="status" className={`rounded-xl p-2 text-[9px] ${overflows ? "bg-amber-400/[0.08] text-amber-100" : "bg-white/[0.04] text-[var(--text-muted)]"}`}>
            Overflow: {overflows === null ? "Checking current template…" : overflows ? "Content may clip—shorten Campaign copy or choose a roomier treatment." : "Fits the current template."}
          </p>
        </>
      )}
      <label className="block text-[10px] font-bold">
        <span className="flex items-center gap-1.5">Headline size<OverrideMark meta={field?.(["headlineSize"], "Headline size")} /></span>
        <select className="input-field mt-1" value={settings.headlineSize} onChange={event => change({ headlineSize: event.target.value as CreativeSettings["headlineSize"] })}>
          <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
        </select>
      </label>
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold">Text alignment<OverrideMark meta={field?.(["textAlign"], "Text alignment")} /></p>
        <div className="grid grid-cols-3 gap-1">
          {(["left", "center", "right"] as const).map(value => <Choice key={value} selected={settings.textAlign === value} onClick={() => change({ textAlign: value })}>{value}</Choice>)}
        </div>
      </div>
      <label className="block text-[10px] font-bold">
        <span className="flex items-center gap-1.5">Text panel<OverrideMark meta={field?.(["textPanel"], "Text treatment")} /></span>
        <select className="input-field mt-1" value={settings.textPanel} onChange={event => change({ textPanel: event.target.value as CreativeSettings["textPanel"] })}>
          <option value="none">None</option><option value="soft">Soft panel</option><option value="solid">Solid panel</option><option value="gradient">Gradient panel</option>
        </select>
      </label>
    </>
  );
}

function BrandControls({ settings, change, field }: { settings: CreativeSettings; change: Change; field?: FieldFor }) {
  return (
    <>
      <p className="text-[9px] leading-relaxed text-[var(--text-muted)]">Defaults come from Business Hub. Overrides remain presentation metadata.</p>
      <label className="flex items-center justify-between text-[10px] font-bold"><span className="flex items-center gap-1.5">Primary color<OverrideMark meta={field?.(["primaryColorOverride"], "Primary color")} /></span><input aria-label="Primary color" type="color" value={settings.primaryColorOverride ?? "#14251b"} onChange={event => change({ primaryColorOverride: event.target.value })} className="h-11 w-14 rounded-lg bg-transparent" /></label>
      <label className="flex items-center justify-between text-[10px] font-bold"><span className="flex items-center gap-1.5">Accent color<OverrideMark meta={field?.(["accentColorOverride"], "Accent color")} /></span><input aria-label="Accent color" type="color" value={settings.accentColorOverride ?? "#b6ff00"} onChange={event => change({ accentColorOverride: event.target.value })} className="h-11 w-14 rounded-lg bg-transparent" /></label>
      <div>
        <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold">Color theme<OverrideMark meta={field?.(["theme"], "Color theme")} /></p>
        <div className="grid grid-cols-2 gap-2">
          <Choice selected={settings.theme === "dark"} onClick={() => change({ theme: "dark" })}>Light copy</Choice>
          <Choice selected={settings.theme === "light"} onClick={() => change({ theme: "light" })}>Dark copy</Choice>
        </div>
      </div>
    </>
  );
}

function VisibilityControls({ settings, change, destination, field }: { settings: CreativeSettings; change: Change; destination: CreativeDestination; field?: FieldFor }) {
  const items: Array<[keyof CreativeSettings, string, boolean]> = [
    ["showLogo", "Logo", false],
    ["showBusinessName", "Business name", false],
    ["showHeadline", "Headline", false],
    ["showOffer", "Offer", false],
    ["showCta", "CTA", false],
    ["showQr", "QR", destination === "mailer"],
    ["showDescription", "Description", false],
    ["showExpiration", "Expiration", false],
    ["showPhone", "Phone", false],
    ["showWebsite", "Website", false],
    ["showSponsorBadge", "Sponsor badge", false],
  ];
  return (
    <>
      {items.map(([key, label, required]) => (
        <div key={key}>
          <Toggle
            label={label}
            checked={key === "showDescription" ? settings.showDescription !== false : Boolean(settings[key])}
            disabled={required}
            meta={field?.([key], `${label} visibility`)}
            onChange={value => change({ [key]: value })}
          />
          {required && <p className="mt-1 text-[9px] text-amber-200">Required for this print placement.</p>}
        </div>
      ))}
    </>
  );
}

function PrintControls({
  settings,
  change,
  destination,
  proofGuides,
  onProofGuidesChange,
}: {
  settings: CreativeSettings;
  change: Change;
  destination: CreativeDestination;
  proofGuides?: ProofGuides;
  onProofGuidesChange?: (g: ProofGuides) => void;
}) {
  if (destination === "mailer" && proofGuides && onProofGuidesChange) {
    return (
      <>
        <p className="text-[9px] leading-relaxed text-[var(--text-muted)]">
          Guide overlays appear on the proof and disappear on reload — they do not save to the creative.
        </p>
        <Toggle
          label="Safe area"
          checked={proofGuides.safe}
          onChange={safe => onProofGuidesChange({ ...proofGuides, safe })}
        />
        <Toggle
          label="Bleed"
          checked={proofGuides.bleed}
          onChange={bleed => onProofGuidesChange({ ...proofGuides, bleed })}
        />
        <Toggle
          label="QR minimum size"
          checked={proofGuides.qr}
          onChange={qr => onProofGuidesChange({ ...proofGuides, qr })}
        />
        <p className="rounded-xl bg-amber-400/[0.08] p-2 text-[9px] leading-relaxed text-amber-100">
          Saving print changes increments the rendered revision, invalidates preflight, and makes the Production Candidate stale.
        </p>
      </>
    );
  }
  return (
    <>
      <Toggle label="Safe area overlay" checked={settings.safeAreaVisible} onChange={safeAreaVisible => change({ safeAreaVisible })} />
      <Toggle label="Bleed overlay" checked={settings.bleedVisible} disabled={destination !== "mailer"} onChange={bleedVisible => change({ bleedVisible })} />
      <Toggle label="QR minimum-size overlay" checked={settings.qrMinimumVisible} onChange={qrMinimumVisible => change({ qrMinimumVisible })} />
      <p className="rounded-xl bg-amber-400/[0.08] p-2 text-[9px] leading-relaxed text-amber-100">
        A destination-only digital override leaves Mailer production current.
      </p>
    </>
  );
}

type Change = (patch: Partial<CreativeSettings>, options?: { transient?: boolean }) => void;

/**
 * Amber marker for a field whose override value differs from Global.
 * Clicking it reverts the field to the Global value.
 */
function OverrideMark({ meta }: { meta?: FieldMeta }) {
  if (!meta?.overridden) return null;
  if (!meta.onRevert) {
    return <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300" role="img" aria-label={`${meta.label} differs from Global`} />;
  }
  return (
    <button
      type="button"
      onClick={meta.onRevert}
      title="Revert to Global"
      aria-label={`Revert ${meta.label} to Global`}
      className="inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded-full bg-amber-300/10 px-1.5 text-amber-300 transition hover:bg-amber-300/20"
    >
      <span className="block h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden="true" />
      <RotateCcw className="h-2.5 w-2.5" aria-hidden="true" />
    </button>
  );
}

function Range({ label, value, min, max, step = 1, suffix, onChange, onCommit, meta }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void; onCommit?: () => void; meta?: FieldMeta }) {
  return (
    <label className="block">
      <span className="mb-1 flex justify-between text-[10px] font-bold">
        <span className="flex items-center gap-1.5">{label}<OverrideMark meta={meta} /></span>
        <span className="text-[var(--text-muted)]">{value.toFixed(step < 1 ? 1 : 0)}{suffix}</span>
      </span>
      <input
        aria-label={label}
        aria-valuetext={`${value}${suffix}`}
        type="range"
        className="h-11 w-full accent-[var(--brand-primary)]"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={event => onChange(Number(event.target.value))}
        onPointerUp={onCommit}
        onKeyUp={onCommit}
        onBlur={onCommit}
      />
    </label>
  );
}

function Toggle({ label, checked, disabled = false, onChange, meta }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void; meta?: FieldMeta }) {
  return <label className="flex min-h-11 items-center justify-between gap-3 text-[10px] font-bold"><span className="flex items-center gap-1.5">{label}<OverrideMark meta={meta} /></span><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} className="h-5 w-5 accent-[var(--brand-primary)]" /></label>;
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
