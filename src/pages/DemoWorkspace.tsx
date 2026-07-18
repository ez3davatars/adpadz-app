import {
  type Dispatch,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  Eye,
  Flame,
  LayoutDashboard,
  Mail,
  MapPin,
  Menu,
  MousePointerClick,
  Phone,
  Plus,
  QrCode,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  UserRoundCheck,
  Users,
  Wand2,
  X,
  type LucideIcon,
} from 'lucide-react';
import AdpadzBrand from '../components/AdpadzBrand';
import {
  AdpadzBadge,
  AdpadzButton,
  AdpadzCard,
  AdpadzMetricCard,
  AdpadzSection,
} from '../components/adpadz-ui';
import CircularPadQR from '../components/qr/CircularPadQR';
import DemoBusinessSelector from '../components/demo/DemoBusinessSelector';
import DemoAuditPanel from '../components/demo/DemoAuditPanel';
import DemoCommunityMailerProduction from '../components/demo/DemoCommunityMailerProduction';
import {
  DEMO_CAMPAIGN_FORMATS,
  DEMO_CAMPAIGN_OUTPUTS,
  DEMO_CAMPAIGN_STATUSES,
  DEMO_LEAD_STATUSES,
  demoWorkspaceActions,
  demoWorkspaceReducer,
  loadDemoWorkspaceState,
  loadLastDemoBusinessSlug,
  saveDemoWorkspaceState,
  type DemoCampaign,
  type DemoCampaignFormat,
  type DemoCampaignOutput,
  type DemoCampaignStatus,
  type DemoLead,
  type DemoLeadStatus,
  type DemoWorkspaceAction,
  type DemoWorkspaceState,
} from '../lib/demoWorkspace';
import { DEMO_BUSINESS_PRESETS, getDemoBusinessPreset, type DemoBusinessPreset } from '../lib/demoPresets';
import { parseDemoRoute, type DemoView } from '../lib/demoRouting';

type DemoNavItem = {
  view: DemoView;
  label: string;
  icon: LucideIcon;
};

