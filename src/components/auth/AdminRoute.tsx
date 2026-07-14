import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { getAdminAccess } from '../../lib/admin';

export default function AdminRoute({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  useEffect(() => { void getAdminAccess().then(allowed => setState(allowed ? 'allowed' : 'denied')); }, []);
  if (state === 'checking') return <main className="grid min-h-screen place-items-center bg-[var(--bg-base)] text-sm text-[var(--text-muted)]">Checking administrator access…</main>;
  if (state === 'denied') return <main className="grid min-h-screen place-items-center bg-[var(--bg-base)] p-6 text-center text-white"><section className="max-w-md rounded-3xl border border-red-400/25 bg-red-400/5 p-8"><ShieldAlert className="mx-auto h-10 w-10 text-red-300" /><h1 className="mt-4 text-xl font-black">Administrator access required</h1><p className="mt-2 text-sm text-[var(--text-muted)]">This workspace is reserved for authorized Adpadz operators. Customer accounts can manage their own community-card placements from their business workspace.</p><Link className="mt-5 inline-block font-black text-neon hover:underline" to="/app/business/community-ads">Go to My Community Ads</Link></section></main>;
  return <>{children}</>;
}
