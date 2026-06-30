import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Zap, Target, QrCode, Sparkles, BarChart3,
  Image, Users, Share2, Settings, LogOut, Menu, X, Wrench,
  MousePointerClick, Mail, CalendarDays, BadgePercent,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Session } from '@supabase/supabase-js';

type NavItem = {
  to?: string;
  icon: LucideIcon;
  label: string;
  disabled?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: 'Home',
    items: [
      { to: '/app/business/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { to: '/app/business/campaigns', icon: Target, label: 'Campaigns' },
      { to: '/app/business/create-ad', icon: Zap, label: 'Campaign Studio' },
      { icon: MousePointerClick, label: 'Interactive Ads', disabled: true },
      { icon: Mail, label: 'Community Mailers', disabled: true },
      { to: '/app/business/social', icon: Share2, label: 'Social' },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/app/business/smart-cards', icon: Sparkles, label: 'Business Profile' },
      { to: '/app/business/services', icon: Wrench, label: 'Services' },
      { icon: CalendarDays, label: 'Booking', disabled: true },
      { to: '/app/business/assets', icon: Image, label: 'Asset Library' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { to: '/app/business/leads', icon: Users, label: 'Leads' },
      { icon: CalendarDays, label: 'Bookings', disabled: true },
      { icon: BadgePercent, label: 'Offer Claims', disabled: true },
    ],
  },
  {
    label: 'Growth',
    items: [
      { to: '/app/business/qr-studio', icon: QrCode, label: 'QR Studio' },
      { to: '/app/business/analytics', icon: BarChart3, label: 'Analytics' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/app/business/settings', icon: Settings, label: 'Business Settings' },
    ],
  },
];

function SidebarItem({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  if (item.disabled || !item.to) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--text-muted)] opacity-60">
        <item.icon className="h-[18px] w-[18px]" />
        <span className="flex-1">{item.label}</span>
        <span className="text-[9px] font-black uppercase tracking-[0.16em]">Soon</span>
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-neon/10 text-neon'
            : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-hover)]'
        }`
      }
    >
      <item.icon className="w-[18px] h-[18px]" />
      {item.label}
    </NavLink>
  );
}

export default function BusinessLayout({ session }: { session: Session }) {
  const navigate = useNavigate();
  const [mobileNav, setMobileNav] = useState(false);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col fixed inset-y-0 left-0 z-40 border-r"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <div className="p-5 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-neon flex items-center justify-center">
            <span className="text-black font-black text-sm">A</span>
          </div>
          <span className="font-bold text-sm">adpadz<span className="text-neon">.co</span></span>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
          {navGroups.map(group => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => <SidebarItem key={`${group.label}-${item.label}`} item={item} />)}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-neon/20 flex items-center justify-center text-neon text-xs font-bold">
              {session.user.email?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{session.user.email}</p>
              <p className="text-[10px] text-[var(--text-muted)]">Business Owner</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/5 w-full transition-colors"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 border-b safe-top"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-neon flex items-center justify-center">
            <span className="text-black font-black text-xs">A</span>
          </div>
          <span className="font-bold text-sm">adpadz<span className="text-neon">.co</span></span>
        </div>
        <button onClick={() => setMobileNav(!mobileNav)} className="p-2 text-white">
          {mobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile nav overlay */}
      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} />
          <div className="absolute top-14 left-0 right-0 p-4 border-b"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
            <nav className="max-h-[70vh] space-y-4 overflow-y-auto">
              {navGroups.map(group => (
                <div key={group.label}>
                  <p className="mb-1.5 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map(item => (
                      <SidebarItem key={`${group.label}-${item.label}`} item={item} onClick={() => setMobileNav(false)} />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <button onClick={handleSignOut} className="mt-4 flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 w-full">
              <LogOut className="w-[18px] h-[18px]" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-60 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
