import { useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Check, ChevronDown, Eye, Grid2X2, Loader2,
  QrCode, Redo2, RotateCcw, Save, Smartphone, Undo2,
} from "lucide-react";
import { AdpadzButton, AdpadzCard } from "../../components/adpadz-ui";
import CircularPadQR from "../../components/qr/CircularPadQR";
import {
  CAMPAIGN_TEMPLATES,
  CampaignTemplateRenderer,
  normalizeCampaignContent,
} from "../../features/campaign-templates";
import {
  DEFAULT_WORKSHOP_STATE,
  affectsPrint,
  createHistory,
  destinationToRenderer,
  normalizeWorkshopState,
  pushHistory,
  redoHistory,
  resetCreativeDestination,
  resolveCreativeSettings,
  undoHistory,
  updateCreativeSettings,
  type CreativeDestination,
  type CreativeSettings,
  type CreativeWorkshopState,
} from "../../features/campaign-templates/creativeWorkshop";
import type { CampaignOutputRecord, CampaignRecord } from "../../lib/ads";
import type { QRLinkRecord } from "../../lib/qr/qrTypes";
import { supabase } from "../../lib/supabase";

type Asset = { id: string; title: string; file_url: string | null; external_url: string | null; thumbnail_url: string | null };
type Profile = { business_name: string; logo_url: string | null; cover_image_url: string | null; primary_color: string | null; accent_color: string | null };
type Business = { name: string; phone: string | null; website: string | null };
type Loaded = { campaign: CampaignRecord; output: CampaignOutputRecord | null; assets: Asset[]; profile: Profile | null; business: Business | null; qrs: QRLinkRecord[] };
type Scope = "global" | "destination";

const destinations = [
  { key: "mailer", name: "Community Mailer", icon: Grid2X2, detail: "Print-safe neighborhood placement" },
  { key: "discovery", name: "Consumer Discovery", icon: Eye, detail: "Campaign-first browsing" },
  { key: "qr", name: "QR Landing", icon: QrCode, detail: "Scan destination experience" },
  { key: "social", name: "Social Media", icon: Smartphone, detail: "Square, portrait, landscape, story" },
] as const;

const formats: Record<CreativeDestination, Array<{ key: string; label: string; detail: string; ratio: string }>> = {
  mailer: [
    { key: "standard", label: "Standard", detail: "Everyday placement", ratio: "4 / 3" },
    { key: "combined", label: "Combined", detail: "Wide print placement", ratio: "16 / 9" },
    { key: "featured", label: "Featured Sponsor", detail: "Eligible premium placement", ratio: "4 / 3" },
  ],
  discovery: [{ key: "card", label: "Discovery Card", detail: "Campaign feed", ratio: "1 / 1" }],
  qr: [{ key: "hero", label: "Landing Hero", detail: "Mobile destination", ratio: "3 / 4" }],
  social: [
    { key: "square", label: "Square", detail: "1080 × 1080", ratio: "1 / 1" },
    { key: "portrait", label: "Portrait", detail: "1080 × 1350", ratio: "4 / 5" },
    { key: "landscape", label: "Landscape", detail: "1200 × 628", ratio: "1200 / 628" },
    { key: "story", label: "Story", detail: "1080 × 1920", ratio: "9 / 16" },
  ],
};

