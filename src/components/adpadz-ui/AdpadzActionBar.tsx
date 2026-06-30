import type { ReactNode } from 'react';
import { AdpadzCard } from './AdpadzCard';

type AdpadzActionBarProps = {
  title?: string;
  children: ReactNode;
  ctas?: ReactNode;
  lightMode?: boolean;
  className?: string;
};

export function AdpadzActionBar({ title = 'Connect', children, ctas, lightMode = false, className }: AdpadzActionBarProps) {
  return (
    <AdpadzCard variant="glass" lightMode={lightMode} className={`sticky top-3 z-30 rounded-[1.75rem] px-4 py-3 sm:px-5 ${className ?? ''}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-black sm:text-lg">{title}</h2>
          <span className={`hidden rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] sm:inline-flex ${lightMode ? 'bg-black/[0.04] text-neutral-500' : 'bg-white/[0.06] text-neutral-300'}`}>Local profile</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 sm:justify-start">{children}</div>
        {ctas && <div className="grid gap-2 sm:grid-cols-2">{ctas}</div>}
      </div>
    </AdpadzCard>
  );
}
