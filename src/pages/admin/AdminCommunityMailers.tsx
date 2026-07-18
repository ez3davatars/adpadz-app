import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Mail, Plus, Search } from "lucide-react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { AdpadzButton, AdpadzCard } from "../../components/adpadz-ui";
import AdminEmptyState from "../../components/admin/AdminEmptyState";
import AdminPageHeader from "../../components/admin/AdminPageHeader";
import type { AdminOutletContext } from "../../components/admin/AdminGuard";
import {
  COMMUNITY_CARD_LAYOUTS,
  type CommunityCardFormat,
  formatCommunityCardFormat,
  formatCurrency,
} from "../../lib/communityCards";
import {
  type AdminMailerSummary,
  createAdminMailer,
  getAdminMailers,
  mailerNeedsAttention,
} from "../../lib/admin/communityMailers";
export default function AdminCommunityMailers() {
  const { profile } = useOutletContext<AdminOutletContext>();
  const canManage = profile.role === "owner" || profile.role === "admin";
  const navigate = useNavigate(),
    [mailers, setMailers] = useState<AdminMailerSummary[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("all"),
    [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    zone: "",
    format: "postcard_9x12" as CommunityCardFormat,
    homes: "",
    date: "",
  });
  async function load() {
    setLoading(true);
    setError("");
    const result = await getAdminMailers();
    if (result.error) setError(result.error.message);
    else setMailers((result.data || []) as AdminMailerSummary[]);
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);
  const filtered = useMemo(
    () =>
      mailers.filter((m) =>
        (status === "all" || m.status === status) &&
        (`${m.title} ${m.zone_name || ""}`).toLowerCase().includes(
          search.toLowerCase(),
        )
      ),
    [mailers, search, status],
  );
  async function create() {
    const layout = COMMUNITY_CARD_LAYOUTS.find((x) =>
      x.format === form.format
    )!;
    const result = await createAdminMailer({
      title: form.title.trim(),
      zoneName: form.zone.trim(),
      format: form.format,
      layout,
      householdCount: Number(form.homes) || null,
      mailingDate: form.date || null,
    });
    if (result.error) return setError(result.error.message);
    navigate(`/admin/community-mailers/${result.data}`);
  }
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Campaign Operations"
        title="Community Mailers"
        description="Manage integrated local campaigns, inventory, creative, payments, and production exceptions."
        actions={canManage
          ? (
            <AdpadzButton onClick={() => setCreating((v) => !v)}>
              <Plus className="h-4 w-4" />New Community Mailer
            </AdpadzButton>
          )
          : undefined}
      />
      {error && (
        <AdpadzCard
          role="alert"
          className="border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200"
        >
          {error}
        </AdpadzCard>
      )}
      {creating && canManage && (
        <AdpadzCard variant="flat" className="rounded-2xl p-5">
          <h2 className="font-black">New Community Mailer</h2>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Enter the essentials; detailed settings remain available after
            creation.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            <input
              className="input-field"
              placeholder="Campaign name"
              value={form.title}
              onChange={(e) =>
                setForm((v) => ({ ...v, title: e.target.value }))}
            />
            <input
              className="input-field"
              placeholder="Mailing zone"
              value={form.zone}
              onChange={(e) =>
                setForm((v) => ({ ...v, zone: e.target.value }))}
            />
            <select
              className="input-field"
              value={form.format}
              onChange={(e) =>
                setForm((v) => ({
                  ...v,
                  format: e.target.value as CommunityCardFormat,
                }))}
            >
              {COMMUNITY_CARD_LAYOUTS.map((x) => (
                <option key={x.key} value={x.format}>
                  {formatCommunityCardFormat(x.format)}
                </option>
              ))}
            </select>
            <input
              className="input-field"
              type="number"
              placeholder="Homes"
              value={form.homes}
              onChange={(e) =>
                setForm((v) => ({ ...v, homes: e.target.value }))}
            />
            <input
              className="input-field"
              type="date"
              value={form.date}
              onChange={(e) => setForm((v) => ({ ...v, date: e.target.value }))}
            />
          </div>
          <div className="mt-4 flex justify-end">
            <AdpadzButton
              disabled={!form.title.trim() || !form.zone.trim()}
              onClick={() => void create()}
            >
              Create inventory
            </AdpadzButton>
          </div>
        </AdpadzCard>
      )}
      <div className="flex gap-3">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            className="input-field pl-10"
            placeholder="Search campaign or zone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          className="input-field w-48"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {["draft", "selling", "building", "review", "ready_for_print", "printed", "mailed", "published", "archived"].map(
            (x) => <option key={x}>{x}</option>,
          )}
        </select>
      </div>
      {loading
        ? (
          <p className="text-sm text-[var(--text-muted)]">
            Loading Community Mailers...
          </p>
        )
        : filtered.length === 0
        ? (
          <AdminEmptyState
            title="No Community Mailers found"
            description="Create a mailer or adjust the current filters."
            icon={Mail}
          />
        )
        : (
          <div className="grid gap-3">
            {filtered.map((m) => (
              <Link key={m.id} to={`/admin/community-mailers/${m.id}`}>
                <AdpadzCard
                  variant="flat"
                  className="rounded-2xl p-4 hover:border-neon/30"
                >
                  <div className="grid gap-3 lg:grid-cols-[1fr_repeat(4,auto)] lg:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-black">{m.title}</h2>
                        <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] uppercase">
                          {m.status}
                        </span>
                        {mailerNeedsAttention(m) && (
                          <span className="flex items-center gap-1 text-xs text-amber-300">
                            <AlertTriangle className="h-3 w-3" />
                            {m.attention_count} needs attention
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {m.zone_name || "Zone missing"} /{" "}
                        {m.mailing_date || "Date missing"}
                      </p>
                    </div>
                    <Stat
                      label="Filled"
                      value={`${
                        m.sold_placements + m.held_placements
                      }/${m.total_placements}`}
                    />
                    <Stat
                      label="Available"
                      value={String(m.available_placements)}
                    />
                    <Stat
                      label="Booked"
                      value={formatCurrency(m.booked_revenue_cents)}
                    />
                    <Stat
                      label="Homes"
                      value={m.household_count?.toLocaleString() || "--"}
                    />
                  </div>
                </AdpadzCard>
              </Link>
            ))}
          </div>
        )}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase text-[var(--text-muted)]">
        {label}
      </p>
      <p className="text-sm font-black">{value}</p>
    </div>
  );
}
