import { Mail, Phone, MoreHorizontal } from 'lucide-react';
import { mockLeads } from '../../lib/mock-data';
import { useState } from 'react';

export default function BizLeads() {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? mockLeads : mockLeads.filter(l => l.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Leads</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">{mockLeads.length} total leads</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {['all', 'new', 'contacted', 'qualified', 'converted', 'lost'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
              filter === f ? 'bg-neon text-black' : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Lead list */}
      <div className="space-y-2">
        {filtered.map(lead => (
          <div key={lead.id} className="card-surface p-4 hover:border-[var(--border-neon)] transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-neon/10 flex items-center justify-center text-neon text-xs font-bold flex-shrink-0">
                  {lead.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-semibold">{lead.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">From: {lead.adHeadline}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    {lead.email && (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                        <Mail className="w-3 h-3" /> {lead.email}
                      </span>
                    )}
                    {lead.phone && (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                        <Phone className="w-3 h-3" /> {lead.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <LeadBadge status={lead.status} />
                <button className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)]">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="mt-2 pl-12 text-[10px] text-[var(--text-muted)]">
              {new Date(lead.createdAt).toLocaleDateString()} at {new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LeadBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: 'bg-blue-400/10 text-blue-400',
    contacted: 'bg-yellow-400/10 text-yellow-400',
    qualified: 'bg-neon/10 text-neon',
    converted: 'bg-green-400/10 text-green-400',
    lost: 'bg-red-400/10 text-red-400',
  };
  return <span className={`badge text-[10px] capitalize ${colors[status] || colors.new}`}>{status}</span>;
}
