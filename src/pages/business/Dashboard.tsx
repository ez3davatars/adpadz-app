import { Link } from 'react-router-dom';
import { Eye, MousePointerClick, TrendingUp, Users, ArrowUpRight, Plus, Zap } from 'lucide-react';
import { mockAds, mockCampaigns, mockAnalytics, mockLeads } from '../../lib/mock-data';

export default function BizDashboard() {
  const totalViews = mockAds.reduce((s, a) => s + a.viewCount, 0);
  const totalInteractions = mockAds.reduce((s, a) => s + a.interactionCount, 0);
  const engRate = ((totalInteractions / totalViews) * 100).toFixed(1);
  const newLeads = mockLeads.filter(l => l.status === 'new').length;
  const activeCampaigns = mockCampaigns.filter(c => c.status === 'active').length;

  const todayData = mockAnalytics[mockAnalytics.length - 1];

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">Your business at a glance</p>
        </div>
        <Link to="/app/business/create-ad" className="btn-primary text-sm px-5 py-2.5">
          <Plus className="w-4 h-4" /> Create Ad
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Eye} label="Total Views" value={totalViews.toLocaleString()} trend="+12.5%" />
        <StatCard icon={MousePointerClick} label="Interactions" value={totalInteractions.toLocaleString()} trend="+8.2%" />
        <StatCard icon={TrendingUp} label="Engagement" value={`${engRate}%`} trend="+3.1%" />
        <StatCard icon={Users} label="New Leads" value={String(newLeads)} trend={`+${newLeads}`} />
      </div>

      {/* Chart area */}
      <div className="card-surface p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Performance (7 days)</h2>
          <span className="text-xs text-[var(--text-muted)]">Today: {todayData.views.toLocaleString()} views</span>
        </div>
        <div className="flex items-end gap-1 h-32">
          {mockAnalytics.map((d, i) => {
            const max = Math.max(...mockAnalytics.map(x => x.views));
            const h = (d.views / max) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-neon/20 hover:bg-neon/40 transition-colors relative group"
                  style={{ height: `${h}%` }}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] text-neon opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {d.views}
                  </div>
                </div>
                <span className="text-[9px] text-[var(--text-muted)]">
                  {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' }).charAt(0)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Campaigns */}
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Active Campaigns</h2>
            <Link to="/app/business/campaigns" className="text-xs text-neon hover:underline">{activeCampaigns} active</Link>
          </div>
          <div className="space-y-3">
            {mockCampaigns.filter(c => c.status === 'active').map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-input)]">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    ${c.spent.toFixed(0)} / ${c.budget} spent
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-neon">{c.conversions}</p>
                  <p className="text-[10px] text-[var(--text-muted)]">conversions</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Ads */}
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold">Recent Ads</h2>
            <Link to="/app/business/create-ad" className="text-xs text-neon hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {mockAds.slice(0, 4).map(ad => (
              <div key={ad.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-input)]">
                <div className="w-10 h-10 rounded-lg bg-neon/10 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-5 h-5 text-neon" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ad.headline}</p>
                  <p className="text-[10px] text-[var(--text-muted)] capitalize">{ad.interactiveType.replace('_', ' ')}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium">{(ad.viewCount / 1000).toFixed(1)}k</p>
                  <p className="text-[10px] text-[var(--text-muted)]">views</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, trend }: { icon: any; label: string; value: string; trend: string }) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="w-9 h-9 rounded-xl bg-neon/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-neon" />
        </div>
        <span className="flex items-center gap-0.5 text-[10px] text-neon font-medium">
          <ArrowUpRight className="w-3 h-3" />{trend}
        </span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{label}</p>
    </div>
  );
}
