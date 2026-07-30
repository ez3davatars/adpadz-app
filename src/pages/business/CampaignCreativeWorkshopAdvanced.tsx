import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Eye,
  Grid2X2,
  History as HistoryIcon,
  Loader2,
  Maximize2,
  MonitorPlay,
  QrCode,
  Redo2,
  RotateCcw,
  Save,
  Smartphone,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import CreativeCompareView from "../../components/campaign-creative/CreativeCompareView";
import CreativeHistoryDrawer from "../../components/campaign-creative/CreativeHistoryDrawer";
import CreativeInspector, {
  type CreativeInspectorSection,
} from "../../components/campaign-creative/CreativeInspector";
import CreativeModal, {
  CreativeConfirmDialog,
} from "../../components/campaign-creative/CreativeModal";
import CreativePreviewCanvas from "../../components/campaign-creative/CreativePreviewCanvas";
import DiscoveryFeedStage from "../../components/campaign-creative/DiscoveryFeedStage";
import MailerProofStage from "../../components/campaign-creative/MailerProofStage";
import QrPhoneStage from "../../components/campaign-creative/QrPhoneStage";
import SocialFormatRackStage from "../../components/campaign-creative/SocialFormatRackStage";
import { useCampaignShell } from "../../components/campaign-shell/campaignShellContext";
import { AdpadzButton, AdpadzCard } from "../../components/adpadz-ui";
import {
  normalizeCampaignContent,
} from "../../features/campaign-templates";
import {
  CREATIVE_DESTINATIONS,
  creativeDestinationLabel,
  creativeFormatRatio,
  DEFAULT_CREATIVE_SETTINGS,
  DEFAULT_WORKSHOP_STATE,
  createHistory,
  getCreativeDestination,
  listActiveCreativeAssetOptions,
  normalizeWorkshopState,
  pushHistory,
  redoHistory,
  resolveCreativeAssetUrl,
  resetCreativeDestination,
  resolveCreativeSettings,
  undoHistory,
  updateCreativeSettings,
  type CreativeAssetRendition,
  type CreativeDestination,
  type CreativeElementKey,
  type CreativeFormatKey,
  type CreativeScope,
  type CreativeSettings,
  type CreativeWorkshopState,
} from "../../features/campaign-templates/creativeWorkshop";
import {
  classifyCreativeChanges,
  createCreativeVersionSnapshot,
  getInspectorSectionForElement,
  isCreativeQrUsableForCampaign,
  prepareCreativeSettingsForDestination,
  projectOriginalCreativeTreatment,
  isCreativeWorkshopUnsaved,
  listMaterialCreativeChanges,
  listOverriddenCreativeSettingKeys,
  reconcileCreativeSelection,
  resetAllCreativeSettings,
  resetCreativeSectionInState,
  sectionResetRequiresMailerQrPreservation,
  resolveCreativeFormat,
  resolveEffectiveCreativeDestination,
  restoreCreativeVersionState,
  isEffectiveCreativeDestinationUnsaved,
  updateCreativeFormat,
  type CreativeResetSection,
} from "../../features/campaign-templates/creativeWorkshopState";
import type { CampaignOutputRecord, CampaignRecord } from "../../lib/ads";
import {
  loadCampaignCreativeVersions,
  saveCampaignCreative,
  type CampaignCreativeVersionRecord,
} from "../../lib/campaignCreativeHistory";
import {
  MIN_PRODUCTION_QR_CONTRAST_RATIO,
  qrContrastRatio,
} from "../../lib/qr/qrArtwork";
import type { QRLinkRecord } from "../../lib/qr/qrTypes";
import { supabase } from "../../lib/supabase";

type Asset = {
  id: string;
  title: string;
  file_url: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  is_active: boolean;
};
type Profile = {
  business_name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
};
type Business = { name: string; phone: string | null; website: string | null };
type Loaded = {
  campaign: CampaignRecord;
  output: CampaignOutputRecord | null;
  assets: Asset[];
  pickerAssets: Asset[];
  profile: Profile | null;
  business: Business | null;
  qrs: QRLinkRecord[];
};

type PendingReset =
  | { type: "section"; section: CreativeInspectorSection }
  | { type: "destination" }
  | { type: "all" }
  | null;

type CreativeComparePair =
  | "history-session"
  | "history-saved"
  | "saved-session";

const DESTINATION_ICONS: Record<CreativeDestination, LucideIcon> = {
  mailer: Grid2X2,
  discovery: Eye,
  qr: QrCode,
  social: Smartphone,
};

const TEXT_MEASURE_ELEMENTS: readonly NonNullable<CreativeElementKey>[] = [
  "business-name",
  "headline",
  "offer",
  "cta",
  "expiration",
  "phone",
  "website",
];

const sectionResetMap: Partial<Record<CreativeInspectorSection, CreativeResetSection>> = {
  Image: "image",
  Overlay: "overlay",
  QR: "qr",
  Text: "text",
  Branding: "branding",
  Visibility: "visibility",
  "Print Safety": "print-safety",
};

