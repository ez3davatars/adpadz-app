import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

type AdpadzButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
type AdpadzButtonSize = 'sm' | 'md' | 'lg';

type SharedProps = {
  children: ReactNode;
  className?: string;
  variant?: AdpadzButtonVariant;
  size?: AdpadzButtonSize;
  fullWidth?: boolean;
  gradient?: string;
};

type ButtonProps = SharedProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AnchorProps = SharedProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const variantClasses: Record<AdpadzButtonVariant, string> = {
  primary: 'bg-neon text-black shadow-[0_14px_34px_rgba(176,255,0,0.24)] hover:brightness-105',
  secondary: 'border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]',
  ghost: 'border border-transparent bg-transparent text-white hover:bg-white/[0.07]',
  danger: 'bg-red-500 text-white shadow-[0_14px_34px_rgba(239,68,68,0.22)] hover:bg-red-400',
  icon: 'border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.1]',
};

const sizeClasses: Record<AdpadzButtonSize, string> = {
  sm: 'min-h-9 px-3 text-xs',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-[52px] px-6 text-sm',
};

export function AdpadzButton(props: ButtonProps | AnchorProps) {
  const { children, className, variant = 'primary', size = 'md', fullWidth = false, gradient, ...rest } = props;
  const commonClassName = cx(
    'inline-flex items-center justify-center gap-2 rounded-full font-black transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && 'w-full',
    variant === 'icon' && 'aspect-square px-0',
    className,
  );
  const style = gradient ? { ...(rest.style ?? {}), background: gradient } : rest.style;

  if ('href' in props && props.href) {
    return (
      <a {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} href={props.href} className={commonClassName} style={style}>
        {children}
      </a>
    );
  }

  return (
    <button {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} className={commonClassName} style={style}>
      {children}
    </button>
  );
}
