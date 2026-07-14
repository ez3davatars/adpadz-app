import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { Navigate, Outlet } from 'react-router-dom';
import {
  decideAdminRoute,
  getAdminAccess,
  type AdminAccessState,
} from '../../lib/admin/adminAuth';
import type { AdminProfile } from '../../lib/admin/adminTypes';
import AdpadzBrand from '../AdpadzBrand';
import { AdpadzButton, AdpadzCard } from '../adpadz-ui';
import './MissionControl.css';

export type AdminOutletContext = {
  session: Session;
  profile: AdminProfile;
};

type AdminGuardProps = {
  session: Session | null;
};

type GuardState = AdminAccessState | { status: 'checking' };

export default function AdminGuard({ session }: AdminGuardProps) {
  const [access, setAccess] = useState<GuardState>({ status: 'checking' });

  const verifyAccess = useCallback(async () => {
    setAccess({ status: 'checking' });
    setAccess(await getAdminAccess());
  }, []);

  useEffect(() => {
    let active = true;
    setAccess({ status: 'checking' });
    void getAdminAccess().then(result => {
      if (active) setAccess(result);
    });
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  if (access.status === 'checking') {
    return (
      <main className="mission-control-shell flex min-h-screen items-center justify-center p-6">
        <div role="status" className="text-center text-[var(--text-secondary)]">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-neon" aria-hidden="true" />
          <p className="mt-3 text-sm font-bold">Verifying Mission Control access...</p>
        </div>
      </main>
    );
  }

  const decision = decideAdminRoute(access.status, 'protected');
  if (decision.action === 'redirect') {
    return <Navigate to={decision.to} replace />;
  }

  if (access.status === 'error') {
    return (
      <main className="mission-control-shell flex min-h-screen items-center justify-center p-6">
        <AdpadzCard variant="featured" className="w-full max-w-lg rounded-3xl p-6 text-center sm:p-8">
          <AdpadzBrand compact className="justify-center" />
          <div className="mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10 text-amber-300">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-neon">Mission Control</p>
          <h1 className="mt-2 text-2xl font-black text-white">Access check unavailable</h1>
          <p role="alert" className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">{access.message}</p>
          <AdpadzButton type="button" onClick={() => void verifyAccess()} className="mt-6">
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Retry verification
          </AdpadzButton>
        </AdpadzCard>
      </main>
    );
  }

  if (access.status !== 'authorized' || !session) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet context={{ session, profile: access.profile } satisfies AdminOutletContext} />;
}
