import type { ReactNode } from 'react';
import { BadgePercent } from 'lucide-react';
import { AdpadzBadge } from './AdpadzBadge';
import { AdpadzCard } from './AdpadzCard';

type AdpadzCouponCardProps = {
  title: string;
  description?: string | null;
  eyebrow?: string;
  badgeLabel?: string;
  details?: ReactNode;
  action?: ReactNode;
  gradient?: string;
  lightMode?: boolean;
};

export function AdpadzCouponCard({ title, description, eyebrow = "Claim today's offer", badgeLabel = 'Local Special', details, action, gradient, lightMode = false }: AdpadzCouponCardProps) {
  return (
    <AdpadzCard variant="coupon" lightMode={lightMode}>
      {gradient && <div className="pointer-events-none absolute inset-0 opacity-[0.14]" style={{ background: gradient }} />}
      <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <AdpadzBadge variant="offer" gradient={gradient ? undefined : undefined} className="mb-3" style={gradient ? { background: gradient } : undefined}>
            <BadgePercent className="h-3.5 w-3.5" /> {badgeLabel}
          </AdpadzBadge>
          <p className={`mb-1 text-xs font-black uppercase tracking-[0.22em] ${lightMode ? 'text-neutral-500' : 'text-neutral-400'}`}>{eyebrow}</p>
          <h2 className="text-3xl font-black leading-tight sm:text-4xl">{title}</h2>
          {description && <p className={`mt-2 max-w-2xl text-sm leading-relaxed sm:text-base ${lightMode ? 'text-neutral-700' : 'text-neutral-300'}`}>{description}</p>}
          {details && <div className="mt-4 flex flex-wrap gap-2">{details}</div>}
        </div>
        {action}
      </div>
    </AdpadzCard>
  );
}
