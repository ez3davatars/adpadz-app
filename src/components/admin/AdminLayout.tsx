import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { signOutAdmin } from '../../lib/admin/adminAuth';
import type { AdminOutletContext } from './AdminGuard';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';
import './MissionControl.css';

export default function AdminLayout() {
  const context = useOutletContext<AdminOutletContext>();
  const location = useLocation();
  const navigate = useNavigate();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');

  const email = context.session.user.email ?? 'Authenticated account';
  const outletContext = useMemo(() => context, [context]);

  useEffect(() => {
    setNavigationOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Mission Control | Adpadz';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const closeNavigation = useCallback(() => setNavigationOpen(false), []);

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError('');
    const result = await signOutAdmin();
    if (result.ok) {
      navigate('/admin/login', { replace: true });
      return;
    }
    setSignOutError(result.message);
    setSigningOut(false);
  }

  return (
    <div className="mission-control-shell">
      <a
        href="#mission-control-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-neon px-4 py-2 text-sm font-black text-black transition focus:translate-y-0"
      >
        Skip to content
      </a>

      <AdminSidebar
        profile={context.profile}
        email={email}
        mobileOpen={navigationOpen}
        onMobileClose={closeNavigation}
        onSignOut={() => void handleSignOut()}
        signingOut={signingOut}
      />

      <div className="min-w-0 lg:pl-72">
        <AdminTopbar
          profile={context.profile}
          navigationOpen={navigationOpen}
          onOpenNavigation={() => setNavigationOpen(true)}
        />

        {signOutError ? (
          <div role="alert" className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-400/[0.08] px-4 py-3 text-sm text-red-200 sm:mx-6 lg:mx-8">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{signOutError}</span>
          </div>
        ) : null}

        <main id="mission-control-content" tabIndex={-1} className="min-w-0 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-8">
          <Outlet context={outletContext} />
        </main>
      </div>
    </div>
  );
}
