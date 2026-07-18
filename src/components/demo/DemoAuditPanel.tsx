import { CheckCircle2, Database, Route, ShieldCheck } from 'lucide-react';
import { AdpadzBadge, AdpadzCard } from '../adpadz-ui';
import type { DemoView } from '../../lib/demoRouting';
import type { DemoWorkspaceState } from '../../lib/demoWorkspace';

export default function DemoAuditPanel({ state, view }: { state: DemoWorkspaceState; view: DemoView }) {
  const activeCampaigns = state.campaigns.filter(campaign => campaign.status === 'active');
  const outputs = new Set(activeCampaigns.flatMap(campaign => campaign.outputs));
  return (
    <AdpadzCard variant="glass" className="mb-6 border-sky-400/25 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <AdpadzBadge variant="campaign"><ShieldCheck className="h-3.5 w-3.5" /> Audit mode</AdpadzBadge>
          <h2 className="mt-3 text-lg font-black">Self-contained demo diagnostics</h2>
        </div>
        <span className="text-xs font-black text-sky-300">Schema v{state.schemaVersion}</span>
      </div>
      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <AuditItem icon={Route} label="Route state" value={`${state.business.slug} / ${view}`} />
        <AuditItem icon={CheckCircle2} label="Active campaigns" value={`${activeCampaigns.length} ready`} />
        <AuditItem icon={Database} label="Enabled outputs" value={`${outputs.size} unique`} />
        <AuditItem icon={ShieldCheck} label="Persistence" value="Local browser only" />
      </div>
    </AdpadzCard>
  );
}

function AuditItem({ icon: Icon, label, value }: { icon: typeof Route; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3">
      <Icon className="h-4 w-4 text-sky-300" />
      <p className="mt-2 font-black">{label}</p>
      <p className="mt-1 break-words text-neutral-400">{value}</p>
    </div>
  );
}
