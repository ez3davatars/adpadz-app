import { useCallback, useEffect, useState } from 'react';
import { Activity, Building2, CalendarClock, Mail, Megaphone, QrCode, RefreshCw, UserRoundPlus } from 'lucide-react';
import { AdpadzButton, AdpadzCard } from '../../components/adpadz-ui';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminMetricCard from '../../components/admin/AdminMetricCard';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import { getAdminDashboardMetrics, getRecentAdminActivity, unavailableAdminDashboardMetrics, type AdminRecentActivity } from '../../lib/admin/adminMetrics';
import { getAdminCampaignReadiness, type AdminCampaignReadiness } from '../../lib/admin/adminCampaignReadiness';
import { CampaignProgressBar, CampaignReadinessBadge } from '../../components/campaign-readiness/CampaignReadinessSummary';

const emptyActivity: AdminRecentActivity = { items: [], availability: 'unavailable', requestFailed: false };
const sourceIcons = { business: Building2, campaign: Megaphone, lead: UserRoundPlus, qr: QrCode };

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(() => unavailableAdminDashboardMetrics());
  const [activity, setActivity] = useState(emptyActivity);
  const [loading, setLoading] = useState(true);
  const [campaignReadiness, setCampaignReadiness] = useState<AdminCampaignReadiness[]>([]);
  const [campaignReadinessError, setCampaignReadinessError] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    const [nextMetrics, nextActivity, nextCampaignReadiness] = await Promise.all([getAdminDashboardMetrics(), getRecentAdminActivity(), getAdminCampaignReadiness().then(data => ({ data, failed: false })).catch(() => ({ data: [], failed: true }))]);
    setMetrics(nextMetrics);
    setActivity(nextActivity);
    setCampaignReadiness(nextCampaignReadiness.data);
    setCampaignReadinessError(nextCampaignReadiness.failed);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const cards = [
    { key: 'activeBusinesses' as const, icon: Building2, label: 'Active businesses', detail: 'Currently active Business Hub accounts.' },
    { key: 'activeCampaigns' as const, icon: Megaphone, label: 'Active campaigns', detail: 'Campaigns currently marked active.' },
    { key: 'newLeads' as const, icon: UserRoundPlus, label: 'New leads', detail: 'Smart Card leads awaiting follow-up.' },
    { key: 'totalQrScans' as const, icon: QrCode, label: 'QR scans', detail: 'Canonical scan events recorded to date.' },
    { key: 'publishedProfiles' as const, icon: Activity, label: 'Published profiles', detail: 'Profiles published by active businesses.' },
    { key: 'communityMailersWithOpenPlacements' as const, icon: Mail, label: 'Open mailers', detail: 'Published mailers with space available.' },
    { key: 'campaignsWithoutDates' as const, icon: CalendarClock, label: 'Missing dates', detail: 'Campaigns needing schedule information.' },
    { key: 'soldPlacements' as const, icon: Megaphone, label: 'Sold placements', detail: 'Community mailer placements marked sold.' },
  ];

  return <div className="space-y-7">
    <AdminPageHeader eyebrow="Command Center" title="Operations dashboard" description="A live, read-only view across Adpadz businesses, campaigns, leads, QR engagement, and community mailers." actions={<AdpadzButton type="button" variant="secondary" size="sm" disabled={loading} onClick={() => void load()}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh</AdpadzButton>} />
    {metrics.availability === 'partial' && !loading ? <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-4 py-3 text-sm text-amber-100">Some metrics are temporarily unavailable. Available values remain live.</p> : null}
    <section aria-labelledby="metrics-heading"><h2 id="metrics-heading" className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-white">Operational pulse</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ key, ...card }) => <AdminMetricCard key={key} {...card} value={metrics.values[key]} loading={loading} unavailable={!loading && metrics.values[key] === null} />)}</div></section>
    <section aria-labelledby="campaign-readiness-heading"><h2 id="campaign-readiness-heading" className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-white">Campaign readiness</h2>
      {campaignReadinessError && !loading ? <p role="status" className="rounded-xl border border-amber-300/20 bg-amber-300/[0.07] px-4 py-3 text-sm text-amber-100">Campaign readiness is unavailable until the admin readiness migration is applied.</p> : campaignReadiness.length === 0 && !loading ? <AdminEmptyState title="No campaign readiness items" description="Campaigns will appear here when source records are available." tone="neutral" /> : <AdpadzCard variant="flat" className="divide-y divide-white/10 overflow-hidden rounded-2xl">{campaignReadiness.slice(0, 8).map(item => <article key={item.campaign.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_180px] sm:items-center sm:px-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-bold text-white">{item.campaign.title}</h3><CampaignReadinessBadge result={item.readiness} /></div><p className="mt-1 text-xs text-[var(--text-muted)]">{item.businessName} · {item.readiness.nextAction?.reason ?? 'No internal action required.'}</p><p className="mt-1 text-[10px] font-bold text-[var(--text-secondary)]">Mailer: {item.readiness.sections.find(section => section.key === 'mailer')?.status.replace('_', ' ')} · Approval: {item.readiness.sections.find(section => section.key === 'approval')?.status.replace('_', ' ')} · Publish: {item.readiness.sections.find(section => section.key === 'publishing')?.status.replace('_', ' ')}</p></div><CampaignProgressBar value={item.readiness.completionPercent} /></article>)}</AdpadzCard>}
    </section>
    <section aria-labelledby="activity-heading"><h2 id="activity-heading" className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-white">Recent activity</h2>
      {loading ? <AdpadzCard variant="flat" className="space-y-4 rounded-2xl p-5" role="status" aria-label="Loading recent activity">{[1, 2, 3].map(item => <div key={item} className="mission-control-skeleton h-14 rounded-xl" />)}</AdpadzCard>
        : activity.items.length === 0 ? <AdminEmptyState title={activity.requestFailed ? 'Activity is unavailable' : 'No recent activity'} description={activity.requestFailed ? 'Refresh to try loading recent events again.' : 'Operational events will appear here as activity is recorded.'} tone={activity.requestFailed ? 'error' : 'neutral'} />
        : <AdpadzCard variant="flat" className="divide-y divide-white/10 overflow-hidden rounded-2xl">{activity.items.map(item => { const Icon = sourceIcons[item.source]; return <article key={`${item.source}-${item.id}`} className="flex gap-3 px-4 py-4 sm:px-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neon/20 bg-neon/[0.07] text-neon"><Icon className="h-4 w-4" aria-hidden="true" /></div><div className="min-w-0 flex-1"><div className="flex flex-col gap-1 sm:flex-row sm:justify-between"><h3 className="text-sm font-bold text-white">{item.title}</h3><time dateTime={item.occurredAt} className="shrink-0 text-[10px] text-[var(--text-muted)]">{new Date(item.occurredAt).toLocaleString()}</time></div><p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{item.detail}</p></div></article>; })}</AdpadzCard>}
    </section>
  </div>;
}
