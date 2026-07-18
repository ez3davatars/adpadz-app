import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, Home, Mail, QrCode } from "lucide-react";
import { Link } from "react-router-dom";
import { AdpadzCard } from "../../components/adpadz-ui";
import CommunityMailerCanvas from "../../components/community-mailer/CommunityMailerCanvas";
import CommunityMailerLegend from "../../components/community-mailer/CommunityMailerLegend";
import CommunityMailerSideTabs from "../../components/community-mailer/CommunityMailerSideTabs";
import { formatCommunityCardFormat } from "../../lib/communityCards";
import {
  type BusinessCommunityCampaign,
  getBusinessCommunityCampaigns,
  getBusinessCommunityMailerAssignments,
} from "../../lib/admin/communityMailers";

export default function CommunityCampaigns() {
  const [items, setItems] = useState<BusinessCommunityCampaign[]>([]),
    [selectedId, setSelectedId] = useState<string>(),
    [side, setSide] = useState<"front" | "back">("front"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [assignments, setAssignments] = useState<Array<{ placement_id: string; campaign_title: string | null; campaign_status: string | null; placement_locked: boolean; layout_locked: boolean }>>([]);
  useEffect(() => {
    void (async () => {
      const [result, assignmentResult] = await Promise.all([
        getBusinessCommunityCampaigns(),
        getBusinessCommunityMailerAssignments(),
      ]);
      if (!assignmentResult.error) setAssignments((assignmentResult.data || []) as typeof assignments);
      if (result.error) setError(result.error.message);
      else {
        const campaigns = (result.data || []) as BusinessCommunityCampaign[];
        setItems(campaigns);
        setSelectedId(campaigns[0]?.id);
      }
      setLoading(false);
    })();
  }, []);
  const selected = useMemo(() => items.find((item) => item.id === selectedId), [
    items,
    selectedId,
  ]);
  const mailer = selected;
  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-black uppercase tracking-[.2em] text-neon">
          Marketing
        </p>
        <h1 className="text-3xl font-black">Community Campaigns</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)]">
          Review your placement in its real mailer context and discover
          campaigns open for booking. Other advertisers remain private.
        </p>
      </header>
      {error && (
        <AdpadzCard
          role="alert"
          className="border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"
        >
          {error}
        </AdpadzCard>
      )}
      {loading
        ? (
          <p className="text-sm text-[var(--text-muted)]">
            Loading campaigns...
          </p>
        )
        : items.length === 0
        ? (
          <AdpadzCard className="p-8 text-center">
            <Mail className="mx-auto h-8 w-8 text-[var(--text-muted)]" />
            <h2 className="mt-3 font-black">No community campaigns yet</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Your assigned placements and open local opportunities will appear
              here.
            </p>
          </AdpadzCard>
        )
        : selected && mailer && (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {items.map((campaign) => (
                <button
                  key={campaign.id}
                  onClick={() => setSelectedId(campaign.id)}
                  className={`min-w-56 rounded-xl border p-3 text-left ${
                    campaign.id === selected.id
                      ? "border-neon bg-neon/10"
                      : "border-white/10"
                  }`}
                >
                  <b>{campaign.title}</b>
                  <small className="mt-1 block text-[var(--text-muted)]">
                    {campaign.zone_name || "Mailing zone pending"} /{" "}
                    {campaign.available_placements} open
                  </small>
                </button>
              ))}
            </div>
            <AdpadzCard variant="flat" className="rounded-2xl p-5">
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                <div>
                  <h2 className="text-2xl font-black">{selected.title}</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {selected.zone_name || "Mailing zone pending"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
                    <span className="flex gap-1">
                      <CalendarDays className="h-4 w-4" />
                      {selected.mailing_date || "Date pending"}
                    </span>
                    <span className="flex gap-1">
                      <Home className="h-4 w-4" />
                      {selected.household_count?.toLocaleString() || "--"} homes
                    </span>
                    <span>{formatCommunityCardFormat(selected.format)}</span>
                  </div>
                </div>
                <Link
                  to={`/community-cards/${selected.public_slug}`}
                  className="inline-flex items-center gap-2 text-sm font-black text-neon"
                >
                  View booking page <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </AdpadzCard>
            <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CommunityMailerSideTabs side={side} onChange={setSide} />
                  <CommunityMailerLegend />
                </div>
                <CommunityMailerCanvas
                  mailer={mailer}
                  placements={selected.layout_placements || []}
                  side={side}
                  mode="business-review"
                  highlightIds={selected.own_placements.map((item) => item.id)}
                />
                <p className="text-center text-xs text-[var(--text-muted)]">
                  Your placements are highlighted. Other occupied spaces are
                  intentionally anonymized.
                </p>
              </div>
              <AdpadzCard variant="flat" className="rounded-2xl p-5">
                <h3 className="font-black">Your placements</h3>
                {selected.own_placements.length === 0
                  ? (
                    <p className="mt-3 text-sm text-[var(--text-muted)]">
                      You do not have a placement in this mailer yet.
                    </p>
                  )
                  : (
                    <div className="mt-3 space-y-3">
                      {selected.own_placements.map((placement) => (
                        <div
                          key={placement.id}
                          className="rounded-xl border border-neon/15 bg-neon/[.04] p-3 text-sm"
                        >
                          <div className="flex justify-between">
                            <b>{placement.label}</b>
                            <span className="uppercase text-neon">
                              {placement.status}
                            </span>
                          </div>
                          {placement.artwork_url && (
                            <img
                              src={placement.artwork_url}
                              alt=""
                              className="mt-3 aspect-video w-full rounded-lg bg-white object-contain"
                            />
                          )}
                          {(() => {
                            const assignment = assignments.find((item) => item.placement_id === placement.id);
                            return (
                              <p className="mt-2 text-xs">
                                <b>Assigned Campaign:</b> {assignment?.campaign_title || "Not assigned"}
                                {assignment?.campaign_status ? ` · ${assignment.campaign_status}` : ""}<br />
                                <b>Placement:</b> {assignment?.layout_locked || assignment?.placement_locked ? "Production locked" : "Editable before production lock"}
                              </p>
                            );
                          })()}                          <p className="mt-2 text-xs text-[var(--text-muted)]">
                            Payment: {placement.payment_status} / Proof:{" "}
                            {placement.proof_status} / Production:{" "}
                            {placement.production_status}
                          </p>
                          {placement.offer && (
                            <p className="mt-2 text-xs">{placement.offer}</p>
                          )}
                          {placement.qr_destination_url && (
                            <a
                              className="mt-2 inline-flex items-center gap-1 text-xs font-black text-neon"
                              href={placement.qr_destination_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <QrCode className="h-3.5 w-3.5" />Your QR
                              destination
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
              </AdpadzCard>
            </div>
          </div>
        )}
    </div>
  );
}
