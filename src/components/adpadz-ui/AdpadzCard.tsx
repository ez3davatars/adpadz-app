import type { HTMLAttributes, ReactNode } from 'react';

type AdpadzCardVariant = 'standard' | 'featured' | 'glass' | 'coupon' | 'flat';

type AdpadzCardProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'article' | 'div';
  children: ReactNode;
  variant?: AdpadzCardVariant;
  lightMode?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function AdpadzCard({ as: Element = 'section', children, className, variant = 'standard', lightMode = false, ...props }: AdpadzCardProps) {
  const variants: Record<AdpadzCardVariant, string> = {
    standard: lightMode ? 'border-black/10 bg-white/[0.85] text-neutral-950 shadow-black/10' : 'border-white/10 bg-neutral-950/[0.78] text-white shadow-black/40',
    featured: lightMode ? 'border-black/10 bg-white text-neutral-950 shadow-[0_28px_90px_rgba(0,0,0,0.14)]' : 'border-white/10 bg-neutral-950 text-white shadow-[0_28px_90px_rgba(0,0,0,0.42)]',
    glass: lightMode ? 'border-black/10 bg-white/70 text-neutral-950 backdrop-blur-xl' : 'border-white/10 bg-white/[0.07] text-white backdrop-blur-xl',
    coupon: lightMode ? 'border-black/10 bg-white text-neutral-950 shadow-[0_24px_70px_rgba(0,0,0,0.16)]' : 'border-white/10 bg-neutral-950 text-white shadow-[0_24px_70px_rgba(0,0,0,0.34)]',
    flat: lightMode ? 'border-black/10 bg-white text-neutral-950' : 'border-white/10 bg-neutral-950 text-white',
  };

  return (
    <Element
      {...props}
      className={cx('relative overflow-hidden rounded-[2rem] border p-5 sm:p-6', variants[variant], className)}
    >
      {children}
    </Element>
  );
}
