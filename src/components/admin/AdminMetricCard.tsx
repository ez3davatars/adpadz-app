import type { LucideIcon } from 'lucide-react';
import { AlertCircle } from 'lucide-react';
import { AdpadzCard } from '../adpadz-ui';

type AdminMetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: number | null;
  detail: string;
  loading?: boolean;
  unavailable?: boolean;
};

const metricFormatter = new Intl.NumberFormat();

export default function AdminMetricCard({
  icon: Icon,
  label,
  value,
  detail,
  loading = false,
  unavailable = false,
}: AdminMetricCardProps) {
  const hasValue = !loading && !unavailable && value !== null;

  return (
    <AdpadzCard as="article" variant="flat" className="min-h-40 rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-neon/20 bg-neon/[0.08] text-neon">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        {unavailable ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> Unavailable
          </span>
        ) : null}
      </div>

      {loading ? (
        <div role="status" aria-label={`Loading ${label}`} className="mt-5 space-y-2">
          <div className="mission-control-skeleton h-8 w-20 rounded-lg" />
          <div className="mission-control-skeleton h-3 w-28 rounded" />
        </div>
      ) : (
        <>
          <p className={`mt-5 text-3xl font-black leading-none ${hasValue ? 'text-white' : 'text-[var(--text-muted)]'}`}>
            {hasValue ? metricFormatter.format(value) : '—'}
          </p>
          <p className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</p>
        </>
      )}

      <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{detail}</p>
    </AdpadzCard>
  );
}