export default function CampaignCreativeWorkshop() {
  const { campaignId = "" } = useParams();
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [history, dispatch] = useReducer(historyReducer, createHistory(DEFAULT_WORKSHOP_STATE));
  const [saved, setSaved] = useState(DEFAULT_WORKSHOP_STATE);
  const [destination, setDestination] = useState<CreativeDestination>("mailer");
  const [scope, setScope] = useState<Scope>("global");
  const [format, setFormat] = useState("standard");
  const [zoom, setZoom] = useState("fit");
  const [activeInspector, setActiveInspector] = useState("Template");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void loadWorkshop(campaignId).then(result => {
      if (cancelled) return;
      setLoaded(result.loaded);
      setSaved(result.state);
      dispatch({ type: "replace", value: result.state });
    }).catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not open Creative Workshop."); });
    return () => { cancelled = true; };
  }, [campaignId]);

  const state = history.present;
  const settings = resolveCreativeSettings(state, destination);
  const dirty = JSON.stringify(state) !== JSON.stringify(saved);
  const selectedQr = loaded?.qrs.find(qr => qr.id === settings.qrId) ?? null;
  const selectedAsset = loaded?.assets.find(asset => asset.id === loaded.campaign.primary_image_id) ?? null;
  const imageUrl = selectedAsset?.file_url || selectedAsset?.thumbnail_url || selectedAsset?.external_url || loaded?.profile?.cover_image_url || null;
  const content = useMemo(() => loaded ? normalizeCampaignContent({
    campaign: loaded.campaign,
    businessName: loaded.business?.name || loaded.profile?.business_name,
    businessLogoUrl: loaded.profile?.logo_url,
    imageUrl,
    destinationUrl: selectedQr ? `${window.location.origin}/q/${selectedQr.slug}` : loaded.campaign.cta_url,
    primaryColor: loaded.profile?.primary_color,
    accentColor: loaded.profile?.accent_color,
  }) : null, [imageUrl, loaded, selectedQr]);

  function change(patch: Partial<CreativeSettings>) {
    dispatch({ type: "push", value: updateCreativeSettings(state, destination, scope, patch) });
  }

  async function save() {
    if (!loaded) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const metadata = { ...(loaded.output?.metadata ?? {}), creative_workshop: state, template_settings: state.global };
      const { error: outputError } = await supabase.from("campaign_outputs").upsert({
        campaign_id: loaded.campaign.id,
        output_type: "interactive_ad",
        enabled: true,
        sort_order: loaded.output?.sort_order ?? 0,
        metadata,
      });
      if (outputError) throw new Error(outputError.message);
      if (affectsPrint(saved, state)) {
        const { error: revisionError } = await supabase.from("campaigns")
          .update({ title: loaded.campaign.title })
          .eq("id", loaded.campaign.id)
          .eq("owner_id", loaded.campaign.owner_id);
        if (revisionError) throw new Error(revisionError.message);
      }
      const [campaignResult, outputResult] = await Promise.all([
        supabase.from("campaigns").select("*").eq("id", loaded.campaign.id).single(),
        supabase.from("campaign_outputs").select("*").eq("campaign_id", loaded.campaign.id).eq("output_type", "interactive_ad").single(),
      ]);
      if (campaignResult.error) throw new Error(campaignResult.error.message);
      if (outputResult.error) throw new Error(outputResult.error.message);
      const reloaded = outputResult.data as CampaignOutputRecord;
      const authoritative = normalizeWorkshopState(reloaded.metadata?.creative_workshop ?? reloaded.metadata?.template_settings);
      setLoaded(current => current ? { ...current, campaign: campaignResult.data as CampaignRecord, output: reloaded } : current);
      setSaved(authoritative);
      dispatch({ type: "replace", value: authoritative });
      setMessage(affectsPrint(saved, state) ? "Creative saved. Print preflight must be confirmed again." : "Creative saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save creative settings.");
    } finally {
      setSaving(false);
    }
  }

  if (error && !loaded) return <AdpadzCard variant="flat" role="alert" className="border-red-400/30 bg-red-500/10 text-red-100">{error}</AdpadzCard>;
  if (!loaded || !content) return <p className="flex min-h-64 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-5 w-5 animate-spin text-neon" /> Opening Creative Workshop...</p>;

  const currentFormat = formats[destination].find(item => item.key === format) ?? formats[destination][0];
  const rendererSettings = { ...settings, showQr: false };
  const previewScale = zoom === "50" ? "max-w-[360px]" : zoom === "100" ? "max-w-[720px]" : "max-w-[620px]";

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden min-h-[calc(100vh-7rem)] space-y-4">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[var(--bg-base)]/95 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="flex items-center gap-3">
          <AdpadzButton type="button" variant="icon" size="sm" aria-label="Back to campaign" onClick={() => navigate(`/app/business/campaigns/${campaignId}/edit`)}><ArrowLeft className="h-4 w-4" /></AdpadzButton>
          <div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-neon">Campaign Creative Workshop</p><h1 className="text-lg font-black sm:text-xl">{loaded.campaign.title}</h1></div>
        </div>
        <div className="flex items-center gap-2">
          <span role="status" aria-live="polite" className={`text-xs font-bold ${dirty ? "text-amber-300" : "text-[var(--text-muted)]"}`}>{dirty ? "Unsaved changes" : "Saved"}</span>
          <AdpadzButton type="button" variant="icon" size="sm" aria-label="Undo creative change" disabled={!history.past.length} onClick={() => dispatch({ type: "undo" })}><Undo2 className="h-4 w-4" /></AdpadzButton>
          <AdpadzButton type="button" variant="icon" size="sm" aria-label="Redo creative change" disabled={!history.future.length} onClick={() => dispatch({ type: "redo" })}><Redo2 className="h-4 w-4" /></AdpadzButton>
          <AdpadzButton type="button" onClick={() => void save()} disabled={!dirty || saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Creative</AdpadzButton>
        </div>
      </header>
      {(error || message) && <div role={error ? "alert" : "status"} className={`mx-4 rounded-2xl border p-3 text-sm font-bold sm:mx-6 ${error ? "border-red-400/30 bg-red-500/10 text-red-100" : "border-neon/25 bg-neon/[0.08] text-neon"}`}>{error || message}</div>}

      <div className="grid gap-4 px-4 pb-24 sm:px-6 xl:grid-cols-[220px_minmax(440px,1fr)_340px] xl:pb-6">
        <nav aria-label="Creative destinations" className="order-2 min-w-0 max-w-full xl:order-1">
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Destination</p>
          <div className="flex gap-2 overflow-x-auto pb-2 xl:block xl:space-y-2">
            {destinations.map(item => {
              const active = destination === item.key;
              const overridden = Boolean(state.overrides[item.key]);
              return <button key={item.key} type="button" aria-pressed={active} onClick={() => { setDestination(item.key); setFormat(formats[item.key][0].key); }} className={`min-w-[190px] rounded-2xl border p-3 text-left transition duration-200 xl:w-full ${active ? "border-neon bg-neon/[0.09]" : "border-white/10 bg-white/[0.025] hover:bg-white/[0.06]"}`}>
                <span className="flex items-center gap-2"><item.icon className={`h-4 w-4 ${active ? "text-neon" : "text-[var(--text-muted)]"}`} /><span className="text-xs font-black">{item.name}</span></span>
                <span className="mt-1 block text-[10px] text-[var(--text-muted)]">{item.detail}</span>
                <span className={`mt-2 block text-[10px] font-bold ${overridden ? "text-amber-300" : "text-neon"}`}>{overridden ? "Custom override" : "Ready · Global"}</span>
              </button>;
            })}
          </div>
          <AdpadzButton href={`/app/business/campaigns/${campaignId}/distribution`} variant="secondary" size="sm" fullWidth className="mt-3">Continue to Distribution</AdpadzButton>
        </nav>

        <main className="order-1 min-w-0 xl:order-2">
          <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 overflow-x-auto" role="listbox" aria-label={`${destination} format`}>
              {formats[destination].map(item => <button key={item.key} type="button" role="option" aria-selected={currentFormat.key === item.key} onClick={() => setFormat(item.key)} className={`min-w-28 rounded-xl border px-3 py-2 text-left ${currentFormat.key === item.key ? "border-neon bg-neon/10" : "border-white/10"}`}><span className="block text-[11px] font-black">{item.label}</span><span className="block text-[9px] text-[var(--text-muted)]">{item.detail}</span></button>)}
            </div>
            <div className="flex shrink-0 gap-1" aria-label="Preview zoom">{["fit", "50", "100"].map(value => <button key={value} type="button" aria-pressed={zoom === value} onClick={() => setZoom(value)} className={`min-h-9 rounded-full px-3 text-[10px] font-black ${zoom === value ? "bg-neon text-black" : "bg-white/[0.06]"}`}>{value === "fit" ? "Fit" : `${value}%`}</button>)}</div>
          </div>
          <AdpadzCard variant="featured" className="flex min-h-[520px] items-center justify-center p-4 sm:p-8">
            <div className={`relative w-full transition-all duration-200 ${previewScale}`} style={{ aspectRatio: currentFormat.ratio, containerType: "inline-size", filter: `brightness(${settings.brightness}%) contrast(${settings.contrast}%) saturate(${settings.saturation}%)` }}>
              <CampaignTemplateRenderer content={content} settings={rendererSettings} destination={destinationToRenderer(destination)} className="rounded-2xl" />
              {settings.overlayEnabled && <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: overlay(settings) }} />}
              {selectedQr && settings.showQr && <div className="absolute bottom-[5%] right-[5%] w-[19%] overflow-hidden rounded-full bg-white shadow-xl"><CircularPadQR value={`${window.location.origin}/q/${selectedQr.slug}`} size={420} title={selectedQr.title} preset={selectedQr.style_preset} topText={selectedQr.top_ring_text ?? ""} bottomText={selectedQr.bottom_ring_text ?? ""} centerLabel={selectedQr.center_label ?? ""} foregroundColor={selectedQr.foreground_color} backgroundColor={selectedQr.background_color} accentColor={selectedQr.accent_color} logoDataUrl={selectedQr.logo_data_url} ornamentStyle={selectedQr.ornament_style} /></div>}
              {settings.bleedVisible && <div className="pointer-events-none absolute inset-[2%] rounded-xl border border-dashed border-red-400" aria-label="Bleed overlay" />}
              {settings.safeAreaVisible && <div className="pointer-events-none absolute inset-[7%] rounded-xl border border-dashed border-amber-300" aria-label="Safe area overlay" />}
              {settings.qrMinimumVisible && <div className="pointer-events-none absolute bottom-[5%] right-[5%] h-[20%] w-[20%] rounded-lg border-2 border-dashed border-neon" aria-label="Minimum QR size overlay" />}
            </div>
          </AdpadzCard>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--text-muted)]"><span>{destinations.find(item => item.key === destination)?.name} · {currentFormat.label} · {settings.template}</span><span>{affectsPrint(saved, state) ? "Print readiness will require reconfirmation" : destination === "social" && scope === "destination" ? "Social-only override · print remains current" : "Production definition shared"}</span></div>
        </main>

        <aside aria-label="Creative inspector" className="order-3 min-w-0 max-w-full rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
          <div className="mb-3 rounded-2xl bg-white/[0.04] p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Scope</p>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1">
              <button type="button" aria-pressed={scope === "global"} onClick={() => setScope("global")} className={`min-h-9 rounded-lg text-[10px] font-black ${scope === "global" ? "bg-neon text-black" : ""}`}>All destinations</button>
              <button type="button" aria-pressed={scope === "destination"} onClick={() => setScope("destination")} className={`min-h-9 rounded-lg text-[10px] font-black ${scope === "destination" ? "bg-neon text-black" : ""}`}>{destinations.find(item => item.key === destination)?.name}</button>
            </div>
          </div>
          {["Template", "Image", "Overlay", "QR", "Text", "Branding", "Visibility", "Print Safety"].map(section => <InspectorSection key={section} title={section} open={activeInspector === section} onToggle={() => setActiveInspector(activeInspector === section ? "" : section)}>
            {section === "Template" && <TemplateControls settings={settings} change={change} destination={destination} />}
            {section === "Image" && <ImageControls settings={settings} change={change} />}
            {section === "Overlay" && <OverlayControls settings={settings} change={change} />}
            {section === "QR" && <QrControls qrs={loaded.qrs} settings={settings} change={change} campaignId={campaignId} />}
            {section === "Text" && <TextControls settings={settings} change={change} />}
            {section === "Branding" && <BrandControls settings={settings} change={change} />}
            {section === "Visibility" && <VisibilityControls settings={settings} change={change} destination={destination} />}
            {section === "Print Safety" && <PrintControls settings={settings} change={change} destination={destination} />}
          </InspectorSection>)}
          <AdpadzButton type="button" variant="secondary" size="sm" fullWidth className="mt-3" onClick={() => dispatch({ type: "push", value: resetCreativeDestination(state, destination) })}><RotateCcw className="h-4 w-4" /> Reset current destination</AdpadzButton>
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-950/95 p-3 backdrop-blur-xl xl:hidden"><AdpadzButton type="button" fullWidth onClick={() => void save()} disabled={!dirty || saving}><Save className="h-4 w-4" /> {dirty ? "Save Creative" : "Creative Saved"}</AdpadzButton></div>
    </div>
  );
}

