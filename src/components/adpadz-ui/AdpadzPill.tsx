import type { HTMLAttributes, ReactNode } from 'react';

type AdpadzPillProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  lightMode?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function AdpadzPill({ children, className, lightMode = false, ...props }: AdpadzPillProps) {
  return (
    <span
      {...props}
      className={cx(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold',
        lightMode ? 'border-black/10 bg-black/[0.03] text-neutral-700' : 'border-white/10 bg-white/[0.05] text-neutral-200',
        className,
      )}
    >
      {children}
    </span>
  );
}
