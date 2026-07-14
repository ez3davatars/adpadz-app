import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, CreditCard, Image, LayoutDashboard, Loader2, LogOut, Menu, QrCode, RefreshCcw,
  Settings, Share2, Sparkles, Target, Users, Wrench, X, Zap,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import AdpadzBrand from '../AdpadzBrand';

type NavItem = {
  to: string;
  icon: LucideIcon;
  label: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: 'Home',
    items: [{ to: '/app/business/dashboard', icon: LayoutDashboard, label: 'Dashboard' }],
  },
  {
    label: 'Marketing',
    items: [
      { to: '/app/business/campaigns', icon: Target, label: 'Campaigns' },
      { to: '/app/business/community-cards', icon: LayoutDashboard, label: 'Community Cards' },
      { to: '/app/business/create-ad', icon: Zap, label: 'Campaign Studio' },
      { to: '/app/business/social', icon: Share2, label: 'Publishing Workspace' },
      { to: '/app/business/qr-studio', icon: QrCode, label: 'QR Studio' },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: '/app/business/smart-cards', icon: Sparkles, label: 'Business Profile' },
      { to: '/app/business/services', icon: Wrench, label: 'Services' },
      { to: '/app/business/assets', icon: Image, label: 'Asset Library' },
    ],
  },
  {
    label: 'Customers',
    items: [
      { to: '/app/business/leads', icon: Users, label: 'Leads' },
      { to: '/app/business/analytics', icon: BarChart3, label: 'Analytics' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { to: '/app/business/settings', icon: Settings, label: 'Business Settings' },
      { to: '/app/business/billing', icon: CreditCard, label: 'Billing' },
    ],
  },
];

function SidebarItem({ item, onClick }: { item: NavItem; onClick?: () => void }) {
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
  const location = useLocation();
  const [mobileNav, setMobileNav] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(() => new URLSearchParams(window.location.search).get('recovery') === '1');
  const isDemoAccount = session.user.app_metadata?.is_demo === true;

  useEffect(() => {
    if (new URLSearchParams(location.search).get('recovery') === '1') setRecoveryOpen(true);
  }, [location.search]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryOpen(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    setAuthMessage(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/auth', { replace: true });
    } catch (signOutError) {
      if (import.meta.env.DEV) console.error('[BusinessLayout] sign out failed', signOutError);
      setAuthMessage({ type: 'error', text: 'We could not sign you out. Check your connection and try again.' });
    } finally {
      setSigningOut(false);
    }
  }

  async function handleDemoReset() {
    const confirmed = window.confirm('Reset the private demo workspace? This removes current demo changes and restores the fictional River City starting point. Resets have a 10-second cooldown.');
    if (!confirmed) return;
    setResettingDemo(true);
    setAuthMessage(null);
    try {
      const { error } = await supabase.rpc('reset_demo_workspace');
      if (error) throw error;
      window.location.assign('/app/business/dashboard');
    } catch (resetError) {
      if (import.meta.env.DEV) console.error('[BusinessLayout] demo reset failed', resetError);
      setAuthMessage({ type: 'error', text: 'The demo workspace could not be reset. Wait a moment and try again.' });
      setResettingDemo(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col fixed inset-y-0 left-0 z-40 border-r"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <div className="p-5">
          <AdpadzBrand compact />
        </div>

        <nav aria-label="Business workspace" className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
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
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-400/5 w-full transition-colors"
          >
            {signingOut ? <Loader2 className="w-[18px] h-[18px] animate-spin" aria-hidden="true" /> : <LogOut className="w-[18px] h-[18px]" aria-hidden="true" />}
            {signingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4 border-b safe-top"
        style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
        <AdpadzBrand compact />
        <button type="button" onClick={() => setMobileNav(!mobileNav)} aria-label={mobileNav ? 'Close navigation menu' : 'Open navigation menu'} aria-expanded={mobileNav} aria-controls="mobile-business-nav" className="p-2 text-white">
          {mobileNav ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile nav overlay */}
      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-40">
          <button type="button" aria-label="Close navigation menu" className="absolute inset-0 bg-black/60" onClick={() => setMobileNav(false)} />
          <div id="mobile-business-nav" className="absolute top-14 left-0 right-0 p-4 border-b"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
            <nav aria-label="Mobile business workspace" className="max-h-[70vh] space-y-4 overflow-y-auto">
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
            <button type="button" onClick={handleSignOut} disabled={signingOut} className="mt-4 flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 w-full">
              {signingOut ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <LogOut className="w-[18px] h-[18px]" />} {signingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-60 pt-14 lg:pt-0 min-h-screen">
        {isDemoAccount && (
          <div className="border-b border-neon/20 bg-neon/[0.065] px-4 py-3 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neon">Private demo account - fictional sample data</p>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Changes are safe to demonstrate and can be restored to the River City starting point. Resets have a 10-second cooldown.</p>
              </div>
              <div className="flex items-center gap-2">
                <Link to="/examples" className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 px-4 text-xs font-black text-white hover:bg-white/[0.06]">View showcase</Link>
                <button type="button" onClick={handleDemoReset} disabled={resettingDemo} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-neon px-4 text-xs font-black text-black disabled:opacity-55">
                  {resettingDemo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />} {resettingDemo ? 'Resetting...' : 'Reset demo'}
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="p-4 sm:p-6 lg:p-8">
          {authMessage && (
            <div role={authMessage.type === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${authMessage.type === 'error' ? 'border-red-400/30 bg-red-400/10 text-red-300' : 'border-neon/30 bg-neon/10 text-neon'}`}>
              {authMessage.text}
            </div>
          )}
          <Outlet />
        </div>
      </main>
      {recoveryOpen && (
        <PasswordRecoveryDialog
          email={session.user.email ?? ''}
          onCancel={() => { setRecoveryOpen(false); navigate(location.pathname, { replace: true }); }}
          onSuccess={() => {
            setRecoveryOpen(false);
            setAuthMessage({ type: 'success', text: 'Your password was updated successfully.' });
            navigate(location.pathname, { replace: true });
          }}
        />
      )}
    </div>
  );
}

function PasswordRecoveryDialog({ email, onCancel, onSuccess }: { email: string; onCancel: () => void; onSuccess: () => void }) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
      previousFocus?.focus();
    };
  }, [onCancel]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password !== confirmation) {
      setError('The passwords do not match. Please enter them again.');
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(/expired|session/i.test(updateError.message) ? 'This recovery link has expired. Request a new one from the sign-in page.' : 'We could not update your password. Please try again.');
        return;
      }
      onSuccess();
    } catch {
      setError('We could not update your password. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="recovery-title" aria-describedby="recovery-description" className="relative w-full max-w-md rounded-3xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-6 shadow-2xl">
        <button type="button" onClick={onCancel} aria-label="Close password reset" className="absolute right-4 top-4 rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-white"><X className="h-4 w-4" aria-hidden="true" /></button>
        <h2 id="recovery-title" className="pr-10 text-xl font-bold">Choose a new password</h2>
        <p id="recovery-description" className="mt-2 text-sm text-[var(--text-muted)]">Update the password for {email || 'your Adpadz account'}.</p>
        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4" aria-busy={saving}>
          <div>
            <label htmlFor="recovery-password" className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">New password</label>
            <input ref={inputRef} id="recovery-password" name="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={event => setPassword(event.target.value)} className="input-field" />
          </div>
          <div>
            <label htmlFor="recovery-confirmation" className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">Confirm new password</label>
            <input id="recovery-confirmation" name="confirm-password" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="input-field" />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-3 text-sm">{saving ? 'Updating...' : 'Update password'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
