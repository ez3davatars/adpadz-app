import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Contrast,
  Eye,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Minus,
  Plus,
  QrCode,
  RotateCcw,
  Save,
  ScanLine,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import {
  AdpadzButton,
  AdpadzCard,
  AdpadzPill,
} from "../../components/adpadz-ui";
import CreativePreviewCanvas from "../../components/campaign-creative/CreativePreviewCanvas";
import {
  CreativeConfirmDialog,
} from "../../components/campaign-creative/CreativeModal";
import { useCampaignShell } from "../../components/campaign-shell/campaignShellContext";
import {
  CREATIVE_RECIPES,
  applyCreativeRecipe,
  hasAdvancedCreativeOverrides,
  optimizeCampaignCreative,
  resetCreativeRefinements,
  selectCreativeDestination,
  selectCreativeRecipe,
  updateCreativeBrief,
} from "../../features/campaign-templates/creativeDirector";
import type {
  CampaignGoal,
  CreativeDirection,
  CreativeOptimizerAction,
  CreativeRecipeId,
} from "../../features/campaign-templates/creativeDirectorSchema";
import {
  creativeFormatRatio,
  getCreativeDestination,
  resolveCreativeAssetUrl,
  resolveCreativeSettings,
  updateCreativeSettings,
  type CreativeDestination,
  type CreativeWorkshopState,
} from "../../features/campaign-templates/creativeWorkshop";
import {
  classifyCreativeChanges,
  isCreativeQrUsableForCampaign,
  isCreativeWorkshopUnsaved,
  resolveCreativeFormat,
} from "../../features/campaign-templates/creativeWorkshopState";
import type { CampaignOutputRecord, CampaignRecord } from "../../lib/ads";
import { saveCampaignCreative } from "../../lib/campaignCreativeHistory";
import {
  MIN_PRODUCTION_QR_CONTRAST_RATIO,
  qrContrastRatio,
} from "../../lib/qr/qrArtwork";
import { supabase } from "../../lib/supabase";
import {
  buildCreativeContent as buildContent,
  loadCreativeWorkshop as loadWorkshop,
  type LoadedCreativeWorkshop as Loaded,
} from "../../features/campaign-templates/creativeWorkshopData";
import CampaignCreativeWorkshopAdvanced
  from "./CampaignCreativeWorkshopAdvanced";

const DESTINATION_OPTIONS: readonly {
  key: CreativeDestination;
  label: string;
  detail: string;
}[] = [
  {
    key: "mailer",
    label: "Community Mailer",
    detail: "Print-optimized placement",
  },
  {
    key: "discovery",
    label: "Consumer Discovery",
    detail: "Campaign discovery card",
  },
  {
    key: "social",
    label: "Social",
    detail: "Saved social creative",
  },
  {
    key: "qr",
    label: "Digital Campaign",
    detail: "Campaign destination experience",
  },
];

const GOAL_OPTIONS: readonly { value: CampaignGoal; label: string }[] = [
  { value: "promote-offer", label: "Promote an Offer" },
  { value: "generate-calls", label: "Generate Calls" },
  { value: "drive-qr-scans", label: "Drive QR Scans" },
  { value: "build-awareness", label: "Build Awareness" },
];

const DIRECTION_OPTIONS: readonly {
  value: CreativeDirection;
  label: string;
}[] = [
  { value: "premium", label: "Premium" },
  { value: "bold", label: "Bold" },
  { value: "modern", label: "Modern" },
  { value: "minimal", label: "Minimal" },
  { value: "high-contrast", label: "High Contrast" },
];

const OPTIMIZER_ACTIONS: readonly {
  id: CreativeOptimizerAction;
  label: string;
  detail: string;
  icon: typeof Sparkles;
}[] = [
  {
    id: "make-more-premium",
    label: "Make More Premium",
    detail: "More space, hierarchy, and restraint",
    icon: Sparkles,
  },
  {
    id: "simplify",
    label: "Simplify",
    detail: "Remove secondary copy and contact noise",
    icon: Layers3,
  },
  {
    id: "increase-stop-power",
    label: "Increase Stop Power",
    detail: "Stronger headline and focal contrast",
    icon: Target,
  },
  {
    id: "improve-readability",
    label: "Improve Readability",
    detail: "Clearer type and background separation",
    icon: Eye,
  },
  {
    id: "improve-qr-visibility",
    label: "Improve QR Visibility",
    detail: "Larger, quieter scan-ready QR treatment",
    icon: ScanLine,
  },
];

