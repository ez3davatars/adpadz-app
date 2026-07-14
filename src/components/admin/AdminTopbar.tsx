import { Menu, ShieldCheck } from 'lucide-react';
import type { AdminProfile } from '../../lib/admin/adminTypes';

type AdminTopbarProps = {
  profile: AdminProfile;
  navigationOpen: boolean;
  onOpenNavigation: () => void;
};

export default function AdminTopbar({ profile, navigationOpen, onOpenNavigation }: AdminTopbarProps) {
  return (
    <header className="mission-control-panel sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 border-x-0 border-t-0 px-4 safe-top sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenNavigation}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white transition hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon lg:hidden"
          aria-label="Open Mission Control navigation"
          aria-controls="admin-mobile-navigation"
          aria-expanded={navigationOpen}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-neon">Internal operations</p>
          <p className="truncate text-sm font-bold text-white">Mission Control</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-2">
        <ShieldCheck className="h-4 w-4 text-neon" aria-hidden="true" />
        <span className="hidden text-xs font-semibold text-[var(--text-secondary)] sm:inline">Verified session</span>
        <span className="h-1 w-1 rounded-full bg-[var(--text-muted)]" aria-hidden="true" />
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white">{profile.role}</span>
      </div>
    </header>
  );
}
