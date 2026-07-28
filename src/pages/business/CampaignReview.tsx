import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, MonitorPlay, QrCode as QrCodeIcon, Sparkles } from "lucide-react";
import { AdpadzBadge, AdpadzButton, AdpadzCard } from "../../components/adpadz-ui";
import { useCampaignShell } from "../../components/campaign-shell/campaignShellContext";
import QRStudioPreview from "../../components/qr/QRStudioPreview";
import {
  buildDestinationCreativeView,
  CAMPAIGN_TEMPLATE_REGISTRY,
  CampaignTemplateRenderer,
  CREATIVE_DESTINATIONS,
  creativeFormatRatio,
  resolveDestinationCreative,
  type CreativeDestination,
  type DestinationCreativeView,
} from "../../features/campaign-templates";
import type { CampaignReadinessSection } from "../../lib/campaignReadiness";
import {
  campaignStagePath,
  normalizeCampaignActionDestination,
  resolveCampaignStageAction,
} from "../../lib/campaignStages";
import { buildShortUrl } from "../../lib/qr/qrUtils";
import type { QRLinkRecord } from "../../lib/qr/qrTypes";
import { supabase } from "../../lib/supabase";

/**
 * Review — the third Campaign stage. A premium, strictly read-only pass over
 * every destination: the saved creative, override state, QR status, print
 * impact, and what still needs attention before Publish. No creative controls
 * live here; every fix links to the exact Studio or Setup surface.
 */

type ReviewResources = {
  businessName: string | null;
  businessPhone: string | null;
  businessWebsite: string | null;
  businessLogoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  fallbackImageUrl: string | null;
  assets: Array<{ id: string; file_url: string | null; thumbnail_url: string | null; external_url: string | null }>;
  qrs: QRLinkRecord[];
};

const DESTINATION_READINESS_KEY: Record<CreativeDestination, CampaignReadinessSection["key"]> = {
  mailer: "mailer",
  discovery: "discovery",
  qr: "qr",
  social: "social",
};

