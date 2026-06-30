import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import { AdpadzCard } from './AdpadzCard';

type AdpadzEmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  lightMode?: boolean;
};

export function AdpadzEmptyState({ title, description, action, icon, lightMode = false }: AdpadzEmptyStateProps) {
  return (
    <AdpadzCard variant="flat" lightMode={lightMode} className="p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-neon/10 text-neon">
        {icon ?? <Sparkles className="h-7 w-7" />}
      </div>
      <h2 className="text-xl font-black">{title}</h2>
      {description && <p className={`mt-2 text-sm ${lightMode ? 'text-neutral-600' : 'text-neutral-400'}`}>{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </AdpadzCard>
  );
}
