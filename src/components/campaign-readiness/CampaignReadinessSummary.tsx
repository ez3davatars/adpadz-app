import { ChevronDown, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { CampaignReadinessResult } from '../../lib/campaignReadiness';
import { AdpadzBadge, AdpadzButton, AdpadzCard } from '../adpadz-ui';

export function CampaignProgressBar({ value }: { value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-xs"><span className="font-bold text-[var(--text-secondary)]">Campaign completion</span><span className="font-black text-white">{value}%</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-label="Campaign completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-valuetext={`${value}% complete`}>
        <div className="h-full rounded-full bg-neon transition-[width]" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function CampaignReadinessBadge({ result }: { result: CampaignReadinessResult }) {
  return <AdpadzBadge variant={result.overallStatus === 'ready' ? 'verified' : 'status'}>{formatStatus(result.overallStatus)}</AdpadzBadge>;
}

export function CampaignReadinessSummary({ result, compact = false }: { result: CampaignReadinessResult; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const topIssue = result.blockers[0] ?? result.warnings[0] ?? result.sections.flatMap(section => section.issues).find(issue => issue.severity === 'info');
  return (
    <AdpadzCard variant="flat" className={compact ? 'p-4' : 'p-5'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-black">Campaign readiness</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">{topIssue?.message ?? 'Every required campaign element is ready.'}</p></div>
        <CampaignReadinessBadge result={result} />
      </div>
      <div className="mt-4"><CampaignProgressBar value={result.completionPercent} /></div>
      <div className="mt-4 flex flex-wrap gap-2">
        {result.nextAction && <AdpadzButton href={result.nextAction.destination} size="sm">{result.nextAction.label}</AdpadzButton>}
        {!compact && <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="inline-flex min-h-9 items-center gap-2 rounded-full px-3 text-xs font-black text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-white">Checklist <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-180' : ''}`} /></button>}
      </div>
      {expanded && (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-4">
          {result.sections.map(section => {
            const Icon = section.status === 'ready' ? CheckCircle2 : section.status === 'blocked' ? XCircle : AlertCircle;
            return <div key={section.key} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.025] px-3 py-2"><span className="flex items-center gap-2 text-xs font-bold"><Icon className={`h-4 w-4 ${section.status === 'ready' ? 'text-neon' : section.status === 'blocked' ? 'text-red-300' : 'text-amber-300'}`} />{section.label}</span><span className="text-[10px] font-black text-[var(--text-muted)]">{formatStatus(section.status)}</span></div>;
          })}
        </div>
      )}
    </AdpadzCard>
  );
}

function formatStatus(status: CampaignReadinessResult['overallStatus']): string {
  if (status === 'needs_attention') return 'Needs attention';
  if (status === 'incomplete') return 'Incomplete';
  if (status === 'blocked') return 'Blocked';
  return 'Ready';
}