export default function CampaignReview() {
  const shell = useCampaignShell();
  const [resources, setResources] = useState<ReviewResources | null>(null);
  const [error, setError] = useState("");
  const campaign = shell?.campaign ?? null;
  const outputs = shell?.outputs ?? null;
  const readiness = shell?.readiness ?? null;
  const interactiveMetadata = useMemo(
    () => outputs?.find(output => output.output_type === "interactive_ad")?.metadata ?? null,
    [outputs],
  );

  useEffect(() => {
    if (!campaign) return;
    let cancelled = false;
    async function loadResources() {
      if (!campaign) return;
      try {
        const auth = await supabase.auth.getUser();
        if (auth.error) throw new Error(auth.error.message);
        const userId = auth.data.user?.id;
        if (!userId) throw new Error("Sign in to review this campaign.");
        const referencedAssetIds = new Set<string>();
        const referencedQrIds = new Set<string>();
        if (campaign.primary_image_id) referencedAssetIds.add(campaign.primary_image_id);
        for (const destination of CREATIVE_DESTINATIONS) {
          const saved = resolveDestinationCreative(interactiveMetadata, destination.key);
          if (saved.imageAssetId) referencedAssetIds.add(saved.imageAssetId);
          if (saved.qrId) referencedQrIds.add(saved.qrId);
        }
        const [cardResult, businessResult, assetsResult, qrResult] = await Promise.all([
          campaign.business_id
            ? supabase.from("business_cards").select("business_name,logo_url,cover_image_url,primary_color,accent_color,website,phone").eq("owner_user_id", userId).eq("business_id", campaign.business_id).order("updated_at", { ascending: false }).limit(1).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          campaign.business_id
            ? supabase.from("businesses").select("name,phone,website").eq("id", campaign.business_id).eq("owner_user_id", userId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          referencedAssetIds.size
            ? supabase.from("business_marketing_assets").select("id,file_url,thumbnail_url,external_url").eq("owner_id", userId).in("id", [...referencedAssetIds])
            : Promise.resolve({ data: [], error: null }),
          referencedQrIds.size
            ? supabase.from("qr_links").select("*").eq("owner_user_id", userId).in("id", [...referencedQrIds])
            : Promise.resolve({ data: [], error: null }),
        ]);
        for (const result of [cardResult, businessResult, assetsResult, qrResult]) {
          if (result.error) throw new Error(result.error.message);
        }
        if (cancelled) return;
        const card = cardResult.data as { business_name: string; logo_url: string | null; cover_image_url: string | null; primary_color: string | null; accent_color: string | null; website: string | null; phone: string | null } | null;
        const business = businessResult.data as { name: string; phone: string | null; website: string | null } | null;
        const assets = (assetsResult.data ?? []) as ReviewResources["assets"];
        const primaryAsset = campaign.primary_image_id
          ? assets.find(asset => asset.id === campaign.primary_image_id)
          : null;
        setResources({
          businessName: business?.name || card?.business_name || null,
          businessPhone: business?.phone || card?.phone || null,
          businessWebsite: business?.website || card?.website || null,
          businessLogoUrl: card?.logo_url ?? null,
          primaryColor: card?.primary_color ?? null,
          accentColor: card?.accent_color ?? null,
          fallbackImageUrl: primaryAsset?.file_url || primaryAsset?.thumbnail_url || primaryAsset?.external_url || card?.cover_image_url || null,
          assets,
          qrs: (qrResult.data ?? []) as QRLinkRecord[],
        });
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load the campaign review.");
      }
    }
    void loadResources();
    return () => { cancelled = true; };
  }, [campaign, interactiveMetadata]);

  const views = useMemo(() => {
    if (!campaign || !resources) return null;
    const fallbackDestinationUrl = campaign.cta_url
      ? absoluteUrl(campaign.cta_url)
      : null;
    const map = new Map<CreativeDestination, DestinationCreativeView>();
    for (const destination of CREATIVE_DESTINATIONS) {
      const saved = resolveDestinationCreative(interactiveMetadata, destination.key);
      const qr = saved.qrId ? resources.qrs.find(item => item.id === saved.qrId) ?? null : null;
      map.set(destination.key, buildDestinationCreativeView({
        metadata: interactiveMetadata,
        destination: destination.key,
        campaign,
        businessName: resources.businessName,
        businessPhone: resources.businessPhone,
        businessWebsite: resources.businessWebsite,
        businessLogoUrl: resources.businessLogoUrl,
        primaryColor: resources.primaryColor,
        accentColor: resources.accentColor,
        assets: resources.assets,
        qr,
        qrPublicUrl: qr ? absoluteUrl(buildShortUrl(qr.slug)) : null,
        fallbackImageUrl: resources.fallbackImageUrl,
        fallbackDestinationUrl,
      }));
    }
    return map;
  }, [campaign, interactiveMetadata, resources]);

  if (error) {
    return <AdpadzCard variant="flat" role="alert" className="border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100">{error}</AdpadzCard>;
  }
  if (!campaign || !views || !readiness) {
    return (
      <p className="flex min-h-64 items-center justify-center text-sm text-[var(--text-muted)]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-neon" /> Preparing the campaign review…
      </p>
    );
  }

  const nextAction = resolveCampaignStageAction(campaign, readiness);
  const reviewReady = readiness.blockers.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="text-lg font-bold">Review every destination</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
            One saved Campaign creative, rendered exactly as each destination will show it.
            Nothing here is editable — every fix links to the Studio or Setup surface that owns it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdpadzButton href={campaignStagePath(campaign.id, "studio")} variant="secondary" size="sm">
            <ArrowLeft className="h-4 w-4" /> Return to Studio
          </AdpadzButton>
          <AdpadzButton href={campaignStagePath(campaign.id, "publish")} size="sm">
            Continue to Publish <ArrowRight className="h-4 w-4" />
          </AdpadzButton>
        </div>
      </div>

      <AdpadzCard variant={reviewReady ? "featured" : "flat"} className={`p-4 ${reviewReady ? "" : "border-amber-300/25 bg-amber-300/[0.05]"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">{reviewReady ? "This campaign is ready to publish." : "This campaign still needs attention."}</p>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{nextAction.reason}</p>
          </div>
          {nextAction.stage !== "review" && (
            <AdpadzButton href={nextAction.href} variant={reviewReady ? "primary" : "secondary"} size="sm">{nextAction.label}</AdpadzButton>
          )}
        </div>
      </AdpadzCard>

      <div className="grid gap-5 lg:grid-cols-2">
        {CREATIVE_DESTINATIONS.map(destination => {
          const view = views.get(destination.key);
          if (!view) return null;
          const section = readiness.sections.find(item => item.key === DESTINATION_READINESS_KEY[destination.key]);
          return (
            <ReviewDestinationCard
              key={destination.key}
              campaignId={campaign.id}
              destinationKey={destination.key}
              name={destination.name}
              view={view}
              section={section}
              printDestination={destination.capabilities.affectsPrint}
            />
          );
        })}
        <TvComingLaterCard />
      </div>
    </div>
  );
}

function ReviewDestinationCard({
  campaignId,
  destinationKey,
  name,
  view,
  section,
  printDestination,
}: {
  campaignId: string;
  destinationKey: CreativeDestination;
  name: string;
  view: DestinationCreativeView;
  section: CampaignReadinessSection | undefined;
  printDestination: boolean;
}) {
  const { resolved, content, exactQr } = view;
  const templateLabel = CAMPAIGN_TEMPLATE_REGISTRY[resolved.settings.template].label;
  const overridden = resolved.source === "workshop-override";
  const qrStatus = !resolved.settings.showQr
    ? "Hidden"
    : resolved.qrResolution === "exact"
      ? "QR Studio artwork"
      : resolved.qrResolution === "fallback"
        ? "Campaign destination"
        : "Missing";
  const sectionStatus = section?.status ?? "ready";
  const actionableIssues = (section?.issues ?? []).filter(issue => issue.actionLabel && issue.actionDestination);
  return (
    <AdpadzCard as="section" variant="flat" aria-label={`${name} review`} className="min-w-0 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">{name}</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {overridden
            ? <AdpadzBadge variant="status" className="border-amber-300/30 text-amber-300">Customized</AdpadzBadge>
            : <AdpadzBadge variant="status">Global creative</AdpadzBadge>}
          <AdpadzBadge variant={sectionStatus === "ready" ? "verified" : "status"}>
            {sectionStatus === "ready" ? "Ready" : sectionStatus === "blocked" ? "Blocked" : "Needs attention"}
          </AdpadzBadge>
        </div>
      </div>
      <div
        className="mx-auto mt-3 w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-black/30"
        style={{ aspectRatio: creativeFormatRatio(destinationKey, resolved.format), maxWidth: destinationKey === "qr" ? "17rem" : "24rem", containerType: "inline-size" }}
      >
        <CampaignTemplateRenderer
          content={content}
          settings={resolved.renderSettings}
          destination={resolved.rendererDestination}
          qrArtwork={exactQr ? <QRStudioPreview qr={exactQr} /> : undefined}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div><dt className="text-[var(--text-muted)]">Template</dt><dd className="mt-0.5 font-semibold">{templateLabel}</dd></div>
        <div><dt className="text-[var(--text-muted)]">Format</dt><dd className="mt-0.5 font-semibold capitalize">{resolved.format}</dd></div>
        <div><dt className="flex items-center gap-1 text-[var(--text-muted)]"><QrCodeIcon className="h-3 w-3" aria-hidden="true" /> QR</dt><dd className={`mt-0.5 font-semibold ${qrStatus === "Missing" ? "text-amber-300" : ""}`}>{qrStatus}</dd></div>
      </dl>
      {printDestination && (
        <p className="mt-3 rounded-xl bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
          Print destination — publishing new Mailer creative invalidates print preflight and requires a fresh Production Candidate.
        </p>
      )}
      {resolved.issues.length > 0 && (
        <ul className="mt-3 space-y-1 text-[11px] text-amber-200" aria-label={`${name} creative issues`}>
          {resolved.issues.map(item => <li key={item}>{item}</li>)}
        </ul>
      )}
      {actionableIssues.length > 0 && (
        <div className="mt-3 space-y-2">
          {actionableIssues.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-amber-300/[0.06] px-3 py-2">
              <p className="text-[11px] text-amber-100">{item.message}</p>
              <AdpadzButton href={normalizeCampaignActionDestination(item.actionDestination!)} variant="secondary" size="sm">{item.actionLabel}</AdpadzButton>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3">
        <Link
          to={campaignStagePath(campaignId, "studio")}
          className="inline-flex min-h-9 items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:text-neon"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Adjust in Studio
        </Link>
      </div>
    </AdpadzCard>
  );
}

function TvComingLaterCard() {
  return (
    <AdpadzCard as="section" variant="flat" aria-label="Adpadz TV review" className="min-w-0 border-dashed p-4 opacity-80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold"><MonitorPlay className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" /> Adpadz TV</h3>
        <AdpadzBadge variant="status">Coming Later</AdpadzBadge>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
        The same Campaign creative, prepared for 16:9 and 9:16 screens — digital signage,
        waiting rooms, restaurant screens, and trade shows. No extra design work will be
        required when it arrives.
      </p>
    </AdpadzCard>
  );
}

function absoluteUrl(value: string): string | null {
  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return null;
  }
}