const navItems: DemoNavItem[] = [
  { view: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'campaigns', label: 'Campaigns', icon: Target },
  { view: 'qr', label: 'QR Studio', icon: QrCode },
  { view: 'customer', label: 'Customer View', icon: Sparkles },
  { view: 'leads', label: 'Leads', icon: Users },
  { view: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const tourSteps: Array<{ view: DemoView; eyebrow: string; title: string; description: string }> = [
  { view: 'overview', eyebrow: 'Business Hub', title: 'Start with the whole business at a glance.', description: 'Review the permanent business foundation, active campaign, connected outputs, and recent customer activity.' },
  { view: 'campaigns', eyebrow: 'Campaign Engine', title: 'Create once, prepare every output.', description: 'Build a sample campaign, choose its experience, and move it through the campaign lifecycle.' },
  { view: 'qr', eyebrow: 'Offline discovery', title: 'Move from a Pad QR to a measurable action.', description: 'Simulate a scan and watch it become attributed activity instead of an untracked visit.' },
  { view: 'customer', eyebrow: 'Customer Experience', title: 'Experience the promotion as a customer.', description: 'Reveal the offer and submit a fictional design request. Both actions update this demo session.' },
  { view: 'leads', eyebrow: 'Lead management', title: 'Turn interest into a next step.', description: 'Find the sample request, then move it through the same pipeline a local business would use.' },
  { view: 'analytics', eyebrow: 'Connected analytics', title: 'Close the loop with measurable results.', description: 'Views, scans, reveals, bookings, and leads stay connected to the campaign that created them.' },
];

const customerExperienceOutputs: readonly DemoCampaignOutput[] = ['smart_card', 'interactive_ad', 'qr_landing'];

function hasCustomerExperience(campaign: DemoCampaign): boolean {
  return campaign.outputs.some(output => customerExperienceOutputs.includes(output));
}

function isCustomerReady(campaign: DemoCampaign): boolean {
  return campaign.status === 'active' && hasCustomerExperience(campaign);
}

export default function DemoWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const route = parseDemoRoute(searchParams);
  const selectedBusinessSlug = route.businessSlug ?? loadLastDemoBusinessSlug();

  if (!selectedBusinessSlug) {
    return <DemoBusinessSelector onSelect={businessSlug => setSearchParams({ business: businessSlug, view: 'overview' })} />;
  }

  return <BusinessDemoWorkspace key={selectedBusinessSlug} businessSlug={selectedBusinessSlug} />;
}

function BusinessDemoWorkspace({ businessSlug }: { businessSlug: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [state, dispatch] = useReducer(demoWorkspaceReducer, businessSlug, slug => loadDemoWorkspaceState(undefined, slug));
  const preset = getDemoBusinessPreset(state.business.slug) ?? DEMO_BUSINESS_PRESETS[0];
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const requestedCampaignId = searchParams.get('campaign');
  const selectedCampaignId = requestedCampaignId && state.campaigns.some(campaign => campaign.id === requestedCampaignId)
    ? requestedCampaignId
    : state.campaigns.find(campaign => campaign.status === 'active')?.id ?? state.campaigns[0].id;
  const [tourStep, setTourStep] = useState<number | null>(() => {
    const requestedView = parseDemoRoute(searchParams).view;
    const index = tourSteps.findIndex(step => step.view === requestedView);
    return index >= 0 ? index : 0;
  });
  const [notice, setNotice] = useState('Welcome to the guided demo. Everything here is fictional sample data.');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const route = parseDemoRoute(searchParams);
  const view = route.view;

  useEffect(() => {
    saveDemoWorkspaceState(state);
  }, [state]);

  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = existing?.content;
    const previousTitle = document.title;
    const meta = existing ?? document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex,nofollow';
    document.title = `Adpadz Guided Demo | ${state.business.name}`;
    if (!existing) document.head.appendChild(meta);
    return () => {
      document.title = previousTitle;
      if (!existing) meta.remove();
      else existing.content = previous ?? '';
    };
  }, [state.business.name]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [view]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const previousOverflow = document.body.style.overflow;
    const menuButton = mobileMenuButtonRef.current;
    document.body.style.overflow = 'hidden';
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileNavOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.body.style.overflow = previousOverflow;
      menuButton?.focus();
    };
  }, [mobileNavOpen]);

  function goToView(nextView: DemoView, campaignId = selectedCampaignId) {
    if (tourStep !== null) {
      const matchingStep = tourSteps.findIndex(step => step.view === nextView);
      if (matchingStep >= 0) setTourStep(matchingStep);
    }
    const nextParams: Record<string, string> = { business: state.business.slug, view: nextView };
    if (campaignId) nextParams.campaign = campaignId;
    if (route.audit) nextParams.audit = '1';
    setSearchParams(nextParams);
    setMobileNavOpen(false);
  }

  function openCampaign(campaignId: string, nextView: 'customer' | 'qr') {
    goToView(nextView, campaignId);
    const campaign = state.campaigns.find(item => item.id === campaignId);
    setNotice(`${campaign?.title ?? 'Campaign'} selected for the ${nextView === 'qr' ? 'QR' : 'customer'} preview.`);
  }

  function moveTour(direction: 1 | -1) {
    const current = tourStep ?? 0;
    const next = Math.max(0, Math.min(tourSteps.length - 1, current + direction));
    setTourStep(next);
    goToView(tourSteps[next].view);
    setNotice(`Step ${next + 1} of ${tourSteps.length}: ${tourSteps[next].title}`);
  }

  function restartTour() {
    setTourStep(0);
    goToView(tourSteps[0].view);
    setNotice('The guided tour restarted at the Business Hub overview.');
  }

  function resetWorkspace() {
    dispatch(demoWorkspaceActions.reset());
    setTourStep(0);
    goToView('overview', state.campaigns.find(campaign => campaign.status === 'active')?.id ?? state.campaigns[0].id);
    setNotice('Demo restored to the original fictional sample workspace.');
  }

  function announce(message: string) {
    setNotice(message);
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-white">
      <a href="#demo-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-neon focus:px-4 focus:py-2 focus:text-sm focus:font-black focus:text-black">Skip to demo content</a>
      <DemoSidebar businessName={state.business.name} businessTagline={state.business.tagline} businessSlug={state.business.slug} onBusiness={slug => setSearchParams({ business: slug, view: "overview" })} view={view} mobileOpen={mobileNavOpen} onView={goToView} onRestartTour={restartTour} onClose={() => setMobileNavOpen(false)} />

      <div className="min-h-screen lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[color-mix(in_srgb,var(--bg-base)_92%,transparent)] backdrop-blur-xl safe-top">
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button ref={mobileMenuButtonRef} type="button" onClick={() => setMobileNavOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] lg:hidden" aria-label="Open demo navigation" aria-expanded={mobileNavOpen} aria-controls="demo-mobile-navigation"><Menu className="h-5 w-5" /></button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <AdpadzBadge variant="local"><ShieldCheck className="h-3 w-3" /> Demo mode</AdpadzBadge>
                <span className="truncate text-xs font-black">{state.business.name}</span>
              </div>
              <p className="mt-1 hidden text-[10px] text-[var(--text-secondary)] sm:block">Fictional sample data / progress is saved only in this browser</p>
            </div>
            <label className="hidden sm:block"><span className="sr-only">Choose a business to experience</span><select value={state.business.slug} onChange={event => setSearchParams({ business: event.target.value, view: 'overview' })} className="min-h-10 max-w-52 rounded-full border border-white/10 bg-[var(--bg-input)] px-3 text-xs font-black text-white">{DEMO_BUSINESS_PRESETS.map(item => <option key={item.slug} value={item.slug}>{item.business.name}</option>)}</select></label>
            <button type="button" onClick={restartTour} className="hidden items-center gap-2 rounded-full px-3 py-2 text-xs font-black text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-white sm:inline-flex"><HelpCircle className="h-4 w-4" /> Restart tour</button>
            <button type="button" onClick={resetWorkspace} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 text-xs font-black hover:border-neon/35 hover:text-neon" aria-label="Reset demo workspace"><RefreshCcw className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Reset demo</span></button>
            <Link to="/examples" className="hidden min-h-10 items-center gap-2 rounded-full border border-white/10 px-3 text-xs font-black text-[var(--text-secondary)] hover:text-white md:inline-flex">Exit <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </header>

        <div role="status" aria-live="polite" className="border-b border-neon/15 bg-neon/[0.055] px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)]">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-neon" />
            <span className="line-clamp-2 sm:truncate">{notice}</span>
          </div>
        </div>

        <main id="demo-content" className={`mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 ${tourStep !== null ? 'pb-36 lg:pb-32' : 'pb-10'}`}>
          {route.audit && <DemoAuditPanel state={state} view={view} />}
          {view === 'overview' && <OverviewView state={state} preset={preset} dispatch={dispatch} headingRef={headingRef} onView={goToView} announce={announce} />}
          {view === 'campaigns' && <DemoCommunityMailerProduction />}
          {view === 'campaigns' && <CampaignsView state={state} dispatch={dispatch} headingRef={headingRef} announce={announce} onOpenCampaign={openCampaign} />}
          {view === 'customer' && <CustomerView state={state} preset={preset} campaignId={selectedCampaignId} dispatch={dispatch} headingRef={headingRef} announce={announce} />}
          {view === 'qr' && <QrView state={state} preset={preset} campaignId={selectedCampaignId} dispatch={dispatch} headingRef={headingRef} announce={announce} />}
          {view === 'leads' && <LeadsView state={state} dispatch={dispatch} headingRef={headingRef} announce={announce} />}
          {view === 'analytics' && <AnalyticsView state={state} headingRef={headingRef} />}
        </main>
      </div>

      {tourStep !== null && (
        <TourRail
          step={tourStep}
          onBack={() => moveTour(-1)}
          onNext={() => moveTour(1)}
          onClose={() => { setTourStep(null); setNotice('Guided tour closed. Explore the demo freely from the navigation.'); }}
        />
      )}
    </div>
  );
}

