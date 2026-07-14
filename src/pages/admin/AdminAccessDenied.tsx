import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, Loader2, ShieldX } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import AdpadzBrand from '../../components/AdpadzBrand';
import { AdpadzButton, AdpadzCard } from '../../components/adpadz-ui';
import { decideAdminRoute, getAdminAccess, signOutAdmin, type AdminAccessState } from '../../lib/admin/adminAuth';
import '../../components/admin/MissionControl.css';

export default function AdminAccessDenied({ session }: { session: Session | null }) {
  const [access, setAccess] = useState<AdminAccessState | null>(null);
  useEffect(() => { let active = true; void getAdminAccess().then(result => { if (active) setAccess(result); }); return () => { active = false; }; }, [session?.user.id]);
  if (!access) return <main className="mission-control-shell flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-neon" aria-label="Checking access" /></main>;
  const decision = decideAdminRoute(access.status, 'access-denied');
  if (decision.action === 'redirect') return <Navigate to={decision.to} replace />;
  return <main className="mission-control-shell flex min-h-screen items-center justify-center p-6"><AdpadzCard variant="featured" className="w-full max-w-lg rounded-3xl p-6 text-center sm:p-8"><AdpadzBrand compact className="justify-center" /><div className="mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/25 bg-red-400/10 text-red-300"><ShieldX className="h-7 w-7" aria-hidden="true" /></div><h1 className="mt-5 text-2xl font-black text-white">Administrator access required</h1><p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">This signed-in account does not have an active Mission Control membership. Contact an Adpadz owner if you believe this is an error.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><AdpadzButton type="button" onClick={() => void signOutAdmin().then(() => window.location.assign('/admin/login'))}>Use another account</AdpadzButton><Link to="/" className="inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-bold text-[var(--text-secondary)]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to Adpadz</Link></div></AdpadzCard></main>;
}
