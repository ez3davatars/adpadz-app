import { Eye, MousePointerClick, TrendingUp, Users, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { mockAnalytics, mockAds } from '../../lib/mock-data';

export default function BizAnalytics() {
  const total = mockAnalytics.reduce((acc, d) => ({
    views: acc.views + d.views,
    interactions: acc.interactions + d.interactions,
    ctaClicks: acc.ctaClicks + d.ctaClicks,
    leads: acc.leads + d.leads,
  }), { views: 0, interactions: 0, ctaClicks: 0, leads: 0 });

  const maxViews = Math.max(...mockAnalytics.map(d => d.views));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">Analytics</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Last 7 days performance</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPI icon={Eye} label="Views" value={total.views.toLocaleString()} change="+18.3%" up />
        <KPI icon={MousePointerClick} label="Interactions" value={total.interactions.toLocaleString()} change="+12.1%" up />
        <KPI icon={TrendingUp} label="CTA Clicks" value={total.ctaClicks.toLocaleString()} change="+9.5%" up />
        <KPI icon={Users} label="Leads" value={String(total.leads)} change="+24.0%" up />
      </div>

      {/* Chart */}
      <div className="card-surface p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4">Daily Performance</h2>
        <div className="grid grid-cols-7 gap-2 h-40">
          {mockAnalytics.map((d, i) => (
            <div key={i} className="flex flex-col items-center justify-end gap-1 h-full">
              <div className="w-full flex flex-col justify-end flex-1 gap-0.5">
                <div className="w-full rounded-t bg-neon/60 transition-all" style={{ height: `${(d.interactions / maxViews) * 100}%` }} />
                <div className="w-full rounded-t bg-neon/20" style={{ height: `${((d.views - d.interactions) / maxViews) * 100}%` }} />
              </div>
              <span className="text-[9px] text-[var(--text-muted)]">
                {new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-[var(--text-muted)]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-neon/20" />Views</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-neon/60" />Interactions</span>
        </div>
      </div>

      {/* Top performing ads */}
      <div className="card-surface p-5">
        <h2 className="text-sm font-semibold mb-4">Top Performing Ads</h2>
        <div className="space-y-3">
          {mockAds.sort((a, b) => b.interactionCount - a.interactionCount).slice(0, 5).map((ad, i) => (
            <div key={ad.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-input)]">
              <span className="text-xs font-bold text-[var(--text-muted)] w-5">#{i + 1}</span>
              <img src={ad.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{ad.headline}</p>
                <p className="text-[10px] text-[var(--text-muted)]">{ad.businessName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-neon">{((ad.interactionCount / ad.viewCount) * 100).toFixed(0)}%</p>
                <p className="text-[9px] text-[var(--text-muted)]">eng. rate</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, change, up }: { icon: any; label: string; value: string; change: string; up: boolean }) {
  return (
    <div className="card-surface p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="w-8 h-8 rounded-lg bg-neon/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-neon" />
        </div>
        <span className={`flex items-center gap-0.5 text-[10px] font-medium ${up ? 'text-neon' : 'text-red-400'}`}>
          {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {change}
        </span>
      </div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
    </div>
  );
}
