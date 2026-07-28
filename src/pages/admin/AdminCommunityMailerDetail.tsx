import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Eye,
  Printer,
  Settings,
  X,
} from "lucide-react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { AdpadzButton, AdpadzCard } from "../../components/adpadz-ui";
import AdminEmptyState from "../../components/admin/AdminEmptyState";
import type { AdminOutletContext } from "../../components/admin/AdminGuard";
import CommunityMailerCanvas from "../../components/community-mailer/CommunityMailerCanvas";
import CommunityMailerLegend from "../../components/community-mailer/CommunityMailerLegend";
import CommunityMailerSideTabs from "../../components/community-mailer/CommunityMailerSideTabs";
import CommunityMailerToolbar, {
  type CommunityMailerRowPattern,
} from "../../components/community-mailer/CommunityMailerToolbar";
import CommunityMailerSettingsDrawer from "../../components/community-mailer/CommunityMailerSettingsDrawer";
import PlacementEditorDrawer from "../../components/community-mailer/PlacementEditorDrawer";
import CommunityMailerProductionPanel from "../../components/community-mailer/CommunityMailerProductionPanel";
import CommunityMailerCandidatePanel from "../../components/community-mailer/CommunityMailerCandidatePanel";
import { formatCurrency } from "../../lib/communityCards";
import {
  type AdminMailerDetail,
  type AdminPlacement,
  applyAdminMailerTemplate,
  confirmAdminMailerPreflight,
  getAdminMailer,
  recordAdminMailerPreflight,
  transitionAdminMailerProduction,
  updateAdminMailer,
  updateAdminPlacement,
} from "../../lib/admin/communityMailers";
import {
  type LayoutPlacement,
  validateMailerLayout,
} from "../../lib/communityMailerLayout";
import {
  type CampaignTemplateSettings,
  type CreativeSettings,
  normalizeCreativeSettings,
  resolveDestinationCreative,
} from "../../features/campaign-templates";
import { supabase } from "../../lib/supabase";

