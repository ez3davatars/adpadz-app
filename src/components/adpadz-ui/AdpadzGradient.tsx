import type { HTMLAttributes } from 'react';

type AdpadzGradientProps = HTMLAttributes<HTMLDivElement> & {
  from?: string;
  to?: string;
  opacity?: number;
};

export function AdpadzGradient({ from = '#b0ff00', to = '#38bdf8', opacity = 0.16, style, className = '', ...props }: AdpadzGradientProps) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        opacity,
        background: `radial-gradient(circle at 12% 12%, ${from}, transparent 34%), radial-gradient(circle at 88% 0%, ${to}, transparent 32%)`,
        ...style,
      }}
    />
  );
}
