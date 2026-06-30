import type { HTMLAttributes, ReactNode } from 'react';

type AdpadzBadgeVariant = 'local' | 'offer' | 'campaign' | 'verified' | 'status';

type AdpadzBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: AdpadzBadgeVariant;
  gradient?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function AdpadzBadge({ children, className, variant = 'status', gradient, style, ...props }: AdpadzBadgeProps) {
  const variants: Record<AdpadzBadgeVariant, string> = {
    local: 'bg-neon text-black',
    offer: 'bg-neon text-black',
    campaign: 'bg-sky-400 text-black',
    verified: 'bg-emerald-400 text-black',
    status: 'border border-white/10 bg-white/[0.08] text-white',
  };

  return (
    <span
      {...props}
      className={cx('inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em]', variants[variant], className)}
      style={gradient ? { ...style, background: gradient } : style}
    >
      {children}
    </span>
  );
}