export default function AdminCommunityMailerDetail() {
  const { profile } = useOutletContext<AdminOutletContext>();
  const canManage = profile.role === "owner" || profile.role === "admin";
  const { mailerId } = useParams();
  const [data, setData] = useState<AdminMailerDetail>(),
    [draft, setDraft] = useState<AdminPlacement[]>([]);
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [side, setSide] = useState<"front" | "back">("front");
  const [selectedId, setSelectedId] = useState<string>(),
    [topPattern, setTopPattern] = useState<CommunityMailerRowPattern>(
      "double_pair",
    ),
    [bottomPattern, setBottomPattern] = useState<CommunityMailerRowPattern>(
      "singles",
    );
  const [printOpen, setPrintOpen] = useState(false),
    [showProductionGuides, setShowProductionGuides] = useState(true),
    [customerPreviewOpen, setCustomerPreviewOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [settingsDirty, setSettingsDirty] = useState(false),
    [applyingTemplate, setApplyingTemplate] = useState(false);
  const settingsDraftKey = mailerId
    ? `adpadz:community-mailer:settings-draft:${mailerId}`
    : "";
  const load = useCallback(async () => {
    if (!mailerId) return;
    setLoading(true);
    setError("");
    const result = await getAdminMailer(mailerId);
    if (result.error) setError(result.error.message);
    else {
      const payload = result.data as AdminMailerDetail;
      const next = { ...payload, qr_links: payload.qr_links || [] };
      setData(next);
      setDraft(next.placements);
    }
    setLoading(false);
  }, [mailerId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!settingsDraftKey) return;
    const recovered = hasSessionDraft(settingsDraftKey);
    setSettingsDirty(recovered);
    if (recovered) setSettingsOpen(true);
  }, [settingsDraftKey]);
  useEffect(() => {
    const top = side === "front"
      ? data?.mailer.front_top_pattern
      : data?.mailer.back_top_pattern;
    const bottom = side === "front"
      ? data?.mailer.front_bottom_pattern
      : data?.mailer.back_bottom_pattern;
    setTopPattern(top || "double_pair");
    setBottomPattern(bottom || "singles");
  }, [data, side]);
  const hasUnsavedChanges = settingsDirty;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const guardLink = (event: MouseEvent) => {
      if (
        !hasUnsavedChanges || event.defaultPrevented ||
        !(event.target instanceof Element)
      ) return;
      const anchor = event.target.closest("a[href]") as
        | HTMLAnchorElement
        | null;
      if (
        !anchor || anchor.target === "_blank" || anchor.hasAttribute("download")
      ) return;
      const destination = new URL(anchor.href, window.location.href);
      if (
        destination.origin === window.location.origin &&
        !window.confirm("Leave without saving the Community Mailer layout?")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLink, true);
    };
  }, [hasUnsavedChanges]);
  useEffect(() => {
    if (!printOpen && !customerPreviewOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPrintOpen(false);
        setCustomerPreviewOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [customerPreviewOpen, printOpen]);
  const selected = useMemo(() => draft.find((item) => item.id === selectedId), [
    draft,
    selectedId,
  ]);
  // The campaign's saved Mailer creative, resolved from the same Creative
  // Workshop source the production snapshot freezes. RLS may hide another
  // tenant's non-public campaign output from this client; the current-revision
  // production snapshot (admin projection) then supplies identical settings.
  const [savedMailerCreativeByCampaign, setSavedMailerCreativeByCampaign] =
    useState<Record<string, CreativeSettings>>({});
  useEffect(() => {
    const campaignIds = Array.from(
      new Set(
        draft
          .map((placement) => placement.campaign_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );
    if (campaignIds.length === 0) {
      setSavedMailerCreativeByCampaign({});
      return;
    }
    let cancelled = false;
    void supabase
      .from("campaign_outputs")
      .select("campaign_id,metadata")
      .in("campaign_id", campaignIds)
      .eq("output_type", "interactive_ad")
      .then(({ data: rows }) => {
        if (cancelled) return;
        const next: Record<string, CreativeSettings> = {};
        for (const row of rows || []) {
          if (typeof row.campaign_id !== "string") continue;
          next[row.campaign_id] =
            resolveDestinationCreative(row.metadata, "mailer").settings;
        }
        setSavedMailerCreativeByCampaign(next);
      });
    return () => {
      cancelled = true;
    };
  }, [draft]);
  const creativeSettingsByPlacement = useMemo(() => {
    const snapshotByPlacement = new Map(
      (data?.production.snapshots || [])
        .filter((item) =>
          item.layout_revision === data?.mailer.layout_revision
        )
        .map((item) => [item.placement_id, item.snapshot]),
    );
    const map: Record<string, CampaignTemplateSettings> = {};
    for (const placement of draft) {
      if (!placement.campaign_id) continue;
      const snapshot = snapshotByPlacement.get(placement.id);
      const snapshotRaw = snapshot &&
          typeof snapshot.creative_settings === "object" &&
          snapshot.creative_settings
        ? snapshot.creative_settings
        : snapshot && typeof snapshot.template_settings === "object" &&
            snapshot.template_settings
        ? snapshot.template_settings
        : null;
      const snapshotSettings = snapshotRaw
        ? normalizeCreativeSettings(snapshotRaw)
        : undefined;
      const saved = savedMailerCreativeByCampaign[placement.campaign_id] ??
        snapshotSettings;
      if (!saved) continue;
      map[placement.id] = {
        ...saved,
        showQr: saved.showQr && Boolean(placement.qr_destination_url),
      };
    }
    return map;
  }, [
    data?.mailer.layout_revision,
    data?.production.snapshots,
    draft,
    savedMailerCreativeByCampaign,
  ]);
  const issues = useMemo(
    () =>
      data
        ? validateMailerLayout({ mailer: data.mailer, placements: draft })
        : [],
    [data, draft],
  );
  const publicPreviewPlacements = useMemo<LayoutPlacement[]>(
    () =>
      draft.map((placement) => {
        const showCreative = Boolean(placement.public_creative_visible) &&
          placement.status !== "available";
        const status = data?.mailer.sales_open &&
            placement.status === "available"
          ? "available"
          : placement.status === "unavailable" || !data?.mailer.sales_open
          ? "unavailable"
          : "occupied";
        return {
          ...placement,
          status,
          price_cents: status === "available"
            ? placement.price_cents - placement.discount_cents
            : 0,
          discount_cents: 0,
          category_exclusive: false,
          advertiser_name: showCreative ? placement.advertiser_name : null,
          business_name: showCreative ? placement.business_name : null,
          ad_image_url: showCreative ? placement.ad_image_url : null,
          creative_asset_url: showCreative
            ? placement.creative_asset_url
            : null,
          business_id: null,
          buyer_user_id: null,
          creative_asset_id: null,
          qr_link_id: null,
          qr_title: null,
          qr_destination_url: null,
          internal_notes: null,
        };
      }),
    [data?.mailer.sales_open, draft],
  );
  const printMissingArtwork = useMemo(
    () =>
      draft.filter((placement) =>
        placement.status !== "unavailable" &&
        !placement.ad_image_url && !placement.creative_asset_url
      ),
    [draft],
  );
  const metrics = useMemo(() => ({
    available: draft.filter((x) => x.status === "available").length,
    held: draft.filter((x) => x.status === "reserved").length,
    sold: draft.filter((x) =>
      ["sold", "proof", "approved"].includes(x.status)
    ).length,
    revenue: draft.filter((x) =>
      !["available", "unavailable", "intake"].includes(x.status) &&
      ["paid", "waived"].includes(x.payment_status)
    ).reduce((sum, x) => sum + x.price_cents - x.discount_cents, 0),
  }), [draft]);
  async function saveMailer(changes: Record<string, unknown>) {
    if (!mailerId) return false;
    const result = await updateAdminMailer(mailerId, changes);
    if (result.error) {
      setError(result.error.message);
      return false;
    }
    await load();
    return true;
  }
  async function savePlacement(changes: Record<string, unknown>) {
    if (!selected) return;
    const result = await updateAdminPlacement(selected.id, changes);
    if (result.error) setError(result.error.message);
    else await load();
  }
  async function applyTemplate() {
    if (!mailerId || !data || data.mailer.format !== "postcard_9x12") return;
    if (
      !window.confirm(
        `Apply the approved ${side} layout? Existing assignments and order history will block this change.`,
      )
    ) return;
    setApplyingTemplate(true);
    setError("");
    const result = await applyAdminMailerTemplate(
      mailerId,
      side,
      topPattern,
      bottomPattern,
    );
    setApplyingTemplate(false);
    if (result.error) setError(result.error.message);
    else {
      setSelectedId(undefined);
      await load();
    }
  }
  async function toggleSales() {
    if (!data || !mailerId) return;
    if (data.mailer.status === "draft" && !data.mailer.sales_open) {
      const transition = await transitionAdminMailerProduction(mailerId, "selling");
      if (transition.error) {
        setError(transition.error.message);
        return;
      }
    }
    await saveMailer({ sales_open: !data.mailer.sales_open });
  }  async function toggleLayoutLock() {
    if (!data) return;
    await saveMailer({ layout_locked: !data.mailer.layout_locked });
  }
  async function openPrintPreview() {
    setPrintOpen(true);
  }
  if (loading) {
    return (
      <p className="text-sm text-[var(--text-muted)]">
        Loading Community Mailer...
      </p>
    );
  }
  if (error && !data) {
    return (
      <AdminEmptyState
        title="Community Mailer unavailable"
        description={error}
        tone="error"
      />
    );
  }
  if (!data) return null;
  const mailer = data.mailer;
  const activeVariant = side === "front"
    ? mailer.front_layout_variant
    : mailer.back_layout_variant;
  const legacyLayout = activeVariant === "legacy_freeform";
  return (
    <div className="space-y-5">
      <Link
        to="/admin/community-mailers"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]"
      >
        <ArrowLeft className="h-4 w-4" />Community Mailers
      </Link>
      {error && (
        <AdpadzCard
          role="alert"
          className="flex items-center justify-between border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200"
        >
          <span>{error}</span>
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            <X className="h-4 w-4" />
          </button>
        </AdpadzCard>
      )}
      <header className="flex flex-col gap-4 border-b border-white/10 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-neon/20 bg-neon/10 px-2 py-1 text-[9px] font-black uppercase text-neon">
              {mailer.status}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {mailer.is_published
                ? "Booking page published"
                : "Booking page private"} /{" "}
              {mailer.sales_open ? "Sales open" : "Sales closed"}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-black">{mailer.title}</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            {mailer.zone_name || "Mailing zone missing"} /{" "}
            {mailer.mailing_date || "Mailing date missing"} /{" "}
            {mailer.household_count?.toLocaleString() || "--"} homes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <>
              <AdpadzButton
                variant="secondary"
                onClick={() => void toggleSales()}
              >
                {mailer.sales_open ? "Close sales" : "Open sales"}
              </AdpadzButton>
              <AdpadzButton
                variant="secondary"
                onClick={() =>
                  void saveMailer({ is_published: !mailer.is_published })}
              >
                {mailer.is_published ? "Unpublish" : "Publish booking"}
              </AdpadzButton>
              <AdpadzButton
                variant="secondary"
                onClick={() => {
                  setSettingsDirty(hasSessionDraft(settingsDraftKey));
                  setSettingsOpen(true);
                }}
              >
                <Settings className="h-4 w-4" />Campaign settings
              </AdpadzButton>
            </>
          )}
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-black"
            onClick={() => setCustomerPreviewOpen(true)}
          >
            <Eye className="h-4 w-4" />Customer preview
          </button>
        </div>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Filled / held"
          value={`${metrics.sold} / ${metrics.held}`}
        />
        <Metric label="Available" value={String(metrics.available)} />
        <Metric
          label="Paid / waived revenue"
          value={formatCurrency(metrics.revenue)}
        />
        <Metric label="Attention items" value={String(issues.length)} />
      </section>
      {canManage
        ? (
          <CommunityMailerToolbar
            format={mailer.format}
            side={side}
            topPattern={topPattern}
            bottomPattern={bottomPattern}
            onTopPattern={setTopPattern}
            onBottomPattern={setBottomPattern}
            onApply={() => void applyTemplate()}
            locked={mailer.layout_locked}
            onToggleLock={() => void toggleLayoutLock()}
            onPrint={() => void openPrintPreview()}
            applying={applyingTemplate}
            legacy={legacyLayout}
          />
        )
        : (
          <div className="flex items-center justify-between rounded-2xl border border-amber-300/20 bg-amber-300/5 p-3 text-xs text-amber-100">
            <span>
              Your Mission Control role has read-only Community Mailer access.
            </span>
            <button
              type="button"
              onClick={() => void openPrintPreview()}
              className="inline-flex items-center gap-2 font-black"
            >
              <Printer className="h-4 w-4" />Print preview
            </button>
          </div>
        )}
      <section className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CommunityMailerSideTabs side={side} onChange={setSide} />
            <CommunityMailerLegend />
          </div>
          <CommunityMailerCanvas
            mailer={{
              ...mailer,
              layout_locked: true,
            }}
            placements={draft}
            side={side}
            mode="admin-edit"
            selectedId={selectedId}
            onSelect={(placement) => setSelectedId(placement.id)}
            creativeSettingsById={creativeSettingsByPlacement}
          />
          <p className="text-center text-[10px] text-[var(--text-muted)]">
            Approved fixed-template preview /{" "}
            {mailer.format === "postcard_9x12" ? "12 x 9" : "11 x 6"}{" "}
            landscape proportion
          </p>
        </div>
        <AdpadzCard
          variant="flat"
          className="max-h-[calc(100vh-8rem)] overflow-y-auto rounded-2xl p-5"
        >
          {selected && canManage
            ? (
              <PlacementEditorDrawer
                key={selected.id}
                placement={selected}
                detail={data}
                onSave={savePlacement}
              />
            )
            : (
              <div className="space-y-6">
                <CommunityMailerProductionPanel
                  input={{
                    mailerId: mailer.id,
                    format: mailer.format,
                    mailingDate: mailer.mailing_date,
                    layoutRevision: mailer.layout_revision,
                    layoutLocked: mailer.layout_locked,
                    placements: draft,
                    manual: {
                      postalAreaConfirmed: mailer.postal_area_confirmed ?? false,
                      printerSpecsConfirmed: mailer.printer_specs_confirmed ?? false,
                      colorProfileConfirmed: mailer.color_profile_confirmed ?? false,
                    },
                  }}
                  onConfirm={(key, value) => {
                    const column = {
                      postalAreaConfirmed: "postal_area_confirmed",
                      printerSpecsConfirmed: "printer_specs_confirmed",
                      colorProfileConfirmed: "color_profile_confirmed",
                    }[key];
                    void confirmAdminMailerPreflight(mailer.id, column, value).then(async (response) => {
                      if (response.error) setError(response.error.message);
                      else await load();
                    });
                  }}
                  onRecord={(result) => {
                    void recordAdminMailerPreflight(mailer.id, result).then(async (response) => {
                      if (response.error) setError(response.error.message);
                      else await load();
                    });
                  }}                  onSelectPlacement={(placementId) => {
                    const placement = draft.find((item) => item.id === placementId);
                    setSelectedId(placementId);
                    if (placement) setSide(placement.side);
                  }}
                />
                <CommunityMailerCandidatePanel detail={data} onReload={load} />
                <CampaignSummary
                  issues={issues}
                  placements={draft}
                  onSelect={(placement) => {
                    setSelectedId(placement.id);
                    setSide(placement.side);
                  }}
                />
              </div>
            )}
        </AdpadzCard>
      </section>
      <details className="rounded-2xl border border-white/10 bg-white/[.02] p-4">
        <summary className="cursor-pointer text-sm font-black">
          Placement inventory ({draft.length})
        </summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {draft.map((placement) => (
            <button
              key={placement.id}
              onClick={() => {
                setSelectedId(placement.id);
                setSide(placement.side);
              }}
              className="rounded-xl border border-white/10 p-3 text-left text-xs"
            >
              <b>{placement.label}</b>
              <span className="float-right uppercase text-neon">
                {placement.status}
              </span>
              <p className="mt-1 truncate text-[var(--text-muted)]">
                {placement.business_name || placement.advertiser_name ||
                  "Available"} / {placement.side}
              </p>
            </button>
          ))}
        </div>
      </details>
      {settingsOpen && (
        <CommunityMailerSettingsDrawer
          detail={data}
          storageKey={settingsDraftKey}
          onDirtyChange={setSettingsDirty}
          onClose={() => {
            setSettingsDirty(false);
            setSettingsOpen(false);
          }}
          onSave={saveMailer}
        />
      )}
      {customerPreviewOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="community-mailer-customer-preview-title"
          className="fixed inset-0 z-[95] overflow-y-auto bg-neutral-950 p-4 sm:p-8"
        >
          <div className="mx-auto mb-5 flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-neon">
                Current browser draft / public mode
              </p>
              <h2
                id="community-mailer-customer-preview-title"
                className="text-2xl font-black"
              >
                {mailer.title}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                This preview uses the current canvas and public visibility
                rules. Booking actions are intentionally inactive here.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {mailer.is_published && (
                <a
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 px-3 text-xs font-black"
                  href={`/community-cards/${mailer.public_slug}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />Open live booking page
                </a>
              )}
              <button
                type="button"
                aria-label="Close customer preview"
                autoFocus
                onClick={() => setCustomerPreviewOpen(false)}
                className="rounded-full border border-white/10 p-2"
              >
                <X />
              </button>
            </div>
          </div>
          <div className="mx-auto max-w-6xl space-y-4">
            <CommunityMailerSideTabs side={side} onChange={setSide} />
            <CommunityMailerCanvas
              mailer={mailer}
              placements={publicPreviewPlacements}
              side={side}
              mode="public-booking"
            />
          </div>
        </div>
      )}
      {printOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="community-mailer-print-title"
          className="fixed inset-0 z-[100] overflow-y-auto bg-neutral-950 p-4 sm:p-8"
        >
          <div className="community-mailer-print-controls mx-auto mb-5 flex max-w-6xl items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-neon">
                Browser print preview
              </p>
              <h2
                id="community-mailer-print-title"
                className="text-2xl font-black"
              >
                {mailer.title}
              </h2>
            </div>
            <div className="flex gap-2">
              {mailer.format === "postcard_9x12" && (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center rounded-full border border-white/10 px-4 text-xs font-black"
                  onClick={() => setShowProductionGuides((visible) => !visible)}
                >
                  {showProductionGuides ? "Hide guides" : "Show guides"}
                </button>
              )}
              <AdpadzButton
                variant="secondary"
                disabled={issues.length > 0 || printMissingArtwork.length > 0}
                onClick={() => window.print()}
              >
                <Printer className="h-4 w-4" />Print / save PDF
              </AdpadzButton>
              <button
                aria-label="Close preview"
                autoFocus
                onClick={() => setPrintOpen(false)}
              >
                <X />
              </button>
            </div>
          </div>
          <div className="community-mailer-print mx-auto grid max-w-6xl gap-8">
            <div>
              <p className="community-mailer-print-controls mb-2 text-center text-xs font-black uppercase">
                Front
              </p>
              <CommunityMailerCanvas
                mailer={mailer}
                placements={draft}
                side="front"
                mode="print-preview"
                showProductionGuides={showProductionGuides}
                creativeSettingsById={creativeSettingsByPlacement}
              />
            </div>
            <div>
              <p className="community-mailer-print-controls mb-2 text-center text-xs font-black uppercase">
                Back
              </p>
              <CommunityMailerCanvas
                mailer={mailer}
                placements={draft}
                side="back"
                mode="print-preview"
                showProductionGuides={showProductionGuides}
                creativeSettingsById={creativeSettingsByPlacement}
              />
            </div>
          </div>
          <p className="community-mailer-print-controls mx-auto mt-6 max-w-2xl text-center text-xs text-[var(--text-muted)]">
            The proof uses a 12.25 × 9.25 inch EDDM bleed sheet with 12 × 9
            trim and 0.125 inch safe inset guides. Guides are hidden when
            printing. CMYK conversion, artwork DPI preflight, crop marks, and
            commercial press PDF export are not yet implemented.
            {printMissingArtwork.length > 0 &&
              ` Print/save is blocked because ${printMissingArtwork.length} printable placement${
                printMissingArtwork.length === 1 ? "" : "s"
              } still require artwork.`}
          </p>
        </div>
      )}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <AdpadzCard variant="flat" className="rounded-2xl p-4">
      <p className="text-[9px] font-black uppercase text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </AdpadzCard>
  );
}
function CampaignSummary(
  { issues, placements, onSelect }: {
    issues: ReturnType<typeof validateMailerLayout>;
    placements: AdminPlacement[];
    onSelect: (placement: AdminPlacement) => void;
  },
) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-neon" />
        <h2 className="font-black">Campaign summary</h2>
      </div>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Select a placement on the canvas to assign a business, artwork, QR
        destination, and production state.
      </p>
      <h3 className="mt-6 text-[10px] font-black uppercase tracking-wider">
        Attention queue
      </h3>
      {issues.length === 0
        ? (
          <p className="mt-2 rounded-xl border border-neon/20 bg-neon/5 p-3 text-sm text-neon">
            No layout or production exceptions.
          </p>
        )
        : (
          <div className="mt-2 space-y-2">
            {issues.map((issue, index) => (
              <button
                key={`${issue.code}-${issue.placementId || index}`}
                onClick={() => {
                  const placement = placements.find((item) =>
                    item.id === issue.placementId
                  );
                  if (placement) onSelect(placement);
                }}
                className="flex w-full items-start gap-2 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-left text-xs"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <span>{issue.message}</span>
              </button>
            ))}
          </div>
        )}
    </div>
  );
}

function hasSessionDraft(key: string) {
  if (!key) return false;
  try {
    return window.sessionStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}