function InspectorSection({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return <section className="border-b border-white/10"><button type="button" className="flex min-h-12 w-full items-center justify-between text-left text-xs font-black" aria-expanded={open} onClick={onToggle}><span>{title}</span><ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180 text-neon" : "text-[var(--text-muted)]"}`} /></button>{open && <div className="space-y-3 pb-4">{children}</div>}</section>;
}
function TemplateControls({ settings, change, destination }: { settings: CreativeSettings; change: (patch: Partial<CreativeSettings>) => void; destination: CreativeDestination }) {
  return <div className="grid gap-2">{CAMPAIGN_TEMPLATES.filter(template => template.key !== "featured-sponsor" || destination === "mailer").map(template => <button key={template.key} type="button" aria-pressed={settings.template === template.key} onClick={() => change({ template: template.key })} className={`rounded-2xl border p-3 text-left ${settings.template === template.key ? "border-neon bg-neon/[0.08]" : "border-white/10"}`}><span className="flex items-center justify-between text-xs font-black">{template.label}{settings.template === template.key && <Check className="h-4 w-4 text-neon" />}</span><span className="mt-1 block text-[9px] leading-relaxed text-[var(--text-muted)]">{template.description}</span><span className="mt-2 block text-[9px] font-bold text-[var(--text-secondary)]">{template.bestFor}</span></button>)}</div>;
}
function ImageControls({ settings, change }: { settings: CreativeSettings; change: (patch: Partial<CreativeSettings>) => void }) {
  return <><div className="grid grid-cols-2 gap-2"><Choice selected={settings.imageFit === "cover"} onClick={() => change({ imageFit: "cover" })}>Fill</Choice><Choice selected={settings.imageFit === "contain"} onClick={() => change({ imageFit: "contain", imageZoom: 1 })}>Contain</Choice></div><Range label="Horizontal position" value={settings.imagePositionX} min={0} max={100} suffix="%" onChange={imagePositionX => change({ imagePositionX })} /><Range label="Vertical position" value={settings.imagePositionY} min={0} max={100} suffix="%" onChange={imagePositionY => change({ imagePositionY })} /><Range label="Zoom" value={settings.imageZoom} min={1} max={3} step={0.05} suffix="×" onChange={imageZoom => change({ imageZoom })} /><Range label="Rotation" value={settings.rotation} min={-5} max={5} step={0.5} suffix="°" onChange={rotation => change({ rotation })} /><Range label="Brightness" value={settings.brightness} min={25} max={175} suffix="%" onChange={brightness => change({ brightness })} /><Range label="Contrast" value={settings.contrast} min={25} max={175} suffix="%" onChange={contrast => change({ contrast })} /><Range label="Saturation" value={settings.saturation} min={0} max={200} suffix="%" onChange={saturation => change({ saturation })} /></>;
}
function OverlayControls({ settings, change }: { settings: CreativeSettings; change: (patch: Partial<CreativeSettings>) => void }) {
  return <><Toggle label="Enable overlay" checked={settings.overlayEnabled} onChange={overlayEnabled => change({ overlayEnabled })} /><label className="block text-[10px] font-bold">Overlay style<select className="input-field mt-1" value={settings.overlayStyle} onChange={event => change({ overlayStyle: event.target.value as CreativeSettings["overlayStyle"] })}><option value="bottom-fade">Bottom fade</option><option value="top-fade">Top fade</option><option value="linear">Linear gradient</option><option value="radial">Radial gradient</option><option value="solid">Solid</option></select></label><label className="flex items-center justify-between text-[10px] font-bold">Overlay color<input type="color" value={settings.overlayColor} onChange={event => change({ overlayColor: event.target.value })} className="h-9 w-14 rounded-lg bg-transparent" /></label><Range label="Opacity" value={settings.overlayOpacity} min={0} max={100} suffix="%" onChange={overlayOpacity => change({ overlayOpacity })} /><Range label="Direction" value={settings.overlayDirection} min={0} max={360} suffix="°" onChange={overlayDirection => change({ overlayDirection })} /><Range label="Spread" value={settings.overlaySpread} min={0} max={100} suffix="%" onChange={overlaySpread => change({ overlaySpread })} /></>;
}
function QrControls({ qrs, settings, change, campaignId }: { qrs: QRLinkRecord[]; settings: CreativeSettings; change: (patch: Partial<CreativeSettings>) => void; campaignId: string }) {
  return <><Toggle label="Show QR" checked={settings.showQr} onChange={showQr => change({ showQr })} /><div role="listbox" aria-label="Choose from QR Studio" className="max-h-72 space-y-2 overflow-y-auto">{qrs.map(qr => <button key={qr.id} type="button" role="option" aria-selected={settings.qrId === qr.id} onClick={() => change({ qrId: qr.id, showQr: true })} className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left ${settings.qrId === qr.id ? "border-neon bg-neon/[0.08]" : "border-white/10"}`}><span className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-white"><CircularPadQR value={`${window.location.origin}/q/${qr.slug}`} size={240} preset={qr.style_preset} foregroundColor={qr.foreground_color} backgroundColor={qr.background_color} accentColor={qr.accent_color} /></span><span className="min-w-0"><span className="block truncate text-[10px] font-black">{qr.title}</span><span className="block text-[9px] text-[var(--text-muted)]">{qr.status} · {qr.scan_count} scans</span><span className="block truncate text-[9px] text-[var(--text-muted)]">/q/{qr.slug}</span></span></button>)}</div><AdpadzButton href={`/app/business/qr-studio?campaign=${campaignId}`} variant="secondary" size="sm" fullWidth><QrCode className="h-4 w-4" /> Create New QR</AdpadzButton></>;
}
function TextControls({ settings, change }: { settings: CreativeSettings; change: (patch: Partial<CreativeSettings>) => void }) {
  return <><label className="block text-[10px] font-bold">Headline size<select className="input-field mt-1" value={settings.headlineSize} onChange={event => change({ headlineSize: event.target.value as CreativeSettings["headlineSize"] })}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label><div className="grid grid-cols-3 gap-1">{(["left", "center", "right"] as const).map(value => <Choice key={value} selected={settings.textAlign === value} onClick={() => change({ textAlign: value })}>{value}</Choice>)}</div><label className="block text-[10px] font-bold">Text panel<select className="input-field mt-1" value={settings.textPanel} onChange={event => change({ textPanel: event.target.value as CreativeSettings["textPanel"] })}><option value="none">None</option><option value="soft">Soft panel</option><option value="solid">Solid panel</option><option value="gradient">Gradient panel</option></select></label></>;
}
function BrandControls({ settings, change }: { settings: CreativeSettings; change: (patch: Partial<CreativeSettings>) => void }) {
  return <><p className="text-[9px] leading-relaxed text-[var(--text-muted)]">Defaults come from Business Hub. Overrides remain presentation metadata.</p><label className="flex items-center justify-between text-[10px] font-bold">Primary color<input type="color" value={settings.primaryColorOverride ?? "#14251b"} onChange={event => change({ primaryColorOverride: event.target.value })} /></label><label className="flex items-center justify-between text-[10px] font-bold">Accent color<input type="color" value={settings.accentColorOverride ?? "#b6ff00"} onChange={event => change({ accentColorOverride: event.target.value })} /></label><div className="grid grid-cols-2 gap-2"><Choice selected={settings.theme === "dark"} onClick={() => change({ theme: "dark" })}>Dark text</Choice><Choice selected={settings.theme === "light"} onClick={() => change({ theme: "light" })}>Light text</Choice></div></>;
}
function VisibilityControls({ settings, change, destination }: { settings: CreativeSettings; change: (patch: Partial<CreativeSettings>) => void; destination: CreativeDestination }) {
  const items: Array<[keyof CreativeSettings, string, boolean]> = [["showLogo", "Logo", false], ["showBusinessName", "Business name", false], ["showHeadline", "Headline", false], ["showOffer", "Offer", false], ["showCta", "CTA", false], ["showQr", "QR", destination === "mailer"], ["showExpiration", "Expiration", false], ["showPhone", "Phone", false], ["showWebsite", "Website", false], ["showSponsorBadge", "Sponsor badge", false]];
  return <>{items.map(([key, label, required]) => <div key={key}><Toggle label={label} checked={Boolean(settings[key])} disabled={required} onChange={value => change({ [key]: value })} />{required && <p className="mt-1 text-[9px] text-amber-200">QR is required for this print placement.</p>}</div>)}</>;
}
function PrintControls({ settings, change, destination }: { settings: CreativeSettings; change: (patch: Partial<CreativeSettings>) => void; destination: CreativeDestination }) {
  return <><Toggle label="Safe area overlay" checked={settings.safeAreaVisible} onChange={safeAreaVisible => change({ safeAreaVisible })} /><Toggle label="Bleed overlay" checked={settings.bleedVisible} disabled={destination !== "mailer"} onChange={bleedVisible => change({ bleedVisible })} /><Toggle label="QR minimum-size overlay" checked={settings.qrMinimumVisible} onChange={qrMinimumVisible => change({ qrMinimumVisible })} /><p className="rounded-xl bg-amber-400/[0.08] p-2 text-[9px] leading-relaxed text-amber-100">{destination === "mailer" ? "Saving print changes invalidates current preflight and makes the Production Candidate stale." : "This destination does not change print production when saved as an override."}</p></>;
}
function Range({ label, value, min, max, step = 1, suffix, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; onChange: (value: number) => void }) {
  return <label className="block"><span className="mb-1 flex justify-between text-[10px] font-bold"><span>{label}</span><span className="text-[var(--text-muted)]">{value.toFixed(step < 1 ? 1 : 0)}{suffix}</span></span><input aria-label={label} type="range" className="w-full accent-[var(--brand-primary)]" value={value} min={min} max={max} step={step} onChange={event => onChange(Number(event.target.value))} /></label>;
}
function Toggle({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-10 items-center justify-between gap-3 text-[10px] font-bold"><span>{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} className="h-5 w-5 accent-[var(--brand-primary)]" /></label>;
}
function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`min-h-9 rounded-xl border px-2 text-[10px] font-black capitalize ${selected ? "border-neon bg-neon/10 text-neon" : "border-white/10"}`}>{children}</button>;
}
function overlay(settings: CreativeSettings) {
  const alpha = Math.round(settings.overlayOpacity * 2.55).toString(16).padStart(2, "0");
  const opaque = `${settings.overlayColor}${alpha}`;
  const clear = `${settings.overlayColor}00`;
  if (settings.overlayStyle === "solid") return opaque;
  if (settings.overlayStyle === "radial") return `radial-gradient(circle, ${clear}, ${opaque} ${settings.overlaySpread}%)`;
  if (settings.overlayStyle === "top-fade") return `linear-gradient(180deg, ${opaque}, ${clear} ${settings.overlaySpread}%)`;
  if (settings.overlayStyle === "linear") return `linear-gradient(${settings.overlayDirection}deg, ${opaque}, ${clear} ${settings.overlaySpread}%)`;
  return `linear-gradient(0deg, ${opaque}, ${clear} ${settings.overlaySpread}%)`;
}
type HistoryAction = { type: "push" | "replace"; value: CreativeWorkshopState } | { type: "undo" | "redo" };
function historyReducer(history: ReturnType<typeof createHistory<CreativeWorkshopState>>, action: HistoryAction) {
  if (action.type === "push") return pushHistory(history, action.value);
  if (action.type === "replace") return createHistory(action.value);
  if (action.type === "undo") return undoHistory(history);
  return redoHistory(history);
}
async function loadWorkshop(campaignId: string) {
  const auth = await supabase.auth.getUser();
  if (auth.error) throw new Error(auth.error.message);
  if (!auth.data.user) throw new Error("Sign in to open Creative Workshop.");
  const ownerId = auth.data.user.id;
  const campaignResult = await supabase.from("campaigns").select("*").eq("id", campaignId).eq("owner_id", ownerId).single();
  if (campaignResult.error) throw new Error(campaignResult.error.message);
  const campaign = campaignResult.data as CampaignRecord;
  const [outputResult, assetList, profileResult, businessResult, qrResult] = await Promise.all([
    supabase.from("campaign_outputs").select("*").eq("campaign_id", campaignId).eq("output_type", "interactive_ad").maybeSingle(),
    supabase.from("business_marketing_assets").select("id,title,file_url,external_url,thumbnail_url").eq("owner_id", ownerId).eq("is_active", true).order("updated_at", { ascending: false }),
    supabase.from("business_cards").select("business_name,logo_url,cover_image_url,primary_color,accent_color").eq("owner_user_id", ownerId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("businesses").select("name,phone,website").eq("owner_user_id", ownerId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("qr_links").select("*").eq("owner_user_id", ownerId).order("updated_at", { ascending: false }),
  ]);
  for (const result of [outputResult, assetList, profileResult, businessResult, qrResult]) if (result.error) throw new Error(result.error.message);
  const output = outputResult.data as CampaignOutputRecord | null;
  return {
    loaded: { campaign, output, assets: (assetList.data ?? []) as Asset[], profile: profileResult.data as Profile | null, business: businessResult.data as Business | null, qrs: (qrResult.data ?? []) as QRLinkRecord[] },
    state: normalizeWorkshopState(output?.metadata?.creative_workshop ?? output?.metadata?.template_settings),
  };
}
