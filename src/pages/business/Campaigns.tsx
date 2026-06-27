import { Link } from 'react-router-dom';
import { Plus, Play, Pause, MoreHorizontal } from 'lucide-react';
import { mockCampaigns } from '../../lib/mock-data';

export default function BizCampaigns() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Campaigns</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{mockCampaigns.length} campaigns total</p>
        </div>
        <Link to="/app/business/create-ad" className="btn-primary text-sm px-5 py-2.5">
          <Plus className="w-4 h-4" /> New Campaign
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Active', count: mockCampaigns.filter(c => c.status === 'active').length, color: 'text-neon' },
          { label: 'Draft', count: mockCampaigns.filter(c => c.status === 'draft').length, color: 'text-[var(--text-secondary)]' },
          { label: 'Paused', count: mockCampaigns.filter(c => c.status === 'paused').length, color: 'text-yellow-400' },
          { label: 'Ended', count: mockCampaigns.filter(c => c.status === 'ended').length, color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="card-surface p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Campaign list */}
      <div className="space-y-3">
        {mockCampaigns.map(c => (
          <div key={c.id} className="card-surface p-4 hover:border-[var(--border-neon)] transition-all">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{c.name}</h3>
                  <StatusBadge status={c.status} />
                </div>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  {c.startDate} - {c.endDate} | {c.objective}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {c.status === 'active' && (
                  <button className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
                    <Pause className="w-4 h-4" />
                  </button>
                )}
                {c.status === 'paused' && (
                  <button className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-neon">
                    <Play className="w-4 h-4" />
                  </button>
                )}
                <button className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)]">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex-1">
                <div className="flex justify-between text-[10px] text-[var(--text-muted)] mb-1">
                  <span>Budget</span>
                  <span>${c.spent.toFixed(0)} / ${c.budget}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-input)]">
                  <div className="h-full rounded-full bg-neon transition-all" style={{ width: `${Math.min((c.spent / c.budget) * 100, 100)}%` }} />
                </div>
              </div>
              <div className="flex gap-4">
                <Metric label="Impressions" value={c.impressions.toLocaleString()} />
                <Metric label="Clicks" value={c.clicks.toLocaleString()} />
                <Metric label="Conv." value={String(c.conversions)} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-semibold">{value}</p>
      <p className="text-[9px] text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    active: 'badge-active',
    draft: 'badge-draft',
    paused: 'badge-paused',
    ended: 'badge-ended',
  };
  return <span className={`badge ${cls[status] || cls.draft} text-[10px]`}>{status}</span>;
}
