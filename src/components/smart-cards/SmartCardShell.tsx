import { BadgePercent, Download, ExternalLink, Link as LinkIcon, type LucideIcon } from 'lucide-react';
import { getCoverOverlayStyle, getImageDisplayStyle, type ImageFitMode } from '../../lib/smartCards';

export type SmartCardShellAction = {
  label: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
};

export type SmartCardShellOffer = {
  title: string;
  description?: string | null;
};

export type SmartCardShellLink = {
  id: string;
  label: string;
  url: string;
  onClick?: () => void;
};

type SmartCardShellProps = {
  businessName: string;
  tagline?: string | null;
  address?: string | null;
  primaryColor: string;
  accentColor: string;
  lightMode?: boolean;
  coverImageUrl?: string | null;
  coverFit?: ImageFitMode | null;
  coverPositionX?: number | string | null;
  coverPositionY?: number | string | null;
  coverZoom?: number | string | null;
  coverOverlayOpacity?: number | string | null;
  logoUrl?: string | null;
  logoFit?: ImageFitMode | null;
  logoPositionX?: number | string | null;
  logoPositionY?: number | string | null;
  logoZoom?: number | string | null;
  actions: SmartCardShellAction[];
  onSaveContact?: () => void;
  offer?: SmartCardShellOffer | null;
  links?: SmartCardShellLink[];
  interactive?: boolean;
};

export function SmartCardShell({
  businessName,
  tagline,
  primaryColor,
  accentColor,
  lightMode = false,
  coverImageUrl,
  coverFit,
  coverPositionX,
  coverPositionY,
  coverZoom,
  coverOverlayOpacity,
  logoUrl,
  logoFit,
  logoPositionX,
  logoPositionY,
  logoZoom,
  actions,
  onSaveContact,
  offer,
  links = [],
  interactive = false,
}: SmartCardShellProps) {
  const coverImageStyle = getImageDisplayStyle({ fit: coverFit, position_x: coverPositionX, position_y: coverPositionY, zoom: coverZoom });
  const coverOverlayStyle = getCoverOverlayStyle(coverOverlayOpacity, lightMode);
  const logoImageStyle = getImageDisplayStyle({ fit: logoFit, position_x: logoPositionX, position_y: logoPositionY, zoom: logoZoom });
  const shellClass = lightMode
    ? 'border-black/10 bg-white shadow-black/10 text-neutral-950'
    : 'border-white/10 bg-neutral-950 shadow-black/40 text-white';
  const actionClass = lightMode
    ? 'bg-black/[0.04] text-neutral-900'
    : 'bg-white/[0.06] text-white';
  const mutedClass = lightMode ? 'text-neutral-600' : 'text-neutral-300';
  const linkClass = lightMode
    ? 'bg-black/[0.03] text-neutral-900'
    : 'bg-white/[0.05] text-white';
  const fallbackName = businessName || 'Business name';

  return (
    <div className={`mx-auto w-full max-w-[27rem] overflow-hidden rounded-[1.75rem] border shadow-2xl ${shellClass}`}>
      <div className="relative h-36">
        {coverImageUrl ? (
          <div className="absolute inset-0 overflow-hidden">
            <img src={coverImageUrl} alt="" className="h-full w-full" style={coverImageStyle} />
          </div>
        ) : (
          <div className="absolute inset-0 overflow-hidden">
            <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }} />
          </div>
        )}
        <div className="absolute inset-0" style={coverOverlayStyle} />
        <div className={`absolute -bottom-9 left-4 h-20 w-20 overflow-hidden rounded-3xl border-4 ${lightMode ? 'border-white bg-white' : 'border-neutral-950 bg-neutral-900'}`}>
          {logoUrl ? (
            <img src={logoUrl} alt={`${fallbackName} logo`} className="h-full w-full" style={logoImageStyle} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-black text-black" style={{ background: primaryColor }}>
              {fallbackName.charAt(0).toUpperCase() || 'A'}
            </div>
          )}
        </div>
      </div>
      <div className="px-4 pb-4 pt-12">
        <h3 className="text-2xl font-black leading-tight break-words">{fallbackName}</h3>
        <p className={`mt-1 text-sm ${mutedClass}`}>{tagline || 'Tagline appears here.'}</p>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {actions.map(action => (
            <ShellActionButton key={action.label} action={action} interactive={interactive} lightMode={lightMode} color={primaryColor} className={actionClass} />
          ))}
        </div>
        <ShellSaveButton interactive={interactive} onSaveContact={onSaveContact} primaryColor={primaryColor} accentColor={accentColor} />
        {offer && (
          <div className={`mt-4 rounded-3xl border p-4 ${lightMode ? 'border-black/10' : 'border-white/10'}`} style={{ background: lightMode ? `${accentColor}10` : `${accentColor}18` }}>
            <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
              <BadgePercent className="h-4 w-4" style={{ color: primaryColor }} /> Offer
            </div>
            <p className="font-bold">{offer.title}</p>
            {offer.description && <p className={`mt-1 text-xs ${mutedClass}`}>{offer.description}</p>}
          </div>
        )}
        {links.slice(0, 3).map(link => (
          interactive ? (
            <a key={link.id} href={link.url} target="_blank" rel="noreferrer" onClick={link.onClick} className={`mt-2 flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-semibold ${linkClass}`}>
              <span className="inline-flex items-center gap-2">
                <LinkIcon className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                {link.label}
              </span>
              <ExternalLink className={`h-3.5 w-3.5 ${lightMode ? 'text-neutral-500' : 'text-neutral-500'}`} />
            </a>
          ) : (
            <div key={link.id} className={`mt-2 flex items-center justify-between rounded-2xl px-3 py-2 text-xs font-semibold ${linkClass}`}>
              <span className="inline-flex items-center gap-2">
                <LinkIcon className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                {link.label}
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-neutral-500" />
            </div>
          )
        ))}
      </div>
    </div>
  );
}

function ShellActionButton({ action, interactive, lightMode, color, className }: { action: SmartCardShellAction; interactive: boolean; lightMode: boolean; color: string; className: string }) {
  const Icon = action.icon;
  const disabled = action.disabled || !interactive || !action.href;
  const sharedClass = `flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl text-[9px] font-bold ${disabled ? `${lightMode ? 'opacity-60' : 'opacity-70'} ${className}` : className}`;

  if (disabled) {
    return (
      <div className={sharedClass}>
        <Icon className="h-4 w-4" style={{ color }} />
        {action.label}
      </div>
    );
  }

  return (
    <a href={action.href} target={action.href?.startsWith('http') ? '_blank' : undefined} rel="noreferrer" onClick={action.onClick} className={sharedClass}>
      <Icon className="h-4 w-4" style={{ color }} />
      {action.label}
    </a>
  );
}

function ShellSaveButton({ interactive, onSaveContact, primaryColor, accentColor }: { interactive: boolean; onSaveContact?: () => void; primaryColor: string; accentColor: string }) {
  const className = 'mt-3 rounded-full px-4 py-3 text-center text-sm font-black text-black';
  const style = { background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` };

  if (!interactive || !onSaveContact) {
    return <div className={className} style={style}>Save contact</div>;
  }

  return (
    <button type="button" onClick={onSaveContact} className={`${className} flex w-full items-center justify-center gap-2 transition-transform active:scale-95`} style={style}>
      <Download className="h-4 w-4" /> Save contact
    </button>
  );
}
