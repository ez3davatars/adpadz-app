import type { HTMLAttributes, ReactNode } from 'react';
import { AdpadzCard } from './AdpadzCard';

type AdpadzSectionProps = HTMLAttributes<HTMLElement> & {
  eyebrow?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  lightMode?: boolean;
};

export function AdpadzSection({ eyebrow, title, description, children, lightMode = false, className, ...props }: AdpadzSectionProps) {
  return (
    <AdpadzCard {...props} className={className} lightMode={lightMode}>
      {(eyebrow || title || description) && (
        <div className="mb-4">
          {eyebrow && <p className="text-[11px] font-black uppercase tracking-[0.22em] opacity-55">{eyebrow}</p>}
          {title && <h2 className="text-2xl font-black">{title}</h2>}
          {description && <p className={`mt-1 max-w-2xl text-sm ${lightMode ? 'text-neutral-600' : 'text-neutral-300'}`}>{description}</p>}
        </div>
      )}
      {children}
    </AdpadzCard>
  );
}