export default function CampaignCreativeWorkshopAdvanced() {
  const { campaignId = "" } = useParams();
  const navigate = useNavigate();
  const shell = useCampaignShell();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [history, dispatch] = useReducer(historyReducer, createHistory(DEFAULT_WORKSHOP_STATE));
  const [saved, setSaved] = useState(DEFAULT_WORKSHOP_STATE);
  const [destination, setDestination] = useState<CreativeDestination>("mailer");
  const [scope, setScope] = useState<CreativeScope>("global");
  const [zoom, setZoom] = useState<"fit" | "50" | "100">("fit");
  const [activeInspector, setActiveInspector] = useState<CreativeInspectorSection>("Template");
  const [selectedElement, setSelectedElement] = useState<CreativeElementKey>(null);
  const [selectedTextOverflows, setSelectedTextOverflows] = useState<boolean | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [fullScreenGuides, setFullScreenGuides] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<CampaignCreativeVersionRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [previewVersion, setPreviewVersion] = useState<CampaignCreativeVersionRecord | null>(null);
  const [compareVersion, setCompareVersion] = useState<CampaignCreativeVersionRecord | null>(null);
  const [comparePair, setComparePair] = useState<CreativeComparePair>("history-session");
  const [restoreVersion, setRestoreVersion] = useState<CampaignCreativeVersionRecord | null>(null);
  const [pendingReset, setPendingReset] = useState<PendingReset>(null);
  const [showInspectorHint, setShowInspectorHint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");
  const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);
  const historyRequestRef = useRef(0);
  const gestureRef = useRef(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  const refreshHistory = useCallback(async () => {
    const requestId = ++historyRequestRef.current;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const rows = await loadCampaignCreativeVersions(campaignId, { limit: 10 });
      if (requestId !== historyRequestRef.current) return;
      setVersions(rows);
      setHistoryHasMore(rows.length === 10);
    } catch (reason) {
      if (requestId !== historyRequestRef.current) return;
      setHistoryError(reason instanceof Error ? reason.message : "Could not load Creative History.");
    } finally {
      if (requestId === historyRequestRef.current) {
        setHistoryLoaded(true);
        setHistoryLoading(false);
      }
    }
  }, [campaignId]);
  useEffect(() => {
    let cancelled = false;
    historyRequestRef.current += 1;
    gestureRef.current = false;
    setLoaded(null);
    setSaved(DEFAULT_WORKSHOP_STATE);
    dispatch({ type: "replace", value: DEFAULT_WORKSHOP_STATE });
    setDestination("mailer");
    setScope("global");
    setSelectedElement(null);
    setMobileInspectorOpen(false);
    setHistoryOpen(false);
    setVersions([]);
    setHistoryLoading(false);
    setHistoryLoadingMore(false);
    setHistoryLoaded(false);
    setHistoryHasMore(false);
    setHistoryError("");
    setPreviewVersion(null);
    setCompareVersion(null);
    setComparePair("history-session");
    setRestoreVersion(null);
    setPendingReset(null);
    setPendingLeaveHref(null);
    setMessage("");
    setError("");
    void loadWorkshop(campaignId).then(result => {
      if (cancelled) return;
      setLoaded(result.loaded);
      setSaved(result.state);
      dispatch({ type: "replace", value: result.state });
      setShowInspectorHint(localStorage.getItem(`adpadz-creative-inspector-hint:${result.loaded.campaign.owner_id}`) !== "dismissed");
    }).catch(reason => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not open Creative Workshop.");
    });
    return () => { cancelled = true; };
  }, [campaignId]);

  useEffect(() => {
    if (!historyOpen || historyLoaded || historyLoading) return;
    void refreshHistory();
  }, [historyOpen, historyLoaded, historyLoading, refreshHistory]);

  const state = history.present;
  const railState = useDeferredValue(state);
  const settings = scope === "global" ? state.global : resolveCreativeSettings(state, destination);
  const format = resolveCreativeFormat(state, destination);
  const destinationDefinition = getCreativeDestination(destination);
  const currentFormat = destinationDefinition.formats.find(item => item.key === format)
    ?? destinationDefinition.formats[0];
  const dirty = isCreativeWorkshopUnsaved(saved, state);
  const printImpact = classifyCreativeChanges(saved, state).affectsPrint;
  const hasOverride = Boolean(state.overrides[destination]);
  const overriddenCount = useMemo(
    () => hasOverride
      ? listOverriddenCreativeSettingKeys(resolveCreativeSettings(state, destination), state.global).length
      : 0,
    [destination, hasOverride, state],
  );

  // Destination scope only exists while an override exists; undoing the
  // override creation (or removing it) drops the session back to Global.
  useEffect(() => {
    if (scope === "destination" && !state.overrides[destination]) setScope("global");
  }, [destination, scope, state.overrides]);

  // Confirmations are transient; they dismiss themselves.
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const guardLink = (event: MouseEvent) => {
      if (!dirty || event.defaultPrevented || !(event.target instanceof Element)) return;
      const anchor = event.target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destinationUrl = new URL(anchor.href, window.location.href);
      if (destinationUrl.origin === window.location.origin) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setPendingLeaveHref(`${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`);
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLink, true);
    };
  }, [dirty]);

  // Fixed-viewport workspace: lock page scroll and measure exact height on xl.
  useEffect(() => {
    const el = workspaceRef.current;
    if (!el) return;
    const updateHeight = () => {
      if (window.innerWidth >= 1280) {
        const { top } = el.getBoundingClientRect();
        el.style.height = `calc(100dvh - ${Math.max(0, top)}px)`;
        el.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
      } else {
        el.style.height = "";
        el.style.overflow = "";
        document.documentElement.style.overflow = "";
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => {
      window.removeEventListener("resize", updateHeight);
      el.style.height = "";
      el.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [loaded]);

  // Mouse-wheel over canvas = zoom (non-passive so preventDefault works).
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const zoomOrder: Array<"50" | "fit" | "100"> = ["50", "fit", "100"];
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(current => {
        const idx = zoomOrder.indexOf(current as "50" | "fit" | "100");
        if (e.deltaY < 0) return zoomOrder[Math.min(idx + 1, zoomOrder.length - 1)];
        return zoomOrder[Math.max(idx - 1, 0)];
      });
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [loaded]);

  const selectedQr = loaded?.qrs.find(qr => qr.id === settings.qrId) ?? null;
  const selectedAsset = loaded
    ? loaded.assets.find(asset => asset.id === (settings.imageAssetId || loaded.campaign.primary_image_id)) ?? null
    : null;
  const imageUrl = resolveCreativeAssetUrl(selectedAsset)
    || loaded?.profile?.cover_image_url
    || null;
  const content = useMemo(
    () => loaded ? buildContent(loaded, selectedQr, imageUrl) : null,
    [imageUrl, loaded, selectedQr],
  );

  const inspectionSettings = useMemo(
    () => showOriginal ? projectOriginalCreativeTreatment(settings) : settings,
    [settings, showOriginal],
  );

  useEffect(() => {
    const available = content
      ? availableCreativeElements(content, inspectionSettings, Boolean(selectedQr))
      : [];
    const reconciled = reconcileCreativeSelection(
      selectedElement,
      inspectionSettings,
      available,
    );
    if (reconciled !== selectedElement) {
      if (selectedElement) {
        setAnnouncement(`${elementLabel(selectedElement)} selection cleared because it is hidden in this preview.`);
      }
      setSelectedElement(null);
      setMobileInspectorOpen(false);
    }
  }, [content, inspectionSettings, selectedElement, selectedQr]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || historyOpen || fullScreen || previewVersion || compareVersion || restoreVersion || pendingReset) return;
      if (selectedElement) {
        setSelectedElement(null);
        setMobileInspectorOpen(false);
        setAnnouncement("Creative selection cleared.");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [compareVersion, fullScreen, historyOpen, pendingReset, previewVersion, restoreVersion, selectedElement]);

  function change(patch: Partial<CreativeSettings>, options: { transient?: boolean } = {}) {
    setMessage("");
    if (patch.template === "featured-sponsor" && scope === "global") {
      gestureRef.current = false;
      dispatch({ type: "push", value: updateCreativeSettings(state, "mailer", "destination", patch) });
      setScope("destination");
      setMessage("Featured Sponsor is applied only to Mailer so digital destinations keep a supported template.");
      return;
    }
    if (destination === "mailer" && patch.showQr === false) {
      setMessage("Mailer QR visibility is locked for print scannability.");
      return;
    }
    if (destination !== "mailer" && scope === "global" && patch.showQr === false) {
      gestureRef.current = false;
      dispatch({ type: "push", value: updateCreativeSettings(state, destination, "destination", patch) });
      setScope("destination");
      setMessage(`QR hidden only for ${destinationLabel(destination)} so Mailer remains scannable.`);
      return;
    }
    const next = updateCreativeSettings(state, destination, scope, patch);
    if (options.transient) {
      // A continuous gesture (slider drag) coalesces into one undo entry: the
      // first tick records the pre-gesture baseline, later ticks replace it.
      if (gestureRef.current) {
        dispatch({ type: "preview", value: next });
      } else {
        gestureRef.current = true;
        dispatch({ type: "push", value: next });
      }
      return;
    }
    gestureRef.current = false;
    dispatch({ type: "push", value: next });
  }

  const commitGesture = useCallback(() => {
    gestureRef.current = false;
  }, []);

  function selectScope(next: CreativeScope) {
    if (next === scope) return;
    if (next === "destination" && !hasOverride) {
      // Explicit override creation: a destination detaches from Global only
      // through this deliberate, announced, undoable act.
      gestureRef.current = false;
      dispatch({ type: "push", value: updateCreativeSettings(state, destination, "destination", {}) });
      setScope("destination");
      setMessage(`${destinationLabel(destination)} is now customized. Global edits no longer reach ${destinationLabel(destination)} until you remove the override.`);
      setAnnouncement(`${destinationLabel(destination)} override created. Undo is available.`);
      return;
    }
    setScope(next);
  }

  const handleOverflowChange = useCallback((value: boolean | null) => {
    setSelectedTextOverflows(value);
  }, []);

  const shortcutRef = useRef({ save: () => {}, blockFullScreen: false });
  shortcutRef.current = {
    save: () => { void save(); },
    blockFullScreen: Boolean(
      historyOpen || previewVersion || compareVersion || restoreVersion || pendingReset
      || pendingLeaveHref || mobileInspectorOpen,
    ),
  };

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target && (
        target.tagName === "INPUT"
        || target.tagName === "TEXTAREA"
        || target.tagName === "SELECT"
        || target.isContentEditable
      ));
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && !event.altKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        gestureRef.current = false;
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        setMessage("");
        setAnnouncement(event.shiftKey ? "Creative change redone." : "Creative change undone.");
        return;
      }
      if (modifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        gestureRef.current = false;
        dispatch({ type: "redo" });
        setMessage("");
        setAnnouncement("Creative change redone.");
        return;
      }
      if (modifier && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        shortcutRef.current.save();
        return;
      }
      if (!modifier && !event.altKey && !typing && (event.key === "f" || event.key === "F")) {
        if (shortcutRef.current.blockFullScreen) return;
        event.preventDefault();
        setFullScreen(value => !value);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  function selectDestination(next: CreativeDestination) {
    setMessage("");
    gestureRef.current = false;
    setDestination(next);
    setMobileInspectorOpen(false);
    setShowOriginal(false);
  }

  function selectElement(element: Exclude<CreativeElementKey, null>) {
    const section = getInspectorSectionForElement(element);
    setSelectedElement(element);
    if (section) setActiveInspector(section);
    setMobileInspectorOpen(true);
    setAnnouncement(`Selected ${elementLabel(element)}. ${section ?? "Creative"} inspector opened.`);
    requestAnimationFrame(() => document.getElementById(`inspector-${(section ?? "Template").replace(" ", "-").toLowerCase()}`)?.focus());
  }

  async function save() {
    if (!loaded || !dirty) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const classification = classifyCreativeChanges(saved, state);
      const mailerSettings = resolveCreativeSettings(state, "mailer");
      const mailerQr = loaded.qrs.find(qr => qr.id === mailerSettings.qrId) ?? null;
      const mailerQrContrast = mailerQr
        ? qrContrastRatio(
            mailerQr.foreground_color,
            mailerQr.inner_field_color || mailerQr.background_color,
          )
        : null;
      if (
        classification.affectsPrint
        && (
          !mailerSettings.showQr
          || !isCreativeQrUsableForCampaign(mailerQr, {
            id: loaded.campaign.id,
            ownerId: loaded.campaign.owner_id,
            businessId: loaded.campaign.business_id,
          })
        )
      ) {
        setDestination("mailer");
        setScope(state.overrides.mailer ? "destination" : "global");
        setActiveInspector("QR");
        setSelectedElement(null);
        setMobileInspectorOpen(true);
        setError("Choose a visible, active, unexpired QR Studio code before saving print changes.");
        return;
      }
      if (
        classification.affectsPrint
        && (mailerQrContrast ?? 0) < MIN_PRODUCTION_QR_CONTRAST_RATIO
      ) {
        setDestination("mailer");
        setScope(state.overrides.mailer ? "destination" : "global");
        setActiveInspector("QR");
        setSelectedElement(null);
        setMobileInspectorOpen(true);
        setError(`Mailer QR contrast must be at least ${MIN_PRODUCTION_QR_CONTRAST_RATIO}:1 before saving print changes.`);
        return;
      }
      const nextVersion = createCreativeVersionSnapshot(state, destination, scope);
      const previousVersion = createCreativeVersionSnapshot(saved, destination, scope);
      const scopedSummary = listMaterialCreativeChanges(previousVersion, nextVersion);
      const destinationSummary = classification.destinations.map(item => `${destinationLabel(item)} creative settings`);
      const summary = Array.from(new Set([
        ...scopedSummary,
        ...(classification.destinations.length > 1 ? destinationSummary : []),
      ])).slice(0, 20);
      const result = await saveCampaignCreative({
        campaignId: loaded.campaign.id,
        destination,
        formatKey: format,
        state,
        changeSummary: summary.length ? summary : destinationSummary,
        affectsPrint: classification.affectsPrint,
        createdOverride: scope === "destination" && !saved.overrides[destination] && Boolean(state.overrides[destination]),
        scope,
      });
      const [campaignResult, outputResult] = await Promise.all([
        supabase.from("campaigns").select("*").eq("id", loaded.campaign.id).single(),
        supabase.from("campaign_outputs").select("*").eq("campaign_id", loaded.campaign.id).eq("output_type", "interactive_ad").single(),
      ]);
      if (campaignResult.error) throw new Error(campaignResult.error.message);
      if (outputResult.error) throw new Error(outputResult.error.message);
      const reloaded = outputResult.data as CampaignOutputRecord;
      const authoritative = normalizeWorkshopState(reloaded.metadata?.creative_workshop ?? result.persisted_metadata.creative_workshop);
      setLoaded(current => current ? {
        ...current,
        campaign: campaignResult.data as CampaignRecord,
        output: reloaded,
      } : current);
      setSaved(authoritative);
      dispatch({ type: "checkpoint", value: authoritative });
      setMessage(result.print_affected
        ? "Creative saved. Print preflight must be confirmed again."
        : result.version_created
          ? "Creative saved to History."
          : "Creative saved. No duplicate History entry was created.");
      setAnnouncement("Creative saved successfully.");
      shell?.refreshShell();
      if (historyOpen) await refreshHistory();
      else setHistoryLoaded(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save creative settings.");
    } finally {
      setSaving(false);
    }
  }

  async function loadMoreHistory() {
    const lastVersion = versions[versions.length - 1];
    if (!lastVersion) return;
    const requestId = ++historyRequestRef.current;
    setHistoryLoadingMore(true);
    setHistoryError("");
    try {
      const rows = await loadCampaignCreativeVersions(campaignId, {
        limit: 10,
        before: lastVersion.created_at,
        beforeId: lastVersion.id,
      });
      if (requestId !== historyRequestRef.current) return;
      setVersions(current => [...current, ...rows]);
      setHistoryHasMore(rows.length === 10);
    } catch (reason) {
      if (requestId !== historyRequestRef.current) return;
      setHistoryError(reason instanceof Error ? reason.message : "Could not load more Creative History.");
    } finally {
      if (requestId === historyRequestRef.current) setHistoryLoadingMore(false);
    }
  }

  function confirmRestore() {
    if (!restoreVersion) return;
    const versionState = normalizeWorkshopState(restoreVersion.settings_snapshot);
    const versionSnapshot = {
      ...createCreativeVersionSnapshot(versionState, restoreVersion.destination, restoreVersion.scope),
      hasDestinationOverride: Boolean(versionState.overrides[restoreVersion.destination]),
    };
    const restored = restoreCreativeVersionState(state, versionSnapshot);
    dispatch({ type: "push", value: restored });
    setDestination(restoreVersion.destination);
    setScope(restoreVersion.scope);
    setRestoreVersion(null);
    setHistoryOpen(false);
    setSelectedElement(null);
    setMessage("Historical creative loaded as unsaved changes. Review it, then choose Save Creative.");
    setAnnouncement("Creative version restored to the current session. It is not saved yet.");
  }

  function duplicateAsOverride(version: CampaignCreativeVersionRecord) {
    const versionState = normalizeWorkshopState(version.settings_snapshot);
    const source = version.scope === "global"
      ? versionState.global
      : resolveCreativeSettings(versionState, version.destination);
    const targetSafeSource = prepareCreativeSettingsForDestination(source, destination);
    const next = updateCreativeSettings(state, destination, "destination", targetSafeSource);
    dispatch({ type: "push", value: next });
    setScope("destination");
    setHistoryOpen(false);
    setMessage(`${destinationLabel(version.destination)} creative copied into a ${destinationLabel(destination)} override. Save when ready.`);
  }

  function confirmReset() {
    if (!pendingReset || !loaded) return;
    const mailerQrIsUsable = (qr: QRLinkRecord | null | undefined) =>
      isCreativeQrUsableForCampaign(qr, {
        id: loaded.campaign.id,
        ownerId: loaded.campaign.owner_id,
        businessId: loaded.campaign.business_id,
      });
    const currentMailerQrId = resolveCreativeSettings(state, "mailer").qrId;
    const currentMailerQr = loaded.qrs.find(qr =>
      qr.id === currentMailerQrId
      && mailerQrIsUsable(qr));
    const primaryMailerQr = loaded.qrs.find(qr =>
      qr.id === loaded.campaign.primary_qr_id
      && mailerQrIsUsable(qr));
    const fallbackMailerQr = primaryMailerQr
      ?? currentMailerQr
      ?? loaded.qrs.find(mailerQrIsUsable);
    const preserveMailerQr = (next: CreativeWorkshopState) => {
      if (!fallbackMailerQr) return next;
      const nextMailer = resolveCreativeSettings(next, "mailer");
      if (
        nextMailer.showQr
        && mailerQrIsUsable(loaded.qrs.find(qr => qr.id === nextMailer.qrId))
      ) {
        return next;
      }
      return updateCreativeSettings(next, "mailer", next.overrides.mailer ? "destination" : "global", {
        qrId: fallbackMailerQr.id,
        showQr: true,
      });
    };
    if (pendingReset.type === "all") {
      dispatch({ type: "push", value: preserveMailerQr(resetAllCreativeSettings()) });
      setMessage(fallbackMailerQr
        ? "All creative settings reset in this session. An active Mailer QR was retained for print safety."
        : "All creative settings reset in this session. Choose an active Mailer QR before saving print changes.");
    } else if (pendingReset.type === "destination") {
      const reset = resetCreativeDestination(state, destination);
      dispatch({ type: "push", value: destination === "mailer" ? preserveMailerQr(reset) : reset });
      setScope("global");
      setMessage(`${destinationLabel(destination)} override reset in this session.`);
    } else {
      const resetSection = sectionResetMap[pendingReset.section];
      const resetTouchesMailerQr = resetSection
        ? sectionResetRequiresMailerQrPreservation(resetSection, destination, scope)
        : false;
      if (resetSection) {
        const reset = resetCreativeSectionInState(state, destination, scope, resetSection);
        dispatch({
          type: "push",
          value: resetTouchesMailerQr
            ? preserveMailerQr(reset)
            : reset,
        });
      } else {
        dispatch({ type: "push", value: updateCreativeSettings(state, destination, scope, { template: DEFAULT_CREATIVE_SETTINGS.template }) });
      }
      setMessage(resetTouchesMailerQr && fallbackMailerQr
        ? `${pendingReset.section} settings reset for ${scope === "global" ? "all destinations" : "Mailer"}. An active Mailer QR was retained for print safety.`
        : `${pendingReset.section} settings reset for ${scope === "global" ? "all destinations" : destinationLabel(destination)}.`);
    }
    setPendingReset(null);
    setAnnouncement("Creative reset added to session history. Undo is available.");
  }

  if (error && !loaded) {
    return <AdpadzCard variant="flat" role="alert" className="border-red-400/30 bg-red-500/10 text-red-100">{error}</AdpadzCard>;
  }
  if (!loaded || !content) {
    return <p className="flex min-h-64 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-5 w-5 animate-spin text-neon" /> Opening Creative Workshop…</p>;
  }

  const previewScale = zoom === "50" ? "max-w-[380px]" : zoom === "100" ? "max-w-[860px]" : "max-w-[720px]";
  const context = `${destinationLabel(destination)} · ${currentFormat.label} · ${templateLabel(settings.template)} · ${scope === "global" ? `Global settings${state.overrides[destination] ? " (override preserved)" : ""}` : `${destinationLabel(destination)} override`}`;
  const compareModel = compareVersion
    ? createCreativeCompareModel(comparePair, compareVersion, saved, state, loaded)
    : null;
  const measureElement = selectedElement && TEXT_MEASURE_ELEMENTS.includes(selectedElement)
    ? selectedElement
    : null;

  return (
    <div ref={workspaceRef} className="flex min-h-[calc(100vh-7rem)] xl:min-h-0 flex-col min-w-0 max-w-full">
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-[var(--bg-base)]/95 px-4 py-2 backdrop-blur-sm sm:px-6">
        <p className="min-w-0 truncate text-[11px] text-[var(--text-muted)]">Creative Studio</p>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <span role="status" aria-live="polite" className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${dirty ? "bg-amber-300/10 text-amber-300" : "bg-white/[0.05] text-[var(--text-muted)]"}`}>{dirty ? "Unsaved" : "Saved"}</span>
          <AdpadzButton type="button" variant="secondary" size="sm" aria-label="Open Creative History" onClick={() => {
            setHistoryOpen(true);
            if (!historyLoaded && !historyLoading) void refreshHistory();
          }}>
            <HistoryIcon className="h-4 w-4" /> <span className="hidden sm:inline">History</span>
          </AdpadzButton>
          <AdpadzButton type="button" variant="icon" size="sm" aria-label="Undo creative change" disabled={!history.past.length} onClick={() => {
            gestureRef.current = false;
            dispatch({ type: "undo" });
            setMessage("");
            setAnnouncement("Creative change undone.");
          }}>
            <Undo2 className="h-4 w-4" />
          </AdpadzButton>
          <AdpadzButton type="button" variant="icon" size="sm" aria-label="Redo creative change" disabled={!history.future.length} onClick={() => {
            gestureRef.current = false;
            dispatch({ type: "redo" });
            setMessage("");
            setAnnouncement("Creative change redone.");
          }}>
            <Redo2 className="h-4 w-4" />
          </AdpadzButton>
          <AdpadzButton type="button" size="sm" onClick={() => void save()} disabled={!dirty || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Creative
          </AdpadzButton>
        </div>
      </header>

      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      {error && (
        <div role="alert" className="shrink-0 mx-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm font-semibold text-red-100 sm:mx-6">
          {error}
        </div>
      )}
      {message && !error && (
        <div role="status" aria-live="polite" className="fixed bottom-24 right-4 z-[60] max-w-sm rounded-2xl border border-neon/25 bg-neutral-950/95 p-4 text-sm font-semibold text-neon shadow-2xl backdrop-blur-xl xl:bottom-6">
          {message}
        </div>
      )}

      <div className="min-h-0 flex-1 grid gap-4 px-4 pt-4 pb-24 sm:px-6 xl:grid-cols-[200px_minmax(0,1fr)_320px] xl:pt-3 xl:pb-4 xl:overflow-hidden">
        <nav aria-label="Creative destinations" className="order-2 min-w-0 max-w-full xl:order-1 xl:overflow-y-auto xl:min-h-0 xl:pb-4">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Destinations</p>
          <div className="flex gap-2 overflow-x-auto pb-2 xl:block xl:space-y-2 xl:overflow-visible xl:pb-0">
            {CREATIVE_DESTINATIONS.map(item => {
              const active = destination === item.key;
              const overridden = Boolean(state.overrides[item.key]);
              const Icon = DESTINATION_ICONS[item.key];
              const railFormat = resolveCreativeFormat(railState, item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectDestination(item.key)}
                  className={`group min-w-[200px] rounded-2xl border p-2.5 text-left transition duration-200 xl:w-full ${active ? "border-neon/70 bg-neon/[0.06] shadow-[0_0_0_1px_rgba(182,255,0,0.25)]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]"}`}
                >
                  <span
                    className="pointer-events-none mx-auto block max-h-24 overflow-hidden rounded-xl border border-white/[0.06] bg-black/40"
                    style={{ aspectRatio: creativeFormatRatio(item.key, railFormat), maxWidth: "9.5rem" }}
                    aria-hidden="true"
                  >
                    {renderStatePreview(railState, item.key, loaded, false)}
                  </span>
                  <span className="mt-2 flex items-center gap-1.5 px-0.5">
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-neon" : "text-[var(--text-muted)]"}`} />
                    <span className="truncate text-xs font-bold">{item.name}</span>
                  </span>
                  <span className={`mt-1 block px-0.5 text-[10px] font-semibold ${overridden ? "text-amber-300" : "text-[var(--text-muted)]"}`}>{overridden ? "Customized" : "Global"}</span>
                </button>
              );
            })}
            {/* Adpadz TV — presentation-only, not persisted */}
            <div
              aria-disabled="true"
              aria-label="Adpadz TV — Coming Later, not yet available"
              role="button"
              tabIndex={-1}
              className="min-w-[200px] cursor-default rounded-2xl border border-white/[0.04] p-2.5 opacity-45 xl:w-full"
              data-testid="tv-coming-later-rail"
            >
              <span
                className="mx-auto flex max-h-24 items-center justify-center overflow-hidden rounded-xl border border-white/[0.04] bg-black/30"
                style={{ aspectRatio: "16 / 9", maxWidth: "9.5rem" }}
                aria-hidden="true"
              >
                <MonitorPlay className="h-5 w-5 text-white/20" />
              </span>
              <span className="mt-2 flex items-center gap-1.5 px-0.5">
                <MonitorPlay className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                <span className="truncate text-xs font-bold">Adpadz TV</span>
              </span>
              <span className="mt-1 block px-0.5 text-[10px] font-semibold text-[var(--text-muted)]">Coming Later</span>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <AdpadzButton href={`/app/business/campaigns/${campaignId}/review`} variant="secondary" size="sm" fullWidth>Continue to Review</AdpadzButton>
            <AdpadzButton type="button" variant="ghost" size="sm" fullWidth onClick={() => setPendingReset({ type: "destination" })}><RotateCcw className="h-4 w-4" /> Reset current destination</AdpadzButton>
            <AdpadzButton type="button" variant="ghost" size="sm" fullWidth onClick={() => setPendingReset({ type: "all" })}>Reset all creative settings</AdpadzButton>
          </div>
        </nav>

        <main className="order-1 min-w-0 xl:order-2 xl:flex xl:flex-col xl:min-h-0 xl:overflow-hidden">
          <div
            data-testid="creative-preview-stage"
            className={`relative flex min-h-[560px] xl:min-h-0 xl:flex-1 flex-col rounded-3xl border border-white/[0.05] ${destination === "mailer" ? "bg-[#0f0c09]" : "bg-[#070907]"}`}
          >
            <div className={`pointer-events-none absolute inset-0 rounded-3xl ${destination === "mailer" ? "bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.012),transparent_65%)]" : "bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.045),transparent_65%)]"}`} aria-hidden="true" />
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 rounded-t-3xl border-b border-white/[0.05] bg-black/25 px-3 py-2 backdrop-blur-sm">
              {destination !== "social" ? (
                <div className="flex gap-1.5 overflow-x-auto" role="listbox" aria-label={`${destinationDefinition.name} format`}>
                  {destinationDefinition.formats.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      role="option"
                      aria-selected={currentFormat.key === item.key}
                      title={item.detail}
                      onClick={() => {
                        setMessage("");
                        gestureRef.current = false;
                        dispatch({ type: "push", value: updateCreativeFormat(state, destination, item.key) });
                      }}
                      className={`flex min-h-11 items-center gap-2 rounded-xl border px-2.5 text-left transition ${currentFormat.key === item.key ? "border-neon/60 bg-neon/[0.08]" : "border-white/[0.07] hover:border-white/20"}`}
                    >
                      <span
                        className={`block h-[18px] rounded-[3px] border ${currentFormat.key === item.key ? "border-neon/80 bg-neon/20" : "border-white/30 bg-white/[0.06]"}`}
                        style={{ width: `${Math.round(18 * Math.min(2, Math.max(0.45, item.aspect)))}px` }}
                        aria-hidden="true"
                      />
                      <span className="whitespace-nowrap text-[11px] font-semibold">{item.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <span className="px-1 text-[11px] font-semibold text-[var(--text-muted)]">Social Media · all formats below</span>
              )}
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <button type="button" aria-pressed={showOriginal} onClick={() => setShowOriginal(value => !value)} className={`min-h-11 rounded-full px-3 text-[11px] font-semibold transition ${showOriginal ? "bg-amber-300 text-black" : "bg-white/[0.06] text-[var(--text-secondary)] hover:bg-white/[0.1]"}`}>{showOriginal ? "Showing before" : "Before / After"}</button>
                <div className="flex gap-1" aria-label="Preview zoom">
                  {(["fit", "50", "100"] as const).map(value => (
                    <button key={value} type="button" aria-pressed={zoom === value} onClick={() => setZoom(value)} className={`min-h-11 rounded-full px-3 text-[11px] font-semibold transition ${zoom === value ? "bg-white/[0.14] text-white" : "bg-white/[0.05] text-[var(--text-muted)] hover:bg-white/[0.1]"}`}>{value === "fit" ? "Fit" : `${value}%`}</button>
                  ))}
                </div>
                <AdpadzButton type="button" variant="icon" size="sm" aria-label="Open full-screen preview" onClick={() => setFullScreen(true)}><Maximize2 className="h-4 w-4" /></AdpadzButton>
              </div>
            </div>

            <div
              ref={canvasAreaRef}
              className={`relative z-10 flex flex-col items-center gap-4 p-3 sm:p-5 xl:flex-1 xl:min-h-0 xl:overflow-auto ${zoom !== "100" ? "xl:justify-center" : ""}`}
              onClick={event => {
                if (event.target !== event.currentTarget) return;
                setSelectedElement(null);
                setMobileInspectorOpen(false);
              }}
            >
              {showInspectorHint && (
                <div className="absolute left-4 top-4 z-20 max-w-[18rem] rounded-2xl border border-neon/20 bg-neutral-950/95 p-3 shadow-xl">
                  <p className="text-xs font-bold">Click any element in the preview to edit it.</p>
                  <button type="button" className="mt-2 inline-flex min-h-11 items-center rounded-full px-2 text-[10px] font-bold text-neon" onClick={() => {
                    localStorage.setItem(`adpadz-creative-inspector-hint:${loaded.campaign.owner_id}`, "dismissed");
                    setShowInspectorHint(false);
                  }}>Got it</button>
                </div>
              )}
              <div key={destination} className="w-full" style={{ animation: "stageFadeIn 150ms ease", animationFillMode: "both" }}>
              {destination === "mailer" ? (
                <MailerProofStage
                  content={content}
                  settings={settings}
                  formatKey={format}
                  selectedQr={selectedQr}
                  selectedElement={selectedElement}
                  onSelectElement={selectElement}
                  onClearSelection={() => { setSelectedElement(null); setMobileInspectorOpen(false); }}
                  showOriginal={showOriginal}
                  measureOverflowElement={measureElement}
                  onOverflowChange={handleOverflowChange}
                  previewScaleClass={previewScale}
                  aspectRatio={currentFormat.ratio}
                  campaignId={campaignId}
                  campaignOwnerId={loaded.campaign.owner_id}
                  campaignBusinessId={loaded.campaign.business_id ?? null}
                />
              ) : destination === "discovery" ? (
                <DiscoveryFeedStage
                  content={content}
                  settings={settings}
                  selectedQr={selectedQr}
                  selectedElement={selectedElement}
                  onSelectElement={selectElement}
                  onClearSelection={() => { setSelectedElement(null); setMobileInspectorOpen(false); }}
                  showOriginal={showOriginal}
                  measureOverflowElement={measureElement}
                  onOverflowChange={handleOverflowChange}
                  previewScaleClass={previewScale}
                  aspectRatio={currentFormat.ratio}
                />
              ) : destination === "qr" ? (
                <QrPhoneStage
                  content={content}
                  settings={settings}
                  selectedQr={selectedQr}
                  selectedElement={selectedElement}
                  onSelectElement={selectElement}
                  onClearSelection={() => { setSelectedElement(null); setMobileInspectorOpen(false); }}
                  showOriginal={showOriginal}
                  measureOverflowElement={measureElement}
                  onOverflowChange={handleOverflowChange}
                  previewScaleClass={previewScale}
                  aspectRatio={currentFormat.ratio}
                  campaignId={campaignId}
                />
              ) : (
                <SocialFormatRackStage
                  content={content}
                  settings={settings}
                  selectedQr={selectedQr}
                  selectedFormat={format}
                  onFormatChange={fmt => {
                    setMessage("");
                    gestureRef.current = false;
                    dispatch({ type: "push", value: updateCreativeFormat(state, destination, fmt) });
                  }}
                  dirty={dirty}
                  campaignId={campaignId}
                  selectedElement={selectedElement}
                  onSelectElement={selectElement}
                  onClearSelection={() => { setSelectedElement(null); setMobileInspectorOpen(false); }}
                  showOriginal={showOriginal}
                  measureOverflowElement={measureElement}
                  onOverflowChange={handleOverflowChange}
                  previewScaleClass={previewScale}
                />
              )}
              </div>
            </div>

            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 rounded-b-3xl border-t border-white/[0.05] bg-black/25 px-4 py-2 text-[11px] text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text-secondary)]">{context}</span>
              <span className={printImpact ? "font-semibold text-amber-300" : ""}>{printImpact ? "Print readiness will require reconfirmation" : destination === "mailer" ? "Print ready" : destination === "social" && scope === "destination" ? "Social-only override · print remains current" : "Production definition shared"}</span>
            </div>
          </div>
        </main>

        <div className="order-3 min-w-0 xl:order-3 xl:overflow-y-auto xl:min-h-0 xl:pb-4">
          <div className="mb-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Edit scope</p>
              {hasOverride && (
                <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  {overriddenCount > 0 ? `${overriddenCount} field${overriddenCount === 1 ? "" : "s"} customized` : "Customized"}
                </span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-black/30 p-1">
              <button type="button" aria-pressed={scope === "global"} onClick={() => selectScope("global")} className={`min-h-11 rounded-lg text-[11px] font-semibold transition ${scope === "global" ? "bg-neon text-black" : "text-[var(--text-secondary)] hover:bg-white/[0.05]"}`}>All destinations</button>
              <button type="button" aria-pressed={scope === "destination"} onClick={() => selectScope("destination")} className={`min-h-11 rounded-lg text-[11px] font-semibold transition ${scope === "destination" ? "bg-neon text-black" : "text-[var(--text-secondary)] hover:bg-white/[0.05]"}`}>{destinationLabel(destination)}</button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-muted)]">
              {!hasOverride
                ? `Edits apply to every destination. Selecting ${destinationLabel(destination)} creates a separate copy you can shape independently.`
                : scope === "destination"
                  ? `Editing the ${destinationLabel(destination)} override. Amber marks show fields that differ from Global — click one to revert it.`
                  : `${destinationLabel(destination)} keeps its own copy — Global edits will not change it.`}
            </p>
            {hasOverride && (
              <AdpadzButton type="button" variant="ghost" size="sm" fullWidth className="mt-2" onClick={() => setPendingReset({ type: "destination" })}>
                <RotateCcw className="h-4 w-4" /> Remove override · use Global
              </AdpadzButton>
            )}
          </div>
          <CreativeInspector
            settings={settings}
            baselineSettings={scope === "destination" && hasOverride ? state.global : null}
            destination={destination}
            campaignId={campaignId}
            campaignOwnerId={loaded.campaign.owner_id}
            campaignBusinessId={loaded.campaign.business_id ?? null}
            qrs={loaded.qrs}
            assets={loaded.pickerAssets}
            activeSection={activeInspector}
            selectedElement={selectedElement}
            selectedTextOverflows={selectedTextOverflows}
            mobileSheetOpen={mobileInspectorOpen}
            onCloseMobileSheet={() => setMobileInspectorOpen(false)}
            onSectionChange={setActiveInspector}
            onChange={change}
            onCommitGesture={commitGesture}
            onResetSection={section => setPendingReset({ type: "section", section })}
          />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-950/95 p-3 backdrop-blur-xl xl:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <AdpadzButton type="button" variant="secondary" aria-label="Undo creative change" disabled={!history.past.length} onClick={() => {
            gestureRef.current = false;
            dispatch({ type: "undo" });
            setMessage("");
            setAnnouncement("Creative change undone.");
          }}><Undo2 className="h-4 w-4" /></AdpadzButton>
          <AdpadzButton type="button" fullWidth onClick={() => void save()} disabled={!dirty || saving}><Save className="h-4 w-4" /> {dirty ? "Save Creative" : "Creative Saved"}</AdpadzButton>
        </div>
      </div>

      <CreativeHistoryDrawer
        open={historyOpen}
        entries={versions}
        loading={historyLoading}
        loadingMore={historyLoadingMore}
        error={historyError}
        hasMore={historyHasMore}
        currentDestinationLabel={destinationLabel(destination)}
        onClose={() => setHistoryOpen(false)}
        onLoadMore={() => void loadMoreHistory()}
        onRetry={() => void refreshHistory()}
        onPreview={entry => {
          setHistoryOpen(false);
          setPreviewVersion(entry);
        }}
        onCompare={entry => {
          setHistoryOpen(false);
          setComparePair("history-session");
          setCompareVersion(entry);
        }}
        onRestore={entry => {
          setHistoryOpen(false);
          setRestoreVersion(entry);
        }}
        onDuplicate={duplicateAsOverride}
        renderThumbnail={entry => renderVersionPreview(entry, loaded, false, "thumbnail")}
      />

      <CreativeModal
        open={Boolean(previewVersion)}
        title={previewVersion ? `Saved ${formatVersionTime(previewVersion.created_at)}` : "Saved creative"}
        eyebrow="Creative History preview"
        description="This preview is read-only and uses the saved destination settings."
        onClose={() => setPreviewVersion(null)}
      >
        {previewVersion && (
          <div className="mx-auto w-full max-w-4xl" style={{ aspectRatio: versionRatio(previewVersion) }}>
            {renderVersionPreview(previewVersion, loaded, false)}
          </div>
        )}
      </CreativeModal>

      <CreativeModal
        open={Boolean(compareVersion)}
        title="Compare creative versions"
        eyebrow="Creative History"
        description="Compare the selected history entry, the current saved checkpoint, or the current unsaved session. Nothing changes until you restore and save."
        onClose={() => setCompareVersion(null)}
      >
        {compareModel && (
          <div className="space-y-4">
            <fieldset className="rounded-2xl border border-white/10 bg-white/[0.025] p-2">
              <legend className="px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Compare sources</legend>
              <div className="grid gap-1 sm:grid-cols-3">
                <CompareSourceButton active={comparePair === "history-session"} onClick={() => setComparePair("history-session")}>History vs. session</CompareSourceButton>
                <CompareSourceButton active={comparePair === "history-saved"} onClick={() => setComparePair("history-saved")}>History vs. saved</CompareSourceButton>
                <CompareSourceButton active={comparePair === "saved-session"} disabled={!compareModel.sessionUnsaved} onClick={() => setComparePair("saved-session")}>Saved vs. unsaved</CompareSourceButton>
              </div>
            </fieldset>
            <CreativeCompareView
              leftLabel={compareModel.leftLabel}
              rightLabel={compareModel.rightLabel}
              leftAspectRatio={compareModel.leftAspectRatio}
              rightAspectRatio={compareModel.rightAspectRatio}
              initialMode={window.innerWidth < 640 ? "toggle" : "side-by-side"}
              left={compareModel.left}
              right={compareModel.right}
            />
          </div>
        )}
      </CreativeModal>

      <CreativeModal
        open={fullScreen}
        title={loaded.campaign.title}
        eyebrow="Full-screen creative preview"
        description={`${context} · exact current ${dirty ? "unsaved" : "saved"} state`}
        onClose={() => setFullScreen(false)}
        closeLabel="Exit full screen"
        fullViewport
      >
        <div className="flex h-full min-h-[30rem] flex-col">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
            <div className="flex gap-1 overflow-x-auto">
              {CREATIVE_DESTINATIONS.map(item => <button key={item.key} type="button" aria-pressed={destination === item.key} onClick={() => selectDestination(item.key)} className={`min-h-11 rounded-full px-3 text-[11px] font-semibold ${destination === item.key ? "bg-neon text-black" : "bg-white/[0.06]"}`}>{item.shortName}</button>)}
            </div>
            <div className="flex flex-wrap gap-1">
              <label className="inline-flex min-h-11 items-center rounded-full bg-white/[0.06] px-3 text-[11px] font-semibold">
                <span className="sr-only">Format</span>
                <select aria-label="Full-screen format" value={format} onChange={event => {
                  setMessage("");
                  gestureRef.current = false;
                  dispatch({ type: "push", value: updateCreativeFormat(state, destination, event.target.value) });
                }} className="bg-transparent font-semibold outline-none">
                  {destinationDefinition.formats.map(item => <option key={item.key} value={item.key} className="bg-neutral-950">{item.label}</option>)}
                </select>
              </label>
              <button type="button" aria-pressed={fullScreenGuides} onClick={() => setFullScreenGuides(value => !value)} className={`min-h-11 rounded-full px-3 text-[11px] font-semibold ${fullScreenGuides ? "bg-neon text-black" : "bg-white/[0.06]"}`}>Safe areas</button>
              <button type="button" aria-pressed={showOriginal} onClick={() => setShowOriginal(value => !value)} className={`min-h-11 rounded-full px-3 text-[11px] font-semibold ${showOriginal ? "bg-amber-300 text-black" : "bg-white/[0.06]"}`}>Before / After</button>
              {(["fit", "50", "100"] as const).map(value => <button key={value} type="button" aria-pressed={zoom === value} onClick={() => setZoom(value)} className={`min-h-11 rounded-full px-3 text-[11px] font-semibold ${zoom === value ? "bg-neon text-black" : "bg-white/[0.06]"}`}>{value === "fit" ? "Fit" : `${value}%`}</button>)}
              <span className="inline-flex min-h-11 items-center rounded-full bg-white/[0.06] px-3 text-[11px] font-semibold">{templateLabel(settings.template)}</span>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-3xl border border-white/10 bg-neutral-950 p-4">
            <div className={`w-full ${previewScale}`} style={{ aspectRatio: currentFormat.ratio }}>
              <CreativePreviewCanvas content={content} settings={settings} destination={destination} formatKey={format} selectedQr={selectedQr} interactive={false} showOriginal={showOriginal} showGuides safeAreaOverride={fullScreenGuides} />
            </div>
          </div>
        </div>
      </CreativeModal>

      <CreativeConfirmDialog
        open={Boolean(restoreVersion)}
        title="Restore this creative version?"
        description={restoreVersion ? `${destinationLabel(restoreVersion.destination)} · ${formatVersionTime(restoreVersion.created_at)} will load into your current session.` : ""}
        confirmLabel="Load as unsaved"
        onConfirm={confirmRestore}
        onCancel={() => {
          setRestoreVersion(null);
          setHistoryOpen(true);
        }}
      />

      <CreativeConfirmDialog
        open={Boolean(pendingLeaveHref)}
        title="Leave Creative Workshop?"
        description="Unsaved creative changes will be discarded if you leave now."
        confirmLabel="Leave without saving"
        danger
        onConfirm={() => {
          const href = pendingLeaveHref;
          setPendingLeaveHref(null);
          if (href) navigate(href);
        }}
        onCancel={() => setPendingLeaveHref(null)}
      />

      <CreativeConfirmDialog
        open={Boolean(pendingReset)}
        title={resetTitle(pendingReset, destination, scope)}
        description={resetDescription(pendingReset, destination, scope)}
        confirmLabel="Reset settings"
        danger={pendingReset?.type === "all"}
        onConfirm={confirmReset}
        onCancel={() => setPendingReset(null)}
      />
    </div>
  );
}

