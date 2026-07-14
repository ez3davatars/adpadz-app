import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  CheckSquare,
  CreditCard,
  DollarSign,
  Image,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Megaphone,
  QrCode,
  Settings,
  TrendingUp,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { AdminProfile } from '../../lib/admin/adminTypes';
import AdpadzBrand from '../AdpadzBrand';

type AdminNavItem = {
  label: string;
  icon: LucideIcon;
  to?: string;
};

type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

const adminNavGroups: AdminNavGroup[] = [
  { label: 'Command Center', items: [{ label: 'Dashboard', icon: LayoutDashboard, to: '/admin/dashboard' }] },
  {
    label: 'CRM',
    items: [
      { label: 'Sales Pipeline', icon: TrendingUp },
      { label: 'Businesses', icon: Building2 },
      { label: 'Contacts', icon: UserRound },
      { label: 'Tasks', icon: CheckSquare },
    ],
  },
  {
    label: 'Campaign Operations',
    items: [
      { label: 'Campaigns', icon: Megaphone },
      { label: 'Community Mailers', icon: Mail },
      { label: 'Placements', icon: MapPin },
      { label: 'Creative Queue', icon: Image },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Payments', icon: CreditCard },
      { label: 'Campaign Economics', icon: DollarSign },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'Analytics', icon: BarChart3 },
      { label: 'QR Activity', icon: QrCode },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Team', icon: Users },
      { label: 'Settings', icon: Settings },
    ],
  },
];

type AdminSidebarProps = {
  profile: AdminProfile;
  email: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onSignOut: () => void;
  signingOut: boolean;
};

function formatRole(role: AdminProfile['role']): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function SidebarContent({
  profile,
  email,
  onNavigate,
  onSignOut,
  signingOut,
  closeButtonRef,
}: Omit<AdminSidebarProps, 'mobileOpen' | 'onMobileClose'> & {
  onNavigate?: () => void;
  closeButtonRef?: React.RefObject<HTMLButtonElement>;
}) {
  const initial = (profile.displayName || email || 'A').charAt(0).toUpperCase();

  return (
    <>
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <AdpadzBrand compact to="/admin/dashboard" ariaLabel="Mission Control dashboard" />
          {closeButtonRef ? (
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onNavigate}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-[var(--text-secondary)] transition hover:bg-white/[0.07] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon"
              aria-label="Close Mission Control navigation"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neon">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" /> Mission Control
        </div>
      </div>

      <nav aria-label="Mission Control" className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {adminNavGroups.map(group => (
          <section key={group.label} aria-labelledby={`admin-nav-${group.label.replace(/\s+/g, '-').toLowerCase()}`}>
            <h2 id={`admin-nav-${group.label.replace(/\s+/g, '-').toLowerCase()}`} className="mb-1.5 px-3 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {group.label}
            </h2>
            <div className="space-y-0.5">
              {group.items.map(item => item.to ? (
                <NavLink
                  key={item.label}
                  to={item.to}
                  onClick={onNavigate}
                  className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon ${isActive ? 'border border-neon/20 bg-neon/[0.09] text-neon' : 'border border-transparent text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-white'}`}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </NavLink>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  disabled
                  aria-disabled="true"
                  title={`${item.label} — coming next`}
                  className="flex min-h-11 w-full cursor-not-allowed items-center gap-3 rounded-xl border border-transparent px-3 text-left text-sm font-medium text-[var(--text-muted)] opacity-65"
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <span className="text-[8px] font-black uppercase tracking-[0.12em]">Next</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-neon/20 bg-neon/10 text-xs font-black text-neon">{initial}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white">{profile.displayName}</p>
            <p className="truncate text-[10px] text-[var(--text-muted)]">{email}</p>
            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-neon">{formatRole(profile.role)}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-red-400/[0.06] hover:text-red-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon disabled:cursor-wait disabled:opacity-60"
        >
          {signingOut ? <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" /> : <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />}
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </>
  );
}

export default function AdminSidebar(props: AdminSidebarProps) {
  const { mobileOpen, onMobileClose } = props;
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onMobileClose();
        return;
      }
      if (event.key !== 'Tab' || !drawerRef.current) return;

      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [mobileOpen, onMobileClose]);

  return (
    <>
      <aside className="mission-control-panel fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-y-0 border-l-0 lg:flex">
        <SidebarContent {...props} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button type="button" aria-label="Close Mission Control navigation" onClick={onMobileClose} className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <aside
            id="admin-mobile-navigation"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Mission Control navigation"
            className="mission-control-panel absolute inset-y-0 left-0 flex w-[min(88vw,20rem)] flex-col border-y-0 border-l-0 shadow-2xl safe-left"
          >
            <SidebarContent {...props} onNavigate={onMobileClose} closeButtonRef={closeButtonRef} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
