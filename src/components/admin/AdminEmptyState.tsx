import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { AdpadzCard } from '../adpadz-ui';

type AdminEmptyStateProps = {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
  tone?: 'neutral' | 'error';
};

export default function AdminEmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  tone = 'neutral',
}: AdminEmptyStateProps) {
  const error = tone === 'error';

  return (
    <AdpadzCard
      variant="flat"
      className={`rounded-2xl p-6 text-center ${error ? 'border-red-400/30 bg-red-500/[0.08]' : 'bg-white/[0.025]'}`}
      role={error ? 'alert' : 'status'}
    >
      <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl border ${error ? 'border-red-400/25 bg-red-400/10 text-red-300' : 'border-white/10 bg-white/[0.05] text-[var(--text-secondary)]'}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-black text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </AdpadzCard>
  );
}
