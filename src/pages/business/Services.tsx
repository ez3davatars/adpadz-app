import { useEffect, useMemo, useState } from 'react';
import { Clock3, Plus, Settings2, Wrench } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzMetricCard, AdpadzSection } from '../../components/adpadz-ui';

type ServiceRecord = {
  id: string;
  card_id: string;
  name: string;
  description: string | null;
  duration_minutes: number | null;
  is_active: boolean;
  sort_order: number;
};

type ServiceState = { services: ServiceRecord[]; loading: boolean; error: string | null };

export default function BizServices() {
  const [state, setState] = useState<ServiceState>({ services: [], loading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    async function loadServices() {
      setState(current => ({ ...current, loading: true, error: null }));
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw new Error(authError.message);
        const userId = authData.user?.id;
        if (!userId) throw new Error('Sign in to load services.');

        const { data, error } = await supabase
          .from('business_card_booking_services')
          .select('id,card_id,name,description,duration_minutes,is_active,sort_order')
          .eq('owner_id', userId)
          .order('sort_order', { ascending: true });
        if (error) throw new Error(error.message);

        if (!cancelled) setState({ services: (data ?? []) as ServiceRecord[], loading: false, error: null });
      } catch (error) {
        if (!cancelled) setState(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : 'Could not load services.' }));
      }
    }

    void loadServices();
    return () => { cancelled = true; };
  }, []);

  const activeCount = useMemo(() => state.services.filter(service => service.is_active).length, [state.services]);
  const averageDuration = useMemo(() => {
    const durations = state.services.map(service => service.duration_minutes).filter((value): value is number => typeof value === 'number' && value > 0);
    if (durations.length === 0) return 'Not set';
    return `${Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)} min`;
  }, [state.services]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Business Hub</p>
          <h1 className="text-2xl font-black">Services</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Foundation for business-owned services. Existing Smart Card booking services remain intact until a future migration moves ownership.</p>
        </div>
        <AdpadzButton type="button" variant="secondary" size="lg" disabled><Plus className="h-4 w-4" /> Service library coming soon</AdpadzButton>
      </div>

      {state.error && <AdpadzCard variant="flat" className="border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">{state.error}</AdpadzCard>}

      <div className="grid gap-3 sm:grid-cols-3">
        <AdpadzMetricCard icon={Wrench} label="Services" value={String(state.services.length)} detail="Current booking services from Smart Cards" />
        <AdpadzMetricCard icon={Settings2} label="Active" value={String(activeCount)} detail="Visible on published booking flows" />
        <AdpadzMetricCard icon={Clock3} label="Avg. Duration" value={averageDuration} detail="Duration metadata, when provided" />
      </div>

      <AdpadzSection eyebrow="Architecture" title="Business-owned service library" description="The Business Hub will own reusable services. Smart Cards, campaigns, booking requests, and future ads should reference these services instead of copying service details.">
        <div className="grid gap-3 lg:grid-cols-3">
          {['Business Hub owns service details', 'Smart Cards render selected services', 'Booking requests reference service IDs'].map(item => (
            <AdpadzCard key={item} as="article" variant="flat" className="p-4">
              <Wrench className="mb-3 h-5 w-5 text-neon" />
              <p className="text-sm font-black">{item}</p>
            </AdpadzCard>
          ))}
        </div>
      </AdpadzSection>

      <AdpadzSection eyebrow="Current Smart Card services" title="Existing booking services" description="Shown for visibility only. Editing remains in Smart Cards until the Business Hub service model is formally migrated.">
        <div className="space-y-3">
          {state.services.length > 0 ? state.services.map(service => (
            <AdpadzCard key={service.id} as="article" variant="flat" className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-black">{service.name}</h2>
                    <AdpadzBadge variant={service.is_active ? 'verified' : 'status'}>{service.is_active ? 'Active' : 'Inactive'}</AdpadzBadge>
                  </div>
                  {service.description && <p className="mt-2 text-sm text-[var(--text-secondary)]">{service.description}</p>}
                </div>
                <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]">
                  <Clock3 className="h-3.5 w-3.5 text-neon" /> {service.duration_minutes ? `${service.duration_minutes} min` : 'No duration'}
                </p>
              </div>
            </AdpadzCard>
          )) : <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-sm text-[var(--text-muted)]">{state.loading ? 'Loading services...' : 'No Smart Card booking services yet.'}</p>}
        </div>
      </AdpadzSection>
    </div>
  );
}