function DemoSidebar({ businessName, businessTagline, businessSlug, onBusiness, view, mobileOpen, onView, onRestartTour, onClose }: { businessName: string; businessTagline: string; businessSlug: string; onBusiness: (slug: string) => void; view: DemoView; mobileOpen: boolean; onView: (view: DemoView) => void; onRestartTour: () => void; onClose: () => void }) {
  function trapDialogFocus(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab') return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(element => element.getClientRects().length > 0);
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

  const content = (
    <>
      <div className="flex h-16 items-center justify-between px-5">
        <AdpadzBrand compact />
        <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-white/[0.07] lg:hidden" aria-label="Close demo navigation" autoFocus={mobileOpen}><X className="h-5 w-5" /></button>
      </div>
      <div className="px-4 pb-3">
        <div className="rounded-2xl border border-neon/20 bg-neon/[0.065] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">Fictional workspace</p>
          <p className="mt-1 text-xs font-black">{businessName}</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">{businessTagline}</p><label className="mt-3 block text-[9px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">Choose a business to experience<select value={businessSlug} onChange={event => onBusiness(event.target.value)} className="mt-2 min-h-10 w-full rounded-xl border border-white/10 bg-[var(--bg-input)] px-2 text-[10px] font-bold normal-case tracking-normal text-white">{DEMO_BUSINESS_PRESETS.map(item => <option key={item.slug} value={item.slug}>{item.business.name}</option>)}</select></label>
        </div>
      </div>
      <nav aria-label="Demo workspace" className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-secondary)]">Guided workspace</p>
        {navItems.map(item => (
          <button key={item.view} type="button" onClick={() => onView(item.view)} aria-current={view === item.view ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition ${view === item.view ? 'bg-neon/10 text-neon' : 'text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-white'}`}>
            <item.icon className="h-[18px] w-[18px]" />{item.label}
          </button>
        ))}
      </nav>
      <div className="border-t border-white/[0.07] p-3">
        <button type="button" onClick={onRestartTour} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-white"><HelpCircle className="h-[18px] w-[18px]" /> Restart guided tour</button>
        <Link to="/examples" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-white"><ArrowLeft className="h-[18px] w-[18px]" /> Back to showcase</Link>
      </div>
    </>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-white/[0.07] bg-[var(--bg-surface)] lg:flex">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button type="button" tabIndex={-1} className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} aria-label="Close demo navigation backdrop" />
          <aside id="demo-mobile-navigation" role="dialog" aria-modal="true" aria-label="Demo navigation" onKeyDown={trapDialogFocus} className="relative flex h-full w-[min(19rem,86vw)] flex-col border-r border-white/10 bg-[var(--bg-surface)] shadow-2xl">{content}</aside>
        </div>
      )}
    </>
  );
}

function TourRail({ step, onBack, onNext, onClose }: { step: number; onBack: () => void; onNext: () => void; onClose: () => void }) {
  const current = tourSteps[step];
  const isLast = step === tourSteps.length - 1;
  return (
    <section aria-label="Guided demo progress" className="fixed inset-x-3 bottom-3 z-50 rounded-[1.6rem] border border-neon/30 bg-neutral-950/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.72)] backdrop-blur-xl safe-bottom lg:left-[17rem] lg:right-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1" aria-live="polite">
          <div className="flex items-center gap-2">
            <span aria-current="step" className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">Step {step + 1} of {tourSteps.length}</span>
            <span className="h-1 w-1 rounded-full bg-white/25" />
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--text-secondary)]">{current.eyebrow}</span>
          </div>
          <h2 className="mt-1 truncate text-sm font-black">{current.title}</h2>
          <p className="mt-1 hidden truncate text-[10px] text-[var(--text-secondary)] md:block">{current.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} className="mr-auto rounded-full px-3 py-2 text-[10px] font-black text-[var(--text-secondary)] hover:text-white sm:mr-0">Explore freely</button>
          <button type="button" onClick={onBack} disabled={step === 0} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 disabled:opacity-35" aria-label="Previous demo step"><ChevronLeft className="h-4 w-4" /></button>
          <AdpadzButton type="button" onClick={isLast ? onClose : onNext} size="sm">{isLast ? 'Finish tour' : 'Next'} {!isLast && <ChevronRight className="h-4 w-4" />}</AdpadzButton>
        </div>
      </div>
    </section>
  );
}

function PageHeading({ headingRef, eyebrow, title, description, action }: { headingRef: React.RefObject<HTMLHeadingElement>; eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neon">{eyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-2xl font-black outline-none sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
      </div>
      {action}
    </div>
  );
}

function OverviewView({ state, preset, dispatch, headingRef, onView, announce }: { state: DemoWorkspaceState; preset: DemoBusinessPreset; dispatch: Dispatch<DemoWorkspaceAction>; headingRef: React.RefObject<HTMLHeadingElement>; onView: (view: DemoView) => void; announce: (message: string) => void }) {
  const activeCampaign = state.campaigns.find(campaign => campaign.status === 'active') ?? state.campaigns[0];
  const [editingProfile, setEditingProfile] = useState(false);
  const [tagline, setTagline] = useState(state.business.tagline);
  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch(demoWorkspaceActions.updateBusiness({ tagline }));
    setEditingProfile(false);
    announce('The fictional Business Profile story was updated across this business experience.');
  }
  return (
    <>
      <PageHeading headingRef={headingRef} eyebrow="Business Hub overview" title={`${state.business.name} workspace`} description="This is the command center: permanent business information, campaigns, customer activity, and the clearest next action in one view." action={<AdpadzButton type="button" onClick={() => onView('campaigns')} size="sm"><Plus className="h-4 w-4" /> Create campaign</AdpadzButton>} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4"><div><p className="text-xs font-black">Business Profile story</p><p className="mt-1 text-xs text-[var(--text-secondary)]">Update the permanent message and see it flow into the customer experience.</p></div><AdpadzButton type="button" variant="secondary" size="sm" onClick={() => setEditingProfile(value => !value)}>{editingProfile ? 'Close editor' : 'Edit profile story'}</AdpadzButton>{editingProfile && <form onSubmit={saveProfile} className="grid w-full gap-3 border-t border-white/[0.08] pt-4 sm:grid-cols-[1fr_auto]"><label className="text-xs font-black">Tagline<input value={tagline} onChange={event => setTagline(event.target.value)} required className="input-field mt-2 text-sm" /></label><AdpadzButton type="submit" className="self-end">Save profile story</AdpadzButton></form>}</div>

      <AdpadzCard variant="glass" className="mb-6 border-white/[0.08] p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-3">
          <div><p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: preset.accent }}>The challenge</p><p className="mt-2 text-sm leading-relaxed text-neutral-300">{preset.challenge}</p></div>
          <div><p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: preset.accent }}>The Adpadz journey</p><p className="mt-2 text-sm leading-relaxed text-neutral-300">{preset.journey}</p></div>
          <div><p className="text-[9px] font-black uppercase tracking-[0.18em]" style={{ color: preset.accent }}>What becomes measurable</p><p className="mt-2 text-sm leading-relaxed text-neutral-300">{preset.outcome}</p></div>
        </div>
      </AdpadzCard>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <AdpadzMetricCard icon={Eye} label="Profile views" value={formatNumber(state.metrics.profileViews)} detail="Sample Business Profile discovery" trend="18%" />
        <AdpadzMetricCard icon={MousePointerClick} label="Campaign views" value={formatNumber(state.metrics.campaignViews)} detail="Across interactive experiences" trend="12%" />
        <AdpadzMetricCard icon={QrCode} label="QR scans" value={formatNumber(state.metrics.qrScans)} detail="Attributed offline visits" trend="24%" />
        <AdpadzMetricCard icon={Users} label="Leads" value={formatNumber(state.metrics.leads)} detail="Sample requests and inquiries" />
        <AdpadzMetricCard icon={CalendarCheck} label="Bookings" value={formatNumber(state.metrics.bookings)} detail="Sample design visits requested" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <AdpadzCard variant="featured" className="p-0">
          <div className="relative overflow-hidden">
            <img src={preset.heroImage} alt={`Fictional ${state.business.name} campaign visual`} className="h-60 w-full object-cover sm:h-72" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <div className="flex flex-wrap items-center gap-2"><AdpadzBadge variant="campaign">Featured campaign</AdpadzBadge><AdpadzBadge variant="status" className="capitalize">{activeCampaign.status}</AdpadzBadge></div>
              <h2 className="mt-3 text-2xl font-black">{activeCampaign.headline}</h2>
              <p className="mt-2 max-w-2xl text-sm text-neutral-300">{activeCampaign.offer.title}</p>
            </div>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex flex-wrap gap-2">
              {activeCampaign.outputs.slice(0, 5).map(output => <span key={output} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)]">{formatOutput(output)}</span>)}
            </div>
            <AdpadzButton type="button" variant="secondary" size="sm" onClick={() => onView('customer')}>Experience it <ArrowRight className="h-3.5 w-3.5" /></AdpadzButton>
          </div>
        </AdpadzCard>

        <AdpadzCard variant="flat" className="p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">Recent activity</p><h2 className="mt-1 text-lg font-black">Customer journey</h2></div><Activity className="h-5 w-5 text-neon" /></div>
          <div className="mt-5 space-y-4">
            {state.activity.slice(0, 5).map(item => (
              <div key={item.id} className="flex gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-neon shadow-[var(--glow-sm)]" />
                <div><p className="text-xs font-black">{item.title}</p><p className="mt-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">{item.detail}</p></div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onView('analytics')} className="mt-5 inline-flex items-center gap-2 text-xs font-black text-neon">Open analytics <ArrowRight className="h-3.5 w-3.5" /></button>
        </AdpadzCard>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <AdpadzCard variant="flat" className="p-5">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">Business foundation</p><h2 className="mt-1 text-lg font-black">{state.business.name}</h2><p className="mt-1 text-xs text-[var(--text-secondary)]">{state.business.tagline}</p></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neon text-lg font-black text-black">{state.business.name.charAt(0)}</span></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <InfoRow icon={MapPin} label="Service area" value={state.business.location} />
            <InfoRow icon={Phone} label="Public phone" value={state.business.phone} />
            <InfoRow icon={Mail} label="Public email" value={state.business.email} />
            <InfoRow icon={ShieldCheck} label="Profile" value="Published & connected" />
          </div>
        </AdpadzCard>
        <AdpadzCard variant="flat" className="p-5">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">Ready everywhere</p>
          <h2 className="mt-1 text-lg font-black">One source, six customer touchpoints</h2>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {['Business Profile', 'Interactive ad', 'Pad QR', 'Community mailer', 'Social & email', 'Lead capture'].map((label, index) => <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3"><span className="text-[9px] font-black text-neon">0{index + 1}</span><p className="mt-3 text-[10px] font-black">{label}</p><p className="mt-1 text-[10px] text-[var(--text-secondary)]">Connected</p></div>)}
          </div>
        </AdpadzCard>
      </div>
    </>
  );
}

function CampaignsView({ state, dispatch, headingRef, announce, onOpenCampaign }: { state: DemoWorkspaceState; dispatch: Dispatch<DemoWorkspaceAction>; headingRef: React.RefObject<HTMLHeadingElement>; announce: (message: string) => void; onOpenCampaign: (campaignId: string, view: 'customer' | 'qr') => void }) {
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeading headingRef={headingRef} eyebrow="Campaign Engine" title="Campaigns" description="One campaign controls the offer, message, schedule, customer action, and every channel-ready output." action={<AdpadzButton type="button" onClick={() => setCreating(value => !value)} size="sm">{creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{creating ? 'Close studio' : 'Create sample campaign'}</AdpadzButton>} />
      {creating && <CampaignCreateForm businessName={state.business.name} dispatch={dispatch} onCreated={() => { setCreating(false); announce('Sample campaign created and saved in this browser session.'); }} />}
      <div className="mt-5 space-y-4">
        {state.campaigns.map(campaign => <CampaignRow key={campaign.id} campaign={campaign} dispatch={dispatch} announce={announce} onOpenCampaign={onOpenCampaign} />)}
      </div>
    </>
  );
}

function CampaignCreateForm({ businessName, dispatch, onCreated }: { businessName: string; dispatch: Dispatch<DemoWorkspaceAction>; onCreated: () => void }) {
  const [title, setTitle] = useState('Neighborhood Backyard Weekend');
  const [offer, setOffer] = useState('Complimentary outdoor-living design sketch');
  const [format, setFormat] = useState<DemoCampaignFormat>('tap_reveal');
  const [outputs, setOutputs] = useState<DemoCampaignOutput[]>(['smart_card', 'interactive_ad', 'qr_landing', 'email']);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch(demoWorkspaceActions.createCampaign({
      title,
      headline: title,
      description: 'A new sample promotion created inside the resettable Adpadz demo workspace.',
      offerTitle: offer,
      offerDescription: 'Sample offer for product demonstration only.',
      ctaLabel: 'Request a design visit',
      status: 'draft',
      format,
      outputs,
    }));
    onCreated();
  }

  function toggleOutput(output: DemoCampaignOutput) {
    setOutputs(current => current.includes(output) ? current.filter(item => item !== output) : [...current, output]);
  }

  return (
    <AdpadzCard variant="featured" className="mb-6 border-neon/30 bg-neon/[0.045] p-5 sm:p-6">
      <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neon text-black"><Wand2 className="h-5 w-5" /></span><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">Campaign Studio</p><h2 className="text-lg font-black">Create a working sample</h2></div></div>
      <form onSubmit={submit} className="mt-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-xs font-black">Campaign title<input required value={title} onChange={event => setTitle(event.target.value)} maxLength={80} className="input-field mt-2 text-sm font-medium" /></label>
          <label className="text-xs font-black">Offer<input required value={offer} onChange={event => setOffer(event.target.value)} maxLength={120} className="input-field mt-2 text-sm font-medium" /></label>
        </div>
        <fieldset><legend className="text-xs font-black">Interactive experience</legend><div className="mt-3 flex flex-wrap gap-2">{DEMO_CAMPAIGN_FORMATS.map(item => <button key={item} type="button" onClick={() => setFormat(item)} aria-pressed={format === item} className={`rounded-full border px-4 py-2 text-xs font-black ${format === item ? 'border-neon bg-neon text-black' : 'border-white/10 bg-white/[0.04] text-[var(--text-secondary)]'}`}>{formatOutput(item)}</button>)}</div></fieldset>
        <fieldset><legend className="text-xs font-black">Connected outputs</legend><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{DEMO_CAMPAIGN_OUTPUTS.map(output => <label key={output} className={`flex cursor-pointer items-center gap-2 rounded-2xl border p-3 text-[10px] font-black ${outputs.includes(output) ? 'border-neon/40 bg-neon/[0.07] text-white' : 'border-white/[0.07] text-[var(--text-secondary)]'}`}><input type="checkbox" checked={outputs.includes(output)} onChange={() => toggleOutput(output)} className="accent-[var(--color-neon)]" />{formatOutput(output)}</label>)}</div></fieldset>
        <div>
          <p className="text-xs font-black">Campaign package preview</p>
          <p className="mt-1 text-[10px] text-[var(--text-secondary)]">One source becomes channel-ready copy without claiming it was externally published.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-3xl border border-white/[0.08] bg-black/25 p-4"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-neon">Social caption</p><p className="mt-3 text-xs font-black">{title}</p><p className="mt-2 text-[10px] leading-relaxed text-[var(--text-secondary)]">{offer}. Discover the next step with {businessName}.</p></div>
            <div className="rounded-3xl border border-white/[0.08] bg-black/25 p-4"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-neon">Email subject</p><p className="mt-3 text-xs font-black">{offer} | Local campaign preview</p><p className="mt-2 text-[10px] leading-relaxed text-[var(--text-secondary)]">Prepared from the same campaign message and action.</p></div>
            <div className="rounded-3xl border border-white/[0.08] bg-black/25 p-4"><p className="text-[9px] font-black uppercase tracking-[0.14em] text-neon">Flyer headline</p><p className="mt-3 text-xs font-black">{title}</p><p className="mt-2 text-[10px] leading-relaxed text-[var(--text-secondary)]">Scan to reveal: {offer}</p></div>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end"><p className="mr-auto self-center text-[10px] text-[var(--text-secondary)]">Demo only - nothing is published externally.</p><AdpadzButton type="submit" disabled={!title.trim() || !offer.trim() || outputs.length === 0}>Save sample campaign <ArrowRight className="h-4 w-4" /></AdpadzButton></div>
      </form>
    </AdpadzCard>
  );
}

function CampaignRow({ campaign, dispatch, announce, onOpenCampaign }: { campaign: DemoCampaign; dispatch: Dispatch<DemoWorkspaceAction>; announce: (message: string) => void; onOpenCampaign: (campaignId: string, view: 'customer' | 'qr') => void }) {
  const canPreview = hasCustomerExperience(campaign);
  const customerReady = isCustomerReady(campaign);
  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState(campaign.headline);
  const [offerTitle, setOfferTitle] = useState(campaign.offer.title);
  function updateStatus(status: DemoCampaignStatus) {
    dispatch(demoWorkspaceActions.setCampaignStatus(campaign.id, status));
    announce(`${campaign.title} moved to ${formatOutput(status)} in this demo.`);
  }
  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch(demoWorkspaceActions.updateCampaign(campaign.id, { headline, offerTitle }));
    setEditing(false);
    announce(`${campaign.title} was updated across its shared sample outputs.`);
  }
  return (
    <AdpadzCard as="article" variant="flat" className="p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><AdpadzBadge variant={customerReady ? 'local' : 'status'} className="capitalize">{campaign.status}</AdpadzBadge><span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">{formatOutput(campaign.format)}</span></div>
          <h2 className="mt-3 text-lg font-black">{campaign.headline}</h2>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">{campaign.offer.title}</p>
          <div className="mt-4 flex flex-wrap gap-2">{campaign.outputs.map(output => <span key={output} className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-[var(--text-secondary)]">{formatOutput(output)}</span>)}</div>
        </div>
        <div className="grid grid-cols-4 gap-3 text-center lg:w-80">
          <SmallStat value={campaign.metrics.views} label="Views" />
          <SmallStat value={campaign.metrics.qrScans} label="Scans" />
          <SmallStat value={campaign.metrics.offerReveals} label="Reveals" />
          <SmallStat value={campaign.metrics.leads} label="Leads" />
        </div>
        <div className="flex flex-wrap gap-2 lg:w-48 lg:flex-col">
          <button type="button" onClick={() => setEditing(value => !value)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full border border-white/10 px-3 text-[10px] font-black hover:border-neon/35 hover:text-neon"><Wand2 className="h-3.5 w-3.5" /> Edit story</button>
          <button type="button" onClick={() => onOpenCampaign(campaign.id, 'customer')} disabled={!canPreview} title={canPreview ? 'Open the customer experience preview' : 'Add a customer-facing output to preview'} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full border border-white/10 px-3 text-[10px] font-black hover:border-neon/35 hover:text-neon disabled:cursor-not-allowed disabled:opacity-35"><Eye className="h-3.5 w-3.5" /> Preview</button>
          <button type="button" onClick={() => onOpenCampaign(campaign.id, 'qr')} disabled={!campaign.outputs.includes('qr_landing')} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full border border-white/10 px-3 text-[10px] font-black hover:border-neon/35 hover:text-neon disabled:cursor-not-allowed disabled:opacity-35"><QrCode className="h-3.5 w-3.5" /> Use in QR</button>
          <label className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">Status<select value={campaign.status} onChange={event => updateStatus(event.target.value as DemoCampaignStatus)} className="mt-2 block min-h-10 w-full rounded-xl border border-white/10 bg-[var(--bg-input)] px-3 text-xs font-bold text-white outline-none focus:border-neon">{DEMO_CAMPAIGN_STATUSES.map(status => <option key={status} value={status}>{formatOutput(status)}</option>)}</select></label>
        </div>
      </div>
      {editing && <form onSubmit={saveEdit} className="mt-5 grid gap-3 border-t border-white/[0.08] pt-5 sm:grid-cols-2"><label className="text-xs font-black">Campaign headline<input value={headline} onChange={event => setHeadline(event.target.value)} required className="input-field mt-2 text-sm" /></label><label className="text-xs font-black">Offer title<input value={offerTitle} onChange={event => setOfferTitle(event.target.value)} required className="input-field mt-2 text-sm" /></label><div className="flex gap-2 sm:col-span-2 sm:justify-end"><AdpadzButton type="button" variant="ghost" onClick={() => setEditing(false)}>Cancel</AdpadzButton><AdpadzButton type="submit">Save campaign story</AdpadzButton></div></form>}
    </AdpadzCard>
  );
}
function CustomerView({ state, preset, campaignId, dispatch, headingRef, announce }: { state: DemoWorkspaceState; preset: DemoBusinessPreset; campaignId: string; dispatch: Dispatch<DemoWorkspaceAction>; headingRef: React.RefObject<HTMLHeadingElement>; announce: (message: string) => void }) {
  const campaign = state.campaigns.find(item => item.id === campaignId) ?? state.campaigns[0];
  const supportsCustomerExperience = hasCustomerExperience(campaign);
  const customerReady = isCustomerReady(campaign);
  const revealKey = `${campaign.id}:${campaign.offer.id}`;
  const revealed = state.revealedOfferIds.includes(revealKey);
  const claimed = state.claimedOfferIds.includes(revealKey);
  const profileViewRecorded = useRef(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    setRequestSent(false);
  }, [campaign.id]);

  useEffect(() => {
    if (profileViewRecorded.current) return;
    profileViewRecorded.current = true;
    dispatch(demoWorkspaceActions.recordProfileView());
  }, [dispatch]);

  function reveal() {
    if (!customerReady) {
      announce('Owner preview only. Activate this campaign with a customer-facing output to record offer engagement.');
      return;
    }
    dispatch(demoWorkspaceActions.revealOffer(campaign.id, campaign.offer.id));
    announce(revealed ? 'This sample offer is already revealed.' : 'Offer revealed - analytics updated for this demo session.');
  }

  function claim() {
    if (!revealed || claimed) return;
    dispatch(demoWorkspaceActions.claimOffer(campaign.id, campaign.offer.id));
    announce('Sample offer claim recorded. Offer Claims and Analytics now reflect the action.');
  }

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customerReady) {
      announce('Owner preview only. Activate this campaign before recording a sample customer request.');
      return;
    }
    const formData = new FormData(event.currentTarget);
    dispatch(demoWorkspaceActions.submitSampleLead({
      name: String(formData.get('name') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim() || null,
      phone: null,
      message: String(formData.get('message') ?? '').trim(),
      campaignId: campaign.id,
      source: 'booking_request',
    }));
    setRequestSent(true);
    announce('Sample design request captured. It is now visible in Leads and Analytics.');
  }

  return (
    <>
      <PageHeading headingRef={headingRef} eyebrow="Customer experience" title="See what your customer sees" description="This responsive Business Profile combines permanent trust-building content with the selected campaign offer and a direct conversion path." />
      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <AdpadzCard variant="flat" className="h-fit p-5 xl:sticky xl:top-28">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">What to demonstrate</p>
          <ol className="mt-4 space-y-4">
            {[
              ['01', 'Permanent trust', 'Brand, services, proof, and contact actions come from the Business Hub.'],
              ['02', 'Campaign-controlled offer', 'The temporary promotion stays connected to its dates and call to action.'],
              ['03', 'Measurable action', 'The reveal and sample request immediately update this session.'],
            ].map(item => <li key={item[0]} className="flex gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neon/10 text-[10px] font-black text-neon">{item[0]}</span><div><p className="text-xs font-black">{item[1]}</p><p className="mt-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">{item[2]}</p></div></li>)}
          </ol>
          <div className="mt-5 rounded-2xl border border-neon/20 bg-neon/[0.055] p-4 text-[10px] leading-relaxed text-[var(--text-secondary)]"><strong className="text-neon">Demo safety:</strong> phone, email, maps, and booking actions remain inside this fictional sandbox.</div>
        </AdpadzCard>

        <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-neutral-950 shadow-[0_34px_100px_rgba(0,0,0,0.58)]">
          <div className="relative h-72 overflow-hidden sm:h-80">
            <img src={preset.heroImage} alt={`Fictional ${state.business.name} customer experience`} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <AdpadzBadge variant="local">Fictional sample business</AdpadzBadge>
              <h2 className="mt-4 text-3xl font-black sm:text-4xl">{state.business.name}</h2>
              <p className="mt-2 text-sm text-neutral-200">{state.business.tagline}</p>
            </div>
          </div>

          <div className="space-y-8 p-5 sm:p-8">
            <div className="grid grid-cols-3 gap-2">
              <CustomerAction icon={Phone} label="Call" onClick={() => announce('Calls are safely disabled in this fictional demo. No real phone action was opened.')} />
              <CustomerAction icon={MapPin} label="Directions" onClick={() => announce('Directions are safely disabled in this fictional demo. No external map was opened.')} />
              <CustomerAction icon={CalendarCheck} label="Request visit" onClick={() => document.getElementById('demo-request-form')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })} />
            </div>

            <section>
              <div className="flex flex-wrap items-center gap-2"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">Selected campaign</p><AdpadzBadge variant={customerReady ? 'local' : 'status'} className="capitalize">{customerReady ? 'Customer-ready' : supportsCustomerExperience ? `Owner preview - ${campaign.status}` : 'Owner preview - no customer output'}</AdpadzBadge></div>
              <div className="mt-3 overflow-hidden rounded-[2rem] border border-neon/25 bg-neon/[0.055]">
                <div className="p-5 sm:p-6">
                  <p className="text-xs font-black text-neon">{campaign.headline}</p>
                  <h3 className="mt-2 text-2xl font-black">{campaign.offer.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">{campaign.offer.description}</p>
                  <button type="button" onClick={reveal} disabled={!customerReady} className={`mt-5 flex min-h-28 w-full items-center justify-center rounded-3xl border border-dashed text-center transition disabled:cursor-not-allowed ${!customerReady ? 'border-white/15 bg-black/20 text-[var(--text-secondary)]' : revealed ? 'border-neon bg-neon text-black' : 'border-neon/40 bg-black/30 text-neon hover:bg-neon/[0.08]'}`}>
                    {!customerReady ? <span><Eye className="mx-auto h-6 w-6" /><strong className="mt-2 block text-sm">Owner preview only</strong><span className="mt-1 block text-[10px]">{supportsCustomerExperience ? `Activate this ${campaign.status} campaign to test customer actions` : 'Add a customer-facing output to test this experience'}</span></span> : revealed ? <span><Check className="mx-auto h-6 w-6" /><strong className="mt-2 block text-lg">Offer unlocked</strong><span className="mt-1 block text-[10px] font-bold">{campaign.offer.title} is ready for this sample request</span></span> : <span><Sparkles className="mx-auto h-6 w-6" /><strong className="mt-2 block text-sm">Tap to reveal the customer offer</strong><span className="mt-1 block text-[10px] text-[var(--text-secondary)]">This action updates demo analytics</span></span>}
                  </button>{revealed && <AdpadzButton type="button" onClick={claim} disabled={claimed} fullWidth className="mt-3">{claimed ? "Offer claimed" : "Claim this sample offer"}</AdpadzButton>}
                </div>
              </div>
            </section>

            <section>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">Services</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{preset.services.map(service => <div key={service.name} className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-4"><Briefcase className="h-4 w-4 text-neon" /><h3 className="mt-3 text-sm font-black">{service.name}</h3><p className="mt-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">{service.detail}</p><p className="mt-3 text-[9px] font-black uppercase tracking-[0.12em] text-neon">{service.duration}</p></div>)}</div>
            </section>

            <section>
              <div className="flex items-end justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">Project transformation</p><h3 className="mt-1 text-xl font-black">Before & after</h3></div><AdpadzBadge variant="status">Sample imagery</AdpadzBadge></div>
              <div className="mt-4 grid grid-cols-2 gap-2 overflow-hidden rounded-3xl"><figure className="relative"><img src={preset.beforeImage} alt={`Fictional ${preset.industry} before view`} className="aspect-[4/3] h-full w-full object-cover" /><figcaption className="absolute bottom-2 left-2 rounded-full bg-black/70 px-3 py-1 text-[9px] font-black">Before</figcaption></figure><figure className="relative"><img src={preset.afterImage} alt={`Fictional ${preset.industry} after view`} className="aspect-[4/3] h-full w-full object-cover" /><figcaption className="absolute bottom-2 left-2 rounded-full bg-neon px-3 py-1 text-[9px] font-black text-black">After</figcaption></figure></div>
            </section>

            <section id="demo-request-form" className="scroll-mt-28 rounded-[2rem] border border-white/[0.08] bg-white/[0.035] p-5 sm:p-6">
              <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neon text-black"><CalendarCheck className="h-5 w-5" /></span><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">Conversion action</p><h3 className="mt-1 text-xl font-black">{campaign.ctaLabel}</h3><p className="mt-1 text-[10px] text-[var(--text-secondary)]">Demo only - submitting creates a fictional lead in this browser session.</p></div></div>
              {requestSent ? <div role="status" className="mt-5 rounded-2xl border border-neon/30 bg-neon/[0.08] p-5 text-center"><UserRoundCheck className="mx-auto h-7 w-7 text-neon" /><p className="mt-3 text-sm font-black">Sample request captured</p><p className="mt-1 text-[10px] text-[var(--text-secondary)]">Open Leads or Analytics to see the result.</p></div> : <form onSubmit={submitRequest} className="mt-5 space-y-3"><div className="grid gap-3 sm:grid-cols-2"><label className="text-[10px] font-black">Name<input name="name" required defaultValue="Taylor Morgan" className="input-field mt-1.5 text-xs" /></label><label className="text-[10px] font-black">Email<input name="email" required type="email" defaultValue="taylor.morgan@example.com" className="input-field mt-1.5 text-xs" /></label></div><label className="block text-[10px] font-black">Project interest<textarea name="message" required defaultValue={`Interested in ${campaign.title}`} rows={3} className="input-field mt-1.5 resize-none text-xs" /></label><AdpadzButton type="submit" fullWidth disabled={!customerReady}>{customerReady ? 'Submit sample request' : 'Owner preview - activate to submit'} <ArrowRight className="h-4 w-4" /></AdpadzButton></form>}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

function QrView({ state, preset, campaignId, dispatch, headingRef, announce }: { state: DemoWorkspaceState; preset: DemoBusinessPreset; campaignId: string; dispatch: Dispatch<DemoWorkspaceAction>; headingRef: React.RefObject<HTMLHeadingElement>; announce: (message: string) => void }) {
  const campaign = state.campaigns.find(item => item.id === campaignId) ?? state.campaigns[0];
  const qrPath = `/demo/workspace?business=${encodeURIComponent(state.business.slug)}&view=customer&campaign=${encodeURIComponent(campaign.id)}`;
  const qrValue = typeof window === 'undefined' ? `https://adpadz.co${qrPath}` : `${window.location.origin}${qrPath}`;
  const canScan = campaign.status === 'active' && campaign.outputs.includes('qr_landing');
  function scan() {
    dispatch(demoWorkspaceActions.simulateScan(campaign.id));
    announce(`Sample QR scan recorded and attributed to ${campaign.title}.`);
  }
  return (
    <>
      <PageHeading headingRef={headingRef} eyebrow="QR Studio" title="Turn offline attention into a measurable visit" description="This is a real scannable QR pointing to the selected customer campaign preview. The simulation demonstrates how Adpadz attributes a scan to that campaign." />
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <AdpadzCard variant="featured" className="p-5 sm:p-7">
          <div className="mx-auto max-w-md rounded-[2rem] bg-[#f4f4f1] p-4 shadow-2xl"><CircularPadQR value={qrValue} title={`${campaign.title} sample Pad QR`} topText={`${state.business.name} / ${state.business.location}`} bottomText={`Scan / Discover / ${campaign.ctaLabel}`} centerLabel={state.business.name.split(" ").slice(0, 2).join(" ")} shortLabel="adpadz.co/demo/workspace" accentColor={preset.accent} size={1000} className="h-auto w-full" /></div>
          <AdpadzButton type="button" onClick={scan} disabled={!canScan} fullWidth className="mt-5"><ScanLine className="h-4 w-4" /> {canScan ? 'Simulate a QR scan' : 'Activate campaign to simulate scan'}</AdpadzButton>
          <p className="mt-3 text-center text-[10px] text-[var(--text-secondary)]">Try it repeatedly - the sample scan count and activity update each time.</p>
        </AdpadzCard>
        <div className="space-y-5">
          <AdpadzCard variant="flat" className="p-5">
            <div className="flex items-center justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">Dynamic destination</p><h2 className="mt-1 text-lg font-black">{campaign.title}</h2></div><AdpadzBadge variant={campaign.status === 'active' ? 'local' : 'status'} className="capitalize">{campaign.status}</AdpadzBadge></div>
            <div className="mt-5 grid grid-cols-2 gap-3"><SmallStat value={state.metrics.qrScans} label="Sample scans" /><SmallStat value={campaign.metrics.qrScans} label="Campaign scans" /></div>
            <div className="mt-5 space-y-3"><InfoRow icon={Target} label="Campaign" value={campaign.title} /><InfoRow icon={Building2} label="Business Hub" value={state.business.name} /><InfoRow icon={MousePointerClick} label="Destination" value="Selected customer campaign preview" /><InfoRow icon={TrendingUp} label="Attribution" value="QR / community mailer" /></div>
          </AdpadzCard>
          <AdpadzCard variant="glass" className="p-5">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">What makes this valuable</p>
            <div className="mt-4 space-y-4">{[
              ['Change the destination', 'Update the experience without reprinting the physical QR.'],
              ['Keep the campaign connection', 'The scan remains attributed to the promotion that created it.'],
              ['See the next action', 'Reveals, bookings, and leads continue the same measurable journey.'],
            ].map(([title, detail]) => <div key={title} className="flex gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-neon" /><div><p className="text-xs font-black">{title}</p><p className="mt-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">{detail}</p></div></div>)}</div>
          </AdpadzCard>
        </div>
      </div>
    </>
  );
}

function LeadsView({ state, dispatch, headingRef, announce }: { state: DemoWorkspaceState; dispatch: Dispatch<DemoWorkspaceAction>; headingRef: React.RefObject<HTMLHeadingElement>; announce: (message: string) => void }) {
  const statusCounts = useMemo(() => Object.fromEntries(DEMO_LEAD_STATUSES.map(status => [status, state.leads.filter(lead => lead.status === status).length])) as Record<DemoLeadStatus, number>, [state.leads]);
  function updateLead(lead: DemoLead, status: DemoLeadStatus) {
    dispatch(demoWorkspaceActions.setLeadStatus(lead.id, status));
    announce(`${lead.name} moved to ${formatOutput(status)} in the sample pipeline.`);
  }
  return (
    <>
      <PageHeading headingRef={headingRef} eyebrow="Customer follow-up" title="Leads" description="Every name and contact is fictional. Use the status controls to demonstrate how interest becomes an organized follow-up pipeline." action={<AdpadzButton type="button" size="sm" onClick={() => { dispatch(demoWorkspaceActions.submitSampleLead()); announce('A new fictional sample inquiry was added.'); }}><Plus className="h-4 w-4" /> Add sample inquiry</AdpadzButton>} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">{DEMO_LEAD_STATUSES.map(status => <AdpadzCard key={status} variant="flat" className="p-4"><p className="text-xl font-black text-neon">{statusCounts[status]}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">{status}</p></AdpadzCard>)}</div>
      <div className="space-y-3">{state.leads.map(lead => <LeadRow key={lead.id} lead={lead} onStatus={status => updateLead(lead, status)} />)}</div>
      <p className="mt-5 text-center text-[10px] text-[var(--text-secondary)]">Showing recent fictional sample inquiries. The headline metric includes the full illustrative dataset.</p>
    </>
  );
}

function LeadRow({ lead, onStatus }: { lead: DemoLead; onStatus: (status: DemoLeadStatus) => void }) {
  return (
    <AdpadzCard as="article" variant="flat" className="p-4 sm:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neon/10 text-sm font-black text-neon">{lead.name.split(' ').map(part => part[0]).join('').slice(0, 2)}</span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-black">{lead.name}</h2><AdpadzBadge variant="status" className="capitalize">{lead.status}</AdpadzBadge><span className="text-[8px] font-black uppercase tracking-[0.12em] text-neon">Sample</span></div><p className="mt-1 text-[10px] text-[var(--text-secondary)]">{lead.email} / {lead.phone}</p><p className="mt-2 line-clamp-2 text-xs leading-relaxed text-neutral-300">{lead.message}</p></div>
        <div className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--text-secondary)]"><p>{formatOutput(lead.source)}</p><p className="mt-1 normal-case tracking-normal">{formatDate(lead.createdAt)}</p></div>
        <label className="text-[10px] font-black uppercase tracking-[0.13em] text-[var(--text-secondary)]">Next step<select value={lead.status} onChange={event => onStatus(event.target.value as DemoLeadStatus)} className="mt-2 block min-h-10 rounded-xl border border-white/10 bg-[var(--bg-input)] px-3 text-xs font-bold capitalize text-white outline-none focus:border-neon">{DEMO_LEAD_STATUSES.map(status => <option key={status} value={status}>{formatOutput(status)}</option>)}</select></label>
      </div>
    </AdpadzCard>
  );
}

function AnalyticsView({ state, headingRef }: { state: DemoWorkspaceState; headingRef: React.RefObject<HTMLHeadingElement> }) {
  const attributedLeads = state.campaigns.reduce((total, campaign) => total + campaign.metrics.leads, 0);
  const conversionRate = state.metrics.campaignViews > 0 ? Math.round((attributedLeads / state.metrics.campaignViews) * 1000) / 10 : 0;
  const maxViews = Math.max(...state.campaigns.map(campaign => campaign.metrics.views), 1);
  return (
    <>
      <PageHeading headingRef={headingRef} eyebrow="Measured customer journey" title="Analytics" description="Illustrative sample performance that connects discovery, engagement, conversion actions, and leads without claiming real customer results." />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
        <AdpadzMetricCard icon={Eye} label="Total views" value={formatNumber(state.metrics.profileViews + state.metrics.campaignViews)} detail="Profile plus campaign discovery" />
        <AdpadzMetricCard icon={QrCode} label="QR scans" value={formatNumber(state.metrics.qrScans)} detail="Attributed offline visits" />
        <AdpadzMetricCard icon={Sparkles} label="Offer reveals" value={formatNumber(state.metrics.offerReveals)} detail="Interactive campaign engagement" />
        <AdpadzMetricCard icon={Users} label="Leads" value={formatNumber(state.metrics.leads)} detail="Sample requests and inquiries" />
        <AdpadzMetricCard icon={CalendarCheck} label="Bookings" value={formatNumber(state.metrics.bookings)} detail="Booking requests within sample leads" />
        <AdpadzMetricCard icon={TrendingUp} label="Lead rate" value={`${conversionRate}%`} detail="Attributed leads divided by campaign views" />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <AdpadzSection eyebrow="Campaign performance" title="See which promotion moves people" description="Bars represent fictional sample campaign views. The text values provide the same information without relying on the chart.">
          <div className="space-y-5" role="list" aria-label="Sample campaign performance">
            {state.campaigns.map(campaign => (
              <div key={campaign.id} role="listitem">
                <div className="mb-2 flex items-end justify-between gap-4"><div><p className="text-xs font-black">{campaign.title}</p><p className="mt-1 text-[10px] text-[var(--text-secondary)]">{campaign.metrics.views} views / {campaign.metrics.offerReveals} reveals / {campaign.metrics.leads} leads</p></div><span className="text-sm font-black text-neon">{campaign.metrics.views > 0 ? Math.round((campaign.metrics.leads / campaign.metrics.views) * 100) : 0}%</span></div>
                <div className="h-3 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-gradient-to-r from-neon/40 to-neon" style={{ width: campaign.metrics.views > 0 ? `${Math.max(3, (campaign.metrics.views / maxViews) * 100)}%` : '0%' }} /></div>
              </div>
            ))}
          </div>
        </AdpadzSection>

        <AdpadzCard variant="flat" className="p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-neon">Live demo activity</p><h2 className="mt-1 text-lg font-black">Latest actions</h2></div><Flame className="h-5 w-5 text-neon" /></div>
          <div className="mt-5 space-y-4">{state.activity.slice(0, 7).map(item => <div key={item.id} className="flex gap-3"><span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-neon/10"><Activity className="h-3.5 w-3.5 text-neon" /></span><div><p className="text-[11px] font-black">{item.title}</p><p className="mt-1 text-[9px] leading-relaxed text-[var(--text-secondary)]">{item.detail}</p></div></div>)}</div>
        </AdpadzCard>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-3">
        <JourneyMetric icon={Eye} stage="Discovery" value={formatNumber(state.metrics.profileViews + state.metrics.campaignViews)} detail="Business Profile, campaign, and QR entry points" />
        <JourneyMetric icon={MousePointerClick} stage="Engagement" value={formatNumber(state.metrics.offerReveals + state.metrics.qrScans)} detail="Scans and interactive offer reveals" />
        <JourneyMetric icon={UserRoundCheck} stage="Conversion" value={formatNumber(state.metrics.leads)} detail={`${formatNumber(state.metrics.bookings)} booking requests are included in the sample lead total`} />
      </div>
      <p className="mt-6 text-center text-xs font-bold text-[var(--text-secondary)]">All values on this page are fictional sample performance for demonstrating product behavior.</p>
    </>
  );
}

function CustomerAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.035] text-[10px] font-black hover:border-neon/30 hover:text-neon"><Icon className="h-4 w-4" />{label}</button>;
}

function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-neon" /><div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--text-secondary)]">{label}</p><p className="mt-1 truncate text-[11px] font-bold text-[var(--text-secondary)]">{value}</p></div></div>;
}

function SmallStat({ value, label }: { value: number; label: string }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3"><p className="text-base font-black text-neon">{formatNumber(value)}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--text-secondary)]">{label}</p></div>;
}

function JourneyMetric({ icon: Icon, stage, value, detail }: { icon: LucideIcon; stage: string; value: string; detail: string }) {
  return <AdpadzCard variant="glass" className="p-5"><div className="flex items-center justify-between gap-4"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neon/10 text-neon"><Icon className="h-5 w-5" /></span><span className="text-2xl font-black text-neon">{value}</span></div><p className="mt-5 text-sm font-black">{stage}</p><p className="mt-1 text-[10px] leading-relaxed text-[var(--text-secondary)]">{detail}</p></AdpadzCard>;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatOutput(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sample inquiry';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
