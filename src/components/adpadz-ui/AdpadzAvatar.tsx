import type { CSSProperties, HTMLAttributes } from 'react';

type AdpadzAvatarProps = HTMLAttributes<HTMLDivElement> & {
  src?: string | null;
  alt?: string;
  fallback?: string;
  imageStyle?: CSSProperties;
  lightMode?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function AdpadzAvatar({ src, alt = '', fallback = 'A', imageStyle, lightMode = false, className, ...props }: AdpadzAvatarProps) {
  return (
    <div
      {...props}
      className={cx(
        'flex h-24 w-24 items-center justify-center overflow-hidden rounded-[1.7rem] border-4 text-4xl font-black text-black shadow-[0_14px_38px_rgba(0,0,0,0.26),0_0_22px_rgba(255,255,255,0.16)]',
        lightMode ? 'border-white bg-white' : 'border-neutral-950 bg-neutral-900',
        className,
      )}
    >
      {src ? <img src={src} alt={alt} className="h-full w-full" style={imageStyle} /> : fallback}
    </div>
  );
}
