import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import CommunityCards from '../business/CommunityCards';
export default function CommunityCardAdmin() { return <main className="min-h-screen bg-[var(--bg-base)] p-5 text-white sm:p-8"><div className="mx-auto max-w-7xl"><header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-5"><div className="flex items-center gap-2 text-sm font-black text-neon"><ShieldCheck className="h-5 w-5" /> ADPADZ ADMIN PORTAL</div><Link className="text-sm font-bold text-[var(--text-muted)] hover:text-white" to="/app/business/community-ads">Customer workspace</Link></header><CommunityCards /></div></main>; }