type HistoryAction =
  | { type: "push" | "replace" | "checkpoint" | "preview"; value: CreativeWorkshopState }
  | { type: "undo" | "redo" };

function historyReducer(history: ReturnType<typeof createHistory<CreativeWorkshopState>>, action: HistoryAction) {
  if (action.type === "push") return pushHistory(history, action.value);
  if (action.type === "preview") return { past: history.past, present: action.value, future: [] as CreativeWorkshopState[] };
  if (action.type === "replace") return createHistory(action.value);
  if (action.type === "checkpoint") return { past: history.past, present: action.value, future: [] };
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
  const assetRequest = campaign.business_id
    ? supabase
        .from("business_marketing_assets")
        .select("id,title,file_url,external_url,thumbnail_url,is_active")
        .eq("owner_id", ownerId)
        .eq("business_id", campaign.business_id)
        .order("updated_at", { ascending: false })
    : Promise.resolve({ data: [] as Asset[], error: null });
  const profileRequest = campaign.business_id
    ? supabase
        .from("business_cards")
        .select("business_name,logo_url,cover_image_url,primary_color,accent_color")
        .eq("owner_user_id", ownerId)
        .eq("business_id", campaign.business_id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null as Profile | null, error: null });
  const businessRequest = campaign.business_id
    ? supabase
        .from("businesses")
        .select("name,phone,website")
        .eq("id", campaign.business_id)
        .eq("owner_user_id", ownerId)
        .maybeSingle()
    : Promise.resolve({ data: null as Business | null, error: null });
  const activeQrExpiry = new Date().toISOString();
  const [outputResult, assetList, profileResult, businessResult, qrResult] = await Promise.all([
    supabase.from("campaign_outputs").select("*").eq("campaign_id", campaignId).eq("output_type", "interactive_ad").maybeSingle(),
    assetRequest,
    profileRequest,
    businessRequest,
    supabase
      .from("qr_links")
      .select("*")
      .eq("owner_user_id", ownerId)
      .eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${activeQrExpiry}`)
      .order("updated_at", { ascending: false }),
  ]);
  for (const result of [outputResult, assetList, profileResult, businessResult, qrResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  const output = outputResult.data as CampaignOutputRecord | null;
  const assets = (assetList.data ?? []) as Asset[];
  const qrs = (qrResult.data ?? []) as QRLinkRecord[];
  const storedWorkshop = output?.metadata?.creative_workshop;
  const normalizedState = normalizeWorkshopState(storedWorkshop ?? output?.metadata?.template_settings);
  const state = !storedWorkshop
    && campaign.primary_qr_id
    && qrs.some(qr =>
      qr.id === campaign.primary_qr_id
      && isCreativeQrUsableForCampaign(qr, {
        id: campaign.id,
        ownerId: campaign.owner_id,
        businessId: campaign.business_id,
      }))
    ? normalizeWorkshopState({
        ...normalizedState,
        global: { ...normalizedState.global, qrId: campaign.primary_qr_id, showQr: true },
      })
    : normalizedState;
  return {
    loaded: {
      campaign,
      output,
      assets,
      pickerAssets: listActiveCreativeAssetOptions(assets),
      profile: profileResult.data as Profile | null,
      business: businessResult.data as Business | null,
      qrs,
    },
    state,
  };
}

function buildContent(
  loaded: Loaded,
  selectedQr: QRLinkRecord | null,
  imageUrl: string | null,
) {
  return normalizeCampaignContent({
    campaign: loaded.campaign,
    businessName: loaded.business?.name || loaded.profile?.business_name,
    businessLogoUrl: loaded.profile?.logo_url,
    businessPhone: loaded.business?.phone,
    businessWebsite: loaded.business?.website,
    imageUrl,
    destinationUrl: selectedQr ? `${window.location.origin}/q/${selectedQr.slug}` : loaded.campaign.cta_url,
    primaryColor: loaded.profile?.primary_color,
    accentColor: loaded.profile?.accent_color,
  });
}

function CompareSourceButton({
  active,
  disabled = false,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 rounded-xl px-3 text-[11px] font-semibold transition ${active ? "bg-neon text-black" : "bg-white/[0.04] text-[var(--text-secondary)] hover:bg-white/[0.08]"} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function createCreativeCompareModel(
  pair: CreativeComparePair,
  version: CampaignCreativeVersionRecord,
  saved: CreativeWorkshopState,
  session: CreativeWorkshopState,
  loaded: Loaded,
) {
  const destination = version.destination;
  const destinationName = destinationLabel(destination);
  const sessionUnsaved = isEffectiveCreativeDestinationUnsaved(
    saved,
    session,
    destination,
  );
  const historical = {
    label: `${destinationName} · ${formatVersionTime(version.created_at)}`,
    aspectRatio: versionRatio(version),
    preview: renderVersionPreview(version, loaded, false),
  };
  const currentSaved = {
    label: `Current ${destinationName} saved`,
    aspectRatio: stateRatio(saved, destination),
    preview: renderStatePreview(saved, destination, loaded, false),
  };
  const currentSession = {
    label: `Current ${destinationName} ${sessionUnsaved ? "unsaved" : "saved"}`,
    aspectRatio: stateRatio(session, destination),
    preview: renderStatePreview(session, destination, loaded, false),
  };
  const left = pair === "saved-session" ? currentSaved : historical;
  const right = pair === "history-saved" ? currentSaved : currentSession;
  return {
    leftLabel: left.label,
    rightLabel: right.label,
    leftAspectRatio: left.aspectRatio,
    rightAspectRatio: right.aspectRatio,
    left: left.preview,
    right: right.preview,
    sessionUnsaved,
  };
}

function renderStatePreview(
  state: CreativeWorkshopState,
  destination: CreativeDestination,
  loaded: Loaded,
  guides: boolean,
) {
  const effective = resolveEffectiveCreativeDestination(state, destination);
  const qr = loaded.qrs.find(item => item.id === effective.settings.qrId) ?? null;
  const asset = loaded.assets.find(item => item.id === (effective.settings.imageAssetId || loaded.campaign.primary_image_id)) ?? null;
  const image = resolveCreativeAssetUrl(asset) || loaded.profile?.cover_image_url || null;
  return (
    <CreativePreviewCanvas
      content={buildContent(loaded, qr, image)}
      settings={effective.settings}
      destination={destination}
      formatKey={effective.formatKey}
      selectedQr={qr}
      interactive={false}
      showGuides={guides}
    />
  );
}

function stateRatio(state: CreativeWorkshopState, destination: CreativeDestination) {
  return creativeFormatRatio(destination, resolveCreativeFormat(state, destination));
}
function renderVersionPreview(
  version: CampaignCreativeVersionRecord,
  loaded: Loaded,
  guides: boolean,
  rendition: CreativeAssetRendition = "full",
) {
  const versionState = normalizeWorkshopState(version.settings_snapshot);
  const versionSettings = version.scope === "global"
    ? versionState.global
    : resolveCreativeSettings(versionState, version.destination);
  const qr = loaded.qrs.find(item => item.id === versionSettings.qrId) ?? null;
  const asset = loaded.assets.find(item => item.id === (versionSettings.imageAssetId || loaded.campaign.primary_image_id)) ?? null;
  const image = resolveCreativeAssetUrl(asset, rendition) || loaded.profile?.cover_image_url || null;
  const versionContent = buildContent(loaded, qr, image);
  return (
    <CreativePreviewCanvas
      content={versionContent}
      settings={versionSettings}
      destination={version.destination} formatKey={version.format_key as CreativeFormatKey}
      selectedQr={qr}
      interactive={false}
      showGuides={guides}
    />
  );
}

function versionRatio(version: CampaignCreativeVersionRecord) {
  return creativeFormatRatio(version.destination, version.format_key);
}

function destinationLabel(destination: CreativeDestination) {
  return creativeDestinationLabel(destination);
}

function templateLabel(template: string) {
  return template.replace(/-/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function availableCreativeElements(
  content: ReturnType<typeof normalizeCampaignContent>,
  settings: CreativeSettings,
  hasSelectedQr: boolean,
): NonNullable<CreativeElementKey>[] {
  const elements: NonNullable<CreativeElementKey>[] = ["overlay"];
  if (content.imageUrl) elements.push("image");
  if (content.businessLogoUrl) elements.push("logo");
  if (content.businessName) elements.push("business-name");
  if (content.headline) elements.push("headline");
  if (content.offer) elements.push("offer");
  if (content.ctaLabel) elements.push("cta");
  if (hasSelectedQr && content.destinationUrl) elements.push("qr");
  if (content.expiration) elements.push("expiration");
  if (content.businessPhone) elements.push("phone");
  if (content.businessWebsite) elements.push("website");
  if (settings.template === "featured-sponsor") elements.push("sponsor-badge");
  return elements;
}
function elementLabel(element: Exclude<CreativeElementKey, null>) {
  return element.replace(/-/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatVersionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function resetTitle(reset: PendingReset, destination: CreativeDestination, scope: CreativeScope) {
  if (!reset) return "Reset creative settings?";
  if (reset.type === "all") return "Reset all creative settings?";
  if (reset.type === "destination") return `Reset ${destinationLabel(destination)} override?`;
  return `Reset ${scope === "global" ? "global" : destinationLabel(destination)} ${reset.section.toLowerCase()} settings?`;
}

function resetDescription(reset: PendingReset, destination: CreativeDestination, scope: CreativeScope) {
  if (!reset) return "";
  if (reset.type === "all") return "Every destination, override, format, and creative treatment will return to its default.";
  if (reset.type === "destination") return `${destinationLabel(destination)} will return to global settings and its default format.`;
  return `Only the ${reset.section} controls in ${scope === "global" ? "global settings" : `${destinationLabel(destination)} override`} will be reset.`;
}
