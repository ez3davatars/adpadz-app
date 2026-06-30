import type { ComponentType, ReactNode } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { AdpadzCard } from './AdpadzCard';

type AdpadzMetricCardProps = {
  icon?: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detail?: string;
  trend?: string;
  action?: ReactNode;
};

export function AdpadzMetricCard({ icon: Icon, label, value, detail, trend, action }: AdpadzMetricCardProps) {
  return (
    <AdpadzCard variant="standard" className="p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        {Icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neon/10 text-neon">
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
        {trend ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-neon/10 px-2 py-1 text-[10px] font-black text-neon">
            <ArrowUpRight className="h-3 w-3" /> {trend}
          </span>
        ) : action ? (
          <div>{action}</div>
        ) : null}
      </div>
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</p>
      {detail ? <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{detail}</p> : null}
    </AdpadzCard>
  );
}