export default function CampaignCreativeDirector() {
  const location = useLocation();
  const advanced =
    new URLSearchParams(location.search).get("mode") === "advanced";
  return advanced
    ? <CampaignCreativeWorkshopAdvanced />
    : <CreativeDirectorWorkspace />;
}

function CreativeDirectorWorkspace() {
  const { campaignId = "" } = useParams();
  const navigate = useNavigate();
  const shell = useCampaignShell();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [state, setState] = useState<CreativeWorkshopState | null>(null);
  const [saved, setSaved] = useState<CreativeWorkshopState | null>(null);
  const [zoom, setZoom] = useState(100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingLeaveHref, setPendingLeaveHref] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setState(null);
    setSaved(null);
    setError("");
    setMessage("");
    void loadWorkshop(campaignId)
      .then(result => {
        if (cancelled) return;
        setLoaded(result.loaded);
        setState(result.state);
        setSaved(result.state);
      })
      .catch(reason => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not open Creative Director.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const dirty = Boolean(
    state && saved && isCreativeWorkshopUnsaved(saved, state),
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const guardLink = (event: MouseEvent) => {
      if (
        !dirty
        || event.defaultPrevented
        || !(event.target instanceof Element)
      ) return;
      const anchor = event.target.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destinationUrl = new URL(anchor.href, window.location.href);
      if (destinationUrl.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setPendingLeaveHref(
        `${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`,
      );
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guardLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guardLink, true);
    };
  }, [dirty]);

  useEffect(() => {
    const shortcut = (event: globalThis.KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey)
        || event.altKey
        || event.shiftKey
        || event.key.toLowerCase() !== "s"
      ) return;
      event.preventDefault();
      saveRef.current();
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    workspaceRef.current?.toggleAttribute("inert", saving);
  }, [saving]);

  const destination = state?.director.destination ?? "mailer";
  const settings = state
    ? resolveCreativeSettings(state, destination)
    : null;
  const format = state ? resolveCreativeFormat(state, destination) : undefined;
  const selection = state?.director.concepts[destination];
  const selectedQr = loaded && settings
    ? loaded.qrs.find(qr => qr.id === settings.qrId) ?? null
    : null;
  const selectableQrs = useMemo(() => {
    if (!loaded) return [];
    return loaded.qrs.filter(qr => {
      if (!isCreativeQrUsableForCampaign(qr, {
        id: loaded.campaign.id,
        ownerId: loaded.campaign.owner_id,
        businessId: loaded.campaign.business_id,
      })) return false;
      if (destination !== "mailer") return true;
      const contrast = qrContrastRatio(
        qr.foreground_color,
        qr.inner_field_color || qr.background_color,
      );
      return (contrast ?? 0) >= MIN_PRODUCTION_QR_CONTRAST_RATIO;
    });
  }, [destination, loaded]);
  const selectedAsset = loaded && settings
    ? loaded.assets.find(
        asset =>
          asset.id
          === (settings.imageAssetId || loaded.campaign.primary_image_id),
      ) ?? null
    : null;
  const imageUrl =
    resolveCreativeAssetUrl(selectedAsset)
    || loaded?.profile?.cover_image_url
    || null;
  const content = useMemo(
    () => loaded ? buildContent(loaded, selectedQr, imageUrl) : null,
    [imageUrl, loaded, selectedQr],
  );
  const destinationDefinition = getCreativeDestination(destination);
  const formatDefinition =
    destinationDefinition.formats.find(item => item.key === format)
    ?? destinationDefinition.formats[0];
  const ratio = creativeFormatRatio(destination, format);
  const ratioLabel = `${Number(formatDefinition.aspect.toFixed(2))}:1`;
  const selectedRecipe = CREATIVE_RECIPES.find(
    item => item.id === selection?.recipeId,
  );
  const hasAdvancedOverrides = state
    ? hasAdvancedCreativeOverrides(state, destination)
    : false;

  function commit(next: CreativeWorkshopState, announcement = "") {
    if (saving) return;
    setState(next);
    setError("");
    setMessage(announcement);
  }

  function requestNavigation(href: string) {
    if (dirty) {
      setPendingLeaveHref(href);
      return;
    }
    navigate(href);
  }

  function chooseDestination(nextDestination: CreativeDestination) {
    if (!state) return;
    commit(
      selectCreativeDestination(state, nextDestination),
      `${DESTINATION_OPTIONS.find(item => item.key === nextDestination)?.label} preview selected.`,
    );
    setZoom(100);
  }

  function chooseRecipe(recipeId: CreativeRecipeId) {
    if (!state) return;
    const recipe = CREATIVE_RECIPES.find(item => item.id === recipeId);
    commit(
      selectCreativeRecipe(state, destination, recipeId),
      `${recipe?.name ?? "Concept"} applied without changing campaign content.`,
    );
  }

  function handleConceptKeyDown(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (
      event.key !== "ArrowRight"
      && event.key !== "ArrowDown"
      && event.key !== "ArrowLeft"
      && event.key !== "ArrowUp"
    ) return;
    event.preventDefault();
    const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
    const nextIndex =
      (index + (forward ? 1 : -1) + CREATIVE_RECIPES.length)
      % CREATIVE_RECIPES.length;
    const nextRecipe = CREATIVE_RECIPES[nextIndex];
    chooseRecipe(nextRecipe.id);
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(
          `[data-concept="${nextRecipe.id}"]`,
        )
        ?.focus();
    });
  }

  async function save(): Promise<boolean> {
    if (!loaded || !state || !saved || !dirty || saving) return !dirty;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const classification = classifyCreativeChanges(saved, state);
      const mailerSettings = resolveCreativeSettings(state, "mailer");
      const mailerQr =
        loaded.qrs.find(qr => qr.id === mailerSettings.qrId) ?? null;
      const mailerQrContrast = mailerQr
        ? qrContrastRatio(
            mailerQr.foreground_color,
            mailerQr.inner_field_color || mailerQr.background_color,
          )
        : 0;
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
        setError(
          "Select a visible, scan-ready Campaign QR in the Creative Brief before saving Community Mailer changes.",
        );
        return false;
      }
      if (
        classification.affectsPrint
        && (mailerQrContrast ?? 0) < MIN_PRODUCTION_QR_CONTRAST_RATIO
      ) {
        setError(
          `Community Mailer QR contrast must be at least ${MIN_PRODUCTION_QR_CONTRAST_RATIO}:1 before saving.`,
        );
        return false;
      }

      const activeSelection = state.director.concepts[destination];
      const activeRecipe = CREATIVE_RECIPES.find(
        item => item.id === activeSelection.recipeId,
      );
      const result = await saveCampaignCreative({
        campaignId: loaded.campaign.id,
        destination,
        formatKey: format ?? destinationDefinition.defaultFormat,
        state,
        changeSummary: [
          `Creative Director concept: ${activeRecipe?.name ?? activeSelection.recipeId}`,
          `Goal: ${GOAL_OPTIONS.find(item => item.value === state.director.goal)?.label}`,
          `Direction: ${DIRECTION_OPTIONS.find(item => item.value === state.director.direction)?.label}`,
          ...activeSelection.refinements.map(
            refinement =>
              OPTIMIZER_ACTIONS.find(item => item.id === refinement)?.label
              ?? refinement,
          ),
        ].slice(0, 20),
        affectsPrint: classification.affectsPrint,
        createdOverride:
          !saved.overrides[destination] && Boolean(state.overrides[destination]),
        scope: "destination",
      });
      const [campaignResult, outputResult] = await Promise.all([
        supabase
          .from("campaigns")
          .select("*")
          .eq("id", loaded.campaign.id)
          .single(),
        supabase
          .from("campaign_outputs")
          .select("*")
          .eq("campaign_id", loaded.campaign.id)
          .eq("output_type", "interactive_ad")
          .single(),
      ]);
      if (campaignResult.error) throw new Error(campaignResult.error.message);
      if (outputResult.error) throw new Error(outputResult.error.message);
      const output = outputResult.data as CampaignOutputRecord;
      const persisted = output.metadata?.creative_workshop
        ?? result.persisted_metadata.creative_workshop;
      const authoritative = (await import(
        "../../features/campaign-templates/creativeWorkshop"
      )).normalizeWorkshopState(persisted);
      setLoaded(current => current
        ? {
            ...current,
            campaign: campaignResult.data as CampaignRecord,
            output,
          }
        : current);
      setState(authoritative);
      setSaved(authoritative);
      setMessage(
        result.print_affected
          ? "Campaign Creative saved. Print preflight must be confirmed again."
          : "Campaign Creative saved.",
      );
      shell?.refreshShell();
      return true;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save Campaign Creative.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  saveRef.current = () => {
    void save();
  };

  if (error && !loaded) {
    return (
      <AdpadzCard
        variant="flat"
        role="alert"
        className="border-red-400/30 bg-red-500/10 text-red-100"
      >
        {error}
      </AdpadzCard>
    );
  }

  if (!loaded || !state || !settings || !content || !selection) {
    return (
      <p className="flex min-h-64 items-center justify-center text-sm text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-neon" />
        Opening Creative Director…
      </p>
    );
  }

  const refinements = selection.refinements;

  return (
    <div
      ref={workspaceRef}
      aria-busy={saving}
      className="min-w-0 max-w-full pb-24 xl:pb-6"
      data-testid="creative-director-workspace"
    >
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <AdpadzPill>
              <Wand2 className="h-3.5 w-3.5 text-neon" />
              Creative Director
            </AdpadzPill>
            <span
              role="status"
              aria-live="polite"
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                dirty
                  ? "bg-amber-300/10 text-amber-200"
                  : "bg-white/[0.05] text-[var(--text-muted)]"
              }`}
            >
              {dirty ? "Unsaved refinements" : "Campaign Creative saved"}
            </span>
          </div>
          <h2 className="mt-2 truncate text-xl font-black text-white sm:text-2xl">
            {loaded.campaign.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            One campaign. Three art-directed concepts. Every destination.
          </p>
        </div>
        <AdpadzButton
          type="button"
          variant="ghost"
          size="sm"
          className="!min-h-11"
          onClick={() => requestNavigation("?mode=advanced")}
        >
          Advanced Edit
          <ArrowRight className="h-4 w-4" />
        </AdpadzButton>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm font-semibold text-red-100"
        >
          {error}
        </div>
      )}
      {message && !error && (
        <div
          role="status"
          className="mb-4 rounded-2xl border border-neon/20 bg-neon/[0.06] p-3 text-sm font-semibold text-neon"
        >
          {message}
        </div>
      )}

      <div className="grid min-w-0 max-w-full gap-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="order-2 min-w-0 xl:order-1" aria-labelledby="creative-brief-title">
          <AdpadzCard variant="flat" className="space-y-5 !rounded-3xl !p-4 sm:!p-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neon">
                Creative Brief
              </p>
              <h2 id="creative-brief-title" className="mt-1 text-lg font-black">
                Direct the campaign
              </h2>
            </div>

            <label className="block text-xs font-bold text-[var(--text-secondary)]">
              Campaign destination
              <select
                value={destination}
                onChange={event =>
                  chooseDestination(event.target.value as CreativeDestination)
                }
                className="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-sm font-bold text-white outline-none focus:border-neon focus:ring-2 focus:ring-neon/30"
              >
                {DESTINATION_OPTIONS.map(option => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block font-normal text-[var(--text-muted)]">
                {DESTINATION_OPTIONS.find(item => item.key === destination)?.detail}
              </span>
            </label>

            <label className="block text-xs font-bold text-[var(--text-secondary)]">
              Campaign goal
              <select
                value={state.director.goal}
                onChange={event =>
                  commit(
                    updateCreativeBrief(state, {
                      goal: event.target.value as CampaignGoal,
                    }),
                    "Goal applied to every destination concept.",
                  )
                }
                className="mt-2 min-h-11 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-sm font-bold text-white outline-none focus:border-neon focus:ring-2 focus:ring-neon/30"
              >
                {GOAL_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <fieldset>
              <legend className="text-xs font-bold text-[var(--text-secondary)]">
                Desired creative direction
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {DIRECTION_OPTIONS.map(option => {
                  const active = state.director.direction === option.value;
                  return (
                    <AdpadzButton
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={active ? "primary" : "secondary"}
                      className="!min-h-11"
                      aria-pressed={active}
                      onClick={() =>
                        commit(
                          updateCreativeBrief(state, {
                            direction: option.value,
                          }),
                          `${option.label} direction applied.`,
                        )
                      }
                    >
                      {option.label}
                    </AdpadzButton>
                  );
                })}
              </div>
            </fieldset>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Primary offer
              </p>
              <p className="mt-1 text-sm font-black text-white">
                {content.offer || "Campaign value message"}
              </p>
              <a
                href={`/app/business/campaigns/${campaignId}/content`}
                className="mt-2 inline-flex min-h-11 items-center text-xs font-bold text-neon underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-neon"
              >
                Edit campaign content
              </a>
            </div>

            <div className="block text-xs font-bold text-[var(--text-secondary)]">
              <p id="creative-hero-image-label">Hero image</p>
              <span className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2">
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/[0.06]">
                  {imageUrl
                    ? <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    : <ImageIcon className="m-3 h-6 w-6 text-[var(--text-muted)]" />}
                </span>
                <select
                  aria-labelledby="creative-hero-image-label"
                  disabled={!imageUrl && loaded.pickerAssets.length === 0}
                  value={settings.imageAssetId ?? ""}
                  onChange={event =>
                    commit(
                      updateCreativeSettings(
                        state,
                        destination,
                        "destination",
                        {
                          imageAssetId: event.target.value || null,
                        },
                      ),
                      "Hero image reference updated.",
                    )
                  }
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-neutral-950 px-2 text-xs font-bold text-white outline-none focus:border-neon"
                >
                  <option value="">Campaign hero image</option>
                  {loaded.pickerAssets.map(asset => (
                    <option key={asset.id} value={asset.id}>
                      {asset.title}
                    </option>
                  ))}
                </select>
              </span>
              {!imageUrl && loaded.pickerAssets.length === 0 && (
                <span className="mt-2 block rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-3 font-normal text-amber-100">
                  Add one strong campaign image to establish the creative focal point.
                  <a
                    href="/app/business/assets"
                    className="mt-2 flex min-h-11 items-center text-xs font-black text-neon underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-neon"
                  >
                    Open Asset Library
                  </a>
                </span>
              )}
            </div>

            <label className="block text-xs font-bold text-[var(--text-secondary)]">
              Campaign QR
              <span className="mt-2 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-black">
                  <QrCode className="h-6 w-6" />
                </span>
                <select
                  value={
                    selectableQrs.some(qr => qr.id === settings.qrId)
                      ? settings.qrId ?? ""
                      : ""
                  }
                  disabled={selectableQrs.length === 0}
                  onChange={event =>
                    commit(
                      updateCreativeSettings(
                        state,
                        destination,
                        "destination",
                        {
                          qrId: event.target.value || null,
                          showQr: Boolean(event.target.value),
                        },
                      ),
                      "Campaign QR reference updated.",
                    )
                  }
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-neutral-950 px-2 text-xs font-bold text-white outline-none focus:border-neon disabled:opacity-60"
                >
                  <option value="">
                    {selectableQrs.length
                      ? "Select a scan-ready Campaign QR"
                      : "No scan-ready Campaign QR available"}
                  </option>
                  {selectableQrs.map(qr => (
                    <option key={qr.id} value={qr.id}>
                      {qr.title}
                    </option>
                  ))}
                </select>
              </span>
              <a
                href={`/app/business/qr-studio?campaign=${campaignId}&return=creative`}
                className="mt-2 inline-flex min-h-11 items-center text-xs font-bold text-neon underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-neon"
              >
                Open QR Studio
              </a>
            </label>

            <div className="rounded-2xl border border-white/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Business identity
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white">
                  {content.businessLogoUrl
                    ? <img src={content.businessLogoUrl} alt="" className="h-full w-full object-contain" />
                    : <span className="text-sm font-black text-black">{content.businessName.slice(0, 1)}</span>}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black">{content.businessName}</span>
                  <span className="block truncate text-xs text-[var(--text-muted)]">
                    {content.businessPhone || content.businessWebsite || "Business Hub identity"}
                  </span>
                </span>
              </div>
            </div>
          </AdpadzCard>
        </aside>

        <main className="order-1 min-w-0 xl:order-2" aria-labelledby="concept-workspace-title">
          <AdpadzCard
            variant="featured"
            className="min-w-0 !rounded-3xl !p-3 sm:!p-5"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  Concept Workspace
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 id="concept-workspace-title" className="text-lg font-black">
                    {selectedRecipe?.name}
                  </h2>
                  {hasAdvancedOverrides && (
                    <AdpadzPill className="!py-1">
                      Advanced Edit overrides
                    </AdpadzPill>
                  )}
                  <AdpadzPill className="!py-1">
                    {DESTINATION_OPTIONS.find(item => item.key === destination)?.label}
                  </AdpadzPill>
                  <AdpadzPill className="!py-1">
                    {formatDefinition.label} · {ratioLabel}
                  </AdpadzPill>
                </div>
              </div>
              <div className="flex items-center gap-1" aria-label="Preview zoom controls">
                <AdpadzButton
                  type="button"
                  variant="icon"
                  size="sm"
                  aria-label="Zoom out"
                  className="!min-h-11 !min-w-11"
                  onClick={() => setZoom(value => Math.max(60, value - 10))}
                >
                  <Minus className="h-4 w-4" />
                </AdpadzButton>
                <AdpadzButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label="Fit preview"
                  className="!min-h-11"
                  onClick={() => setZoom(100)}
                >
                  {zoom === 100 ? "Fit" : `${zoom}%`}
                </AdpadzButton>
                <AdpadzButton
                  type="button"
                  variant="icon"
                  size="sm"
                  aria-label="Zoom in"
                  className="!min-h-11 !min-w-11"
                  onClick={() => setZoom(value => Math.min(130, value + 10))}
                >
                  <Plus className="h-4 w-4" />
                </AdpadzButton>
              </div>
            </div>

            <div className="min-w-0 overflow-auto rounded-3xl border border-white/10 bg-neutral-950 p-3 sm:p-6">
              <div
                className="mx-auto transition-[width] duration-200 motion-reduce:transition-none"
                style={{
                  width: `${zoom}%`,
                  maxWidth: `${8.2 * zoom}px`,
                }}
                data-testid="creative-director-preview-scale"
              >
                <div
                  className="overflow-hidden rounded-2xl [box-shadow:var(--shadow-elevated)]"
                  style={{ aspectRatio: ratio }}
                >
                  <CreativePreviewCanvas
                    content={content}
                    settings={settings}
                    destination={destination}
                    formatKey={format}
                    selectedQr={selectedQr}
                    interactive={false}
                    showGuides
                    safeAreaOverride={destination === "mailer"}
                  />
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
              <span>
                Zoom changes viewing only. Saved output keeps its destination dimensions.
              </span>
              {destination === "mailer" && (
                <span className="inline-flex items-center gap-1.5 text-amber-200">
                  <Contrast className="h-3.5 w-3.5" />
                  Dashed line marks the print-safe boundary
                </span>
              )}
            </div>

            <div
              className="mt-5 grid gap-3 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Campaign creative concepts"
            >
              {CREATIVE_RECIPES.map((recipe, index) => {
                const active = recipe.id === selection.recipeId;
                const conceptSettings = active
                  ? settings
                  : applyCreativeRecipe(
                      settings,
                      recipe.id,
                      destination,
                      state.director.goal,
                      state.director.direction,
                    );
                return (
                  <AdpadzButton
                    key={recipe.id}
                    type="button"
                    variant="secondary"
                    role="radio"
                    aria-checked={active}
                    tabIndex={active ? 0 : -1}
                    data-concept={recipe.id}
                    onClick={() => chooseRecipe(recipe.id)}
                    onKeyDown={event => handleConceptKeyDown(event, index)}
                    className={`!block h-auto !min-h-11 !rounded-2xl !p-2 text-left ${
                      active
                        ? "!border-neon !bg-neon/[0.06]"
                        : ""
                    }`}
                  >
                    <span
                      className="relative block overflow-hidden rounded-xl bg-black"
                      style={{ aspectRatio: ratio }}
                      aria-hidden="true"
                    >
                      <CreativePreviewCanvas
                        content={content}
                        settings={conceptSettings}
                        destination={destination}
                        formatKey={format}
                        selectedQr={selectedQr}
                        interactive={false}
                        showGuides={false}
                      />
                      {active && (
                        <span className="absolute right-2 top-2 rounded-full bg-neon p-1 text-black">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </span>
                    <span className="mt-2 block px-1 text-sm font-black">
                      {recipe.name}
                    </span>
                    <span className="mt-0.5 block px-1 text-[10px] font-medium leading-relaxed text-[var(--text-muted)]">
                      {recipe.promise}
                    </span>
                  </AdpadzButton>
                );
              })}
            </div>
          </AdpadzCard>
        </main>

        <aside className="order-3 min-w-0" aria-labelledby="creative-optimizer-title">
          <AdpadzCard
            variant="flat"
            className="space-y-4 !rounded-3xl !p-4 sm:!p-5 xl:sticky xl:top-4"
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neon">
                Creative Optimizer
              </p>
              <h2 id="creative-optimizer-title" className="mt-1 text-lg font-black">
                Refine the outcome
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                Instant, deterministic refinements. No AI call or network request.
              </p>
            </div>

            <div className="space-y-2">
              {OPTIMIZER_ACTIONS.map(action => {
                const Icon = action.icon;
                const active = refinements.includes(action.id);
                return (
                  <AdpadzButton
                    key={action.id}
                    type="button"
                    variant="secondary"
                    fullWidth
                    onClick={() =>
                      commit(
                        optimizeCampaignCreative(
                          state,
                          destination,
                          action.id,
                        ),
                        `${action.label} applied immediately.`,
                      )
                    }
                    className={`!h-auto !min-h-11 !justify-start !rounded-2xl !px-3 !py-3 text-left ${
                      active ? "!border-neon/60 !bg-neon/[0.06]" : ""
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${active ? "text-neon" : "text-[var(--text-muted)]"}`} />
                    <span className="min-w-0">
                      <span className="block text-xs font-black">{action.label}</span>
                      <span className="mt-0.5 block text-[10px] font-medium leading-relaxed text-[var(--text-muted)]">
                        {action.detail}
                      </span>
                    </span>
                  </AdpadzButton>
                );
              })}
              <AdpadzButton
                type="button"
                variant="ghost"
                fullWidth
                disabled={refinements.length === 0}
                onClick={() =>
                  commit(
                    resetCreativeRefinements(state, destination),
                    "Recipe defaults restored. Campaign content and selected concept were preserved.",
                  )
                }
              >
                <RotateCcw className="h-4 w-4" />
                Reset Refinements
              </AdpadzButton>
            </div>

            <details className="group rounded-2xl border border-white/10 bg-white/[0.025]">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 text-xs font-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-neon">
                Advanced controls
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <div className="border-t border-white/10 p-3">
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                  Fine-tune crop, overlay, typography, branding, visibility, QR selection, print safety, and version history in Advanced Edit.
                </p>
                <AdpadzButton
                  type="button"
                  variant="secondary"
                  fullWidth
                  className="mt-3"
                  onClick={() => requestNavigation("?mode=advanced")}
                >
                  Advanced Edit
                  <ArrowRight className="h-4 w-4" />
                </AdpadzButton>
              </div>
            </details>

            <div className="hidden border-t border-white/10 pt-4 xl:block">
              <AdpadzButton
                type="button"
                fullWidth
                size="lg"
                disabled={saving}
                onClick={() => {
                  if (dirty) {
                    void save();
                  } else {
                    navigate(
                      `/app/business/campaigns/${campaignId}/distribution`,
                    );
                  }
                }}
              >
                {saving
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : dirty
                    ? <Save className="h-4 w-4" />
                    : <QrCode className="h-4 w-4" />}
                {dirty
                  ? "Save Campaign Creative"
                  : "Continue to Distribution"}
              </AdpadzButton>
              <p className="mt-2 text-center text-[10px] leading-relaxed text-[var(--text-muted)]">
                Campaign content stays in Campaign Engine. This saves only the selected recipe and presentation settings.
              </p>
            </div>
          </AdpadzCard>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-950/95 p-3 backdrop-blur-xl xl:hidden">
        <AdpadzButton
          type="button"
          fullWidth
          disabled={saving}
          onClick={() => {
            if (dirty) {
              void save();
            } else {
              navigate(`/app/business/campaigns/${campaignId}/distribution`);
            }
          }}
        >
          {saving
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : dirty
              ? <Save className="h-4 w-4" />
              : <ArrowRight className="h-4 w-4" />}
          {dirty ? "Save Campaign Creative" : "Continue to Distribution"}
        </AdpadzButton>
      </div>

      <CreativeConfirmDialog
        open={Boolean(pendingLeaveHref)}
        title="Leave Creative Director?"
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
    </div>
  );
}
