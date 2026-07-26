import { useMemo, useState } from "react";
import { CheckCircle2, Download, History, Loader2, ShieldCheck } from "lucide-react";
import { AdpadzButton } from "../adpadz-ui";
import {
  COMMUNITY_MAILER_CANDIDATE_GENERATOR_VERSION,
  type CandidateInput,
} from "../../lib/communityMailerCandidate";
import {
  generateCandidateInBrowser,
  uploadCommunityMailerCandidate,
} from "../../lib/communityMailerCandidateBrowser";
import {
  type AdminMailerDetail,
  certifyAdminMailerCandidate,
  createAdminMailerSnapshots,
  finalizeAdminMailerCandidate,
  getAdminMailer,
} from "../../lib/admin/communityMailers";
import { runCommunityMailerPreflight } from "../../lib/communityMailerProduction";
import { supabase } from "../../lib/supabase";
import { normalizeQRStudioProductionArtwork } from "../../lib/qr/qrArtwork";
import { buildShortUrl, getPublicAppUrl } from "../../lib/qr/qrUtils";

type ExportRecord = {
  id: string;
  layout_revision: number;
  export_kind: "production_candidate" | "printer_certified";
  storage_prefix: string | null;
  checksum: string | null;
  created_at: string;
};

export default function CommunityMailerCandidatePanel(
  { detail, onReload }: { detail: AdminMailerDetail; onReload: () => Promise<void> },
) {
  const [state, setState] = useState<
    "idle" | "generating" | "failed" | "complete"
  >("idle");
  const [message, setMessage] = useState("");
  const exports = detail.production.exports as unknown as ExportRecord[];
  const current = useMemo(
    () => exports.find((item) =>
      item.layout_revision === detail.mailer.layout_revision &&
      Boolean(item.storage_prefix)
    ),
    [detail.mailer.layout_revision, exports],
  );
  const stale = exports.some((item) =>
    item.layout_revision !== detail.mailer.layout_revision
  );
  const occupied = detail.placements.filter((placement) =>
    !["available", "unavailable"].includes(placement.status)
  );
  const missingCampaign = occupied.filter((placement) => !placement.campaign_id);
  const missingQr = occupied.filter((placement) =>
    !placement.qr_link_id || !placement.qr_destination_url
  );
  const preflight = runCommunityMailerPreflight({
    mailerId: detail.mailer.id,
    format: detail.mailer.format,
    mailingDate: detail.mailer.mailing_date,
    layoutRevision: detail.mailer.layout_revision,
    layoutLocked: detail.mailer.layout_locked,
    placements: detail.placements,
    manual: {
      postalAreaConfirmed: detail.mailer.postal_area_confirmed,
      printerSpecsConfirmed: detail.mailer.printer_specs_confirmed,
      colorProfileConfirmed: detail.mailer.color_profile_confirmed,
    },
  });
  const eligible = preflight.passed && missingCampaign.length === 0 &&
    missingQr.length === 0 && Boolean(detail.production.current_preflight_run_id);

  async function generate() {
    setState("generating");
    setMessage("");
    try {
      const snapshots = await createAdminMailerSnapshots(detail.mailer.id);
      if (snapshots.error) throw snapshots.error;
      const refreshed = await getAdminMailer(detail.mailer.id);
      if (refreshed.error || !refreshed.data) {
        throw refreshed.error || new Error("Production data could not be refreshed.");
      }
      const next = refreshed.data as AdminMailerDetail;
      const snapshotByPlacement = new Map(
        next.production.snapshots
          .filter((item) =>
            item.layout_revision === next.mailer.layout_revision
          )
          .map((item) => [item.placement_id, item]),
      );
      const associationByPlacement = new Map(
        next.production.qr_associations
          .filter((item) =>
            Number(item.layout_revision) === next.mailer.layout_revision
          )
          .map((item) => [String(item.placement_id), item]),
      );
      const input: CandidateInput = {
        mailerId: next.mailer.id,
        title: next.mailer.title,
        zoneName: next.mailer.zone_name || "",
        format: next.mailer.format,
        layoutRevision: next.mailer.layout_revision,
        preflightRunId: next.production.current_preflight_run_id || "",
        preflightFingerprint: next.mailer.preflight_fingerprint || "",
        generatedAt: new Date().toISOString(),
        confirmations: {
          postalAreaConfirmed: next.mailer.postal_area_confirmed,
          printerSpecsConfirmed: next.mailer.printer_specs_confirmed,
          colorProfileConfirmed: next.mailer.color_profile_confirmed,
          revision: next.mailer.layout_revision,
        },
        preflightReport: preflight,
        placements: next.placements.filter((placement) =>
          !["available", "unavailable"].includes(placement.status)
        ).map((placement) => {
          const production = snapshotByPlacement.get(placement.id);
          const snapshot = production?.snapshot || {};
          const qr = associationByPlacement.get(placement.id);
          const creativeAsset = snapshot.creative_asset && typeof snapshot.creative_asset === "object"
            ? snapshot.creative_asset as Record<string, unknown>
            : {};
          const qrArtwork = normalizeQRStudioProductionArtwork(snapshot.qr_studio_artwork);
          if (
            !production || !qr || !qrArtwork
            || String(qr.qr_link_id || "") !== qrArtwork.id
            || String(qr.destination_url || "") !== qrArtwork.destination_url
            || placement.qr_link_id !== qrArtwork.id
          ) {
            throw new Error(`${placement.label} snapshot or QR association is incomplete or inconsistent.`);
          }
          return {
            id: placement.id,
            slotKey: placement.slot_key,
            side: placement.side,
            x: placement.x,
            y: placement.y,
            width: placement.width,
            height: placement.height,
            campaignId: placement.campaign_id || "",
            businessId: placement.business_id || "",
            businessName: String(snapshot.business_name || placement.business_name || ""),
            headline: String(snapshot.headline || ""),
            description: String(snapshot.description || ""),
            offer: String(snapshot.offer || ""),
            offerDetails: String(snapshot.offer_description || ""),
            cta: String(snapshot.cta || ""),
            phone: String(snapshot.phone || ""),
            website: String(snapshot.website || ""),
            expiration: String(snapshot.expiration || ""),
            businessLogoUrl: String(snapshot.business_logo_url || snapshot.logo_asset_id || ""),
            primaryColor: String(snapshot.primary_color || snapshot.brand_color || ""),
            accentColor: String(snapshot.accent_color || ""),
            creativeAssetId: String(creativeAsset.id || ""),
            creativeUrl: String(creativeAsset.url || ""),
            qrLinkId: qrArtwork.id,
            qrDestination: qrArtwork.destination_url,
            associatedQrLinkId: String(qr.qr_link_id || ""),
            associatedQrDestination: String(qr.destination_url || ""),
            qrShortUrl: buildShortUrl(qrArtwork.slug, getPublicAppUrl()),
            qrForegroundColor: qrArtwork.foreground_color,
            qrBackgroundColor: qrArtwork.inner_field_color,
            qrArtwork,
            snapshotFingerprint: production.fingerprint,
            creativeSettings: snapshot.creative_settings &&
                typeof snapshot.creative_settings === "object"
              ? snapshot.creative_settings as Record<string, unknown>
              : snapshot.template_settings &&
                  typeof snapshot.template_settings === "object"
              ? snapshot.template_settings as Record<string, unknown>
              : null,
            creativeFormatKey:
              typeof snapshot.creative_format_key === "string"
                ? snapshot.creative_format_key
                : "standard",
            creativeVersionId: production.creative_version_id ||
              (typeof snapshot.creative_version_id === "string"
                ? snapshot.creative_version_id
                : null),
            creativeSnapshotContractVersion: Number(snapshot.creative_snapshot_contract_version || 0),
            creativeRenderContractVersion: Number(snapshot.creative_render_contract_version || 0),
            creativeSettingsFingerprint:
              typeof snapshot.creative_settings_fingerprint === "string"
                ? snapshot.creative_settings_fingerprint
                : null,
            templateSettings: snapshot.template_settings &&
                typeof snapshot.template_settings === "object"
              ? snapshot.template_settings as Record<string, unknown>
              : null,
          };
        }),
      };
      const candidate = await generateCandidateInBrowser(input);
      await uploadCommunityMailerCandidate(candidate);
      const finalized = await finalizeAdminMailerCandidate({
        mailerId: next.mailer.id,
        preflightRunId: input.preflightRunId,
        storagePrefix: candidate.storagePrefix,
        manifest: candidate.manifest,
        checksum: candidate.checksum,
        generatorVersion: COMMUNITY_MAILER_CANDIDATE_GENERATOR_VERSION,
      });
      if (finalized.error) throw finalized.error;
      setState("complete");
      setMessage("Production Candidate generated and stored.");
      await onReload();
    } catch (error) {
      setState("failed");
      setMessage(error instanceof Error ? error.message : "Candidate generation failed.");
    }
  }

  async function download(record: ExportRecord) {
    if (!record.storage_prefix) return;
    const result = await supabase.storage.from("community-mailer-production")
      .createSignedUrl(`${record.storage_prefix}production-manifest.json`, 300);
    if (result.error) setMessage(result.error.message);
    else window.open(result.data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function certify(record: ExportRecord) {
    const result = await certifyAdminMailerCandidate(record.id, {
      confirmation: "Authorized printer confirmation recorded in Mission Control.",
    });
    if (result.error) setMessage(result.error.message);
    else await onReload();
  }

  return (
    <div className="border-t border-white/10 pt-5">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-neon" />
        <h2 className="font-black">Production Candidate</h2>
      </div>
      <p className="mt-2 text-xs text-[var(--text-muted)]">
        Private revision-bound PDFs, previews, manifests, and confirmation records.
        Production Candidates are not printer certified.
      </p>
      <div className="mt-3 space-y-2 text-xs">
        {missingCampaign.length > 0 && <p className="text-amber-200">{missingCampaign.length} occupied placement(s) need a Campaign.</p>}
        {missingQr.length > 0 && <p className="text-amber-200">{missingQr.length} occupied placement(s) need a Campaign-linked QR.</p>}
        {!preflight.passed && <p className="text-amber-200">Current preflight is blocked.</p>}
        {current && <p className="flex items-center gap-2 text-neon"><CheckCircle2 className="h-4 w-4" />Current {current.export_kind.replace("_", " ")}</p>}
        {stale && <p className="text-amber-200">Historical candidate exists for an older revision.</p>}
      </div>
      <AdpadzButton
        fullWidth
        className="mt-4"
        disabled={!eligible || state === "generating" || Boolean(current)}
        onClick={() => void generate()}
      >
        {state === "generating" && <Loader2 className="h-4 w-4 animate-spin" />}
        {current ? "Candidate current" : state === "generating" ? "Generatingâ€¦" : "Generate Production Candidate"}
      </AdpadzButton>
      {current && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <AdpadzButton variant="secondary" onClick={() => void download(current)}>
            <Download className="h-4 w-4" />View manifest
          </AdpadzButton>
          <AdpadzButton
            variant="secondary"
            disabled={current.export_kind === "printer_certified"}
            onClick={() => void certify(current)}
          >
            <ShieldCheck className="h-4 w-4" />Printer certified
          </AdpadzButton>
        </div>
      )}
      {message && <p role="status" className={`mt-3 text-xs ${state === "failed" ? "text-red-300" : "text-neon"}`}>{message}</p>}
      {exports.length > 0 && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer font-black">Export history ({exports.length})</summary>
          <div className="mt-2 space-y-1 text-[var(--text-muted)]">
            {exports.map((item) => <p key={item.id}>Revision {item.layout_revision} Â· {item.export_kind.replace("_", " ")} Â· {new Date(item.created_at).toLocaleString()}</p>)}
          </div>
        </details>
      )}
    </div>
  );
}
