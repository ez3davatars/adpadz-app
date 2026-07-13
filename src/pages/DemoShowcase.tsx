import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  Eye,
  HeartHandshake,
  MousePointerClick,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import {
  AdpadzBadge,
  AdpadzButton,
  AdpadzCard,
  AdpadzMetricCard,
  AdpadzSection,
} from '../components/adpadz-ui';
import { createInitialDemoWorkspaceState } from '../lib/demoWorkspace';

const showcaseWorkspace = createInitialDemoWorkspaceState();
const showcaseCampaign = showcaseWorkspace.campaigns[0];
const showcaseTotalViews = showcaseWorkspace.metrics.profileViews + showcaseWorkspace.metrics.campaignViews;

const journeySteps = [
  {
    number: '01',
    icon: Building2,
    title: 'Build the Business Hub',
    description: 'See one permanent source for the brand, services, contact paths, assets, and public profile.',
    view: 'overview',
  },
  {
    number: '02',
    icon: Target,
    title: 'Launch one campaign',
    description: 'Create the offer, message, call to action, schedule, and every connected output from one record.',
    view: 'campaigns',
  },
  {
    number: '03',
    icon: QrCode,
    title: 'Simulate QR discovery',
    description: 'Use the branded Pad QR and watch an attributed scan become part of the customer journey.',
    view: 'qr',
  },
  {
    number: '04',
    icon: Sparkles,
    title: 'Experience the customer view',
    description: 'Reveal the promotion and request a design visit exactly as a customer would.',
    view: 'customer',
  },
  {
    number: '05',
    icon: Users,
    title: 'Turn interest into a lead',
    description: 'Submit a sample request and move it through the same lead pipeline a business owner uses.',
    view: 'leads',
  },
  {
    number: '06',
    icon: BarChart3,
    title: 'Close the loop',
    description: 'See views, offer reveals, QR scans, bookings, and leads update together in analytics.',
    view: 'analytics',
  },
];

const outputLabels = ['Business Profile', 'Interactive campaign', 'Pad QR', 'Community mailer', 'Social & email', 'Lead capture'];

export default function DemoShowcase() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Adpadz Interactive Demo | One Campaign, Complete Journey';
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-[var(--bg-base)]">
      <a href="#demo-showcase-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-neon focus:px-4 focus:py-2 focus:text-sm focus:font-black focus:text-black">Skip to demo showcase</a>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-[color-mix(in_srgb,var(--bg-base)_88%,transparent)] backdrop-blur-xl safe-top">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2" aria-label="Adpadz home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-neon text-sm font-black text-black shadow-[var(--glow-sm)]">A</span>
            <span className="font-black">adpadz<span className="text-neon">.co</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/" className="hidden items-center gap-2 px-3 py-2 text-xs font-bold text-[var(--text-secondary)] hover:text-white sm:inline-flex">
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </Link>
            <AdpadzButton href="/demo/workspace" size="sm">Open guided demo <ArrowRight className="h-3.5 w-3.5" /></AdpadzButton>
          </div>
        </div>
      </header>

      <main id="demo-showcase-content">
        <section className="relative px-4 pb-20 pt-32 sm:px-6 sm:pt-40 lg:px-8">
          <div className="pointer-events-none absolute left-1/2 top-10 h-[38rem] w-[62rem] -translate-x-1/2 rounded-full bg-neon/[0.08] blur-[140px]" />
          <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <AdpadzBadge variant="local" className="mb-7"><Sparkles className="h-3.5 w-3.5" /> Interactive product demo · no sign-in</AdpadzBadge>
              <h1 className="max-w-4xl text-5xl font-black leading-[0.96] tracking-tight sm:text-6xl lg:text-7xl">
                See one local campaign become <span className="gradient-text">an entire customer journey.</span>
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-relaxed text-[var(--text-secondary)] sm:text-lg">
                Follow River City Outdoor Living—a fictional sample business—from Business Hub setup to campaign launch, QR discovery, lead capture, and measurable results.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <AdpadzButton href="/demo/workspace" size="lg">Start the guided demo <ArrowRight className="h-4 w-4" /></AdpadzButton>
                <AdpadzButton href="/demo/workspace?view=customer" variant="secondary" size="lg">Experience the customer view</AdpadzButton>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-bold text-[var(--text-secondary)]">
                {['Fictional sample business', 'Safe demo data', 'Reset anytime'].map(item => (
                  <span key={item} className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-neon" />{item}</span>
                ))}
              </div>
            </div>

            <AdpadzCard variant="glass" className="overflow-visible p-3 shadow-[0_40px_120px_rgba(0,0,0,0.55)] sm:p-4">
              <div className="rounded-[1.6rem] border border-white/[0.07] bg-black/35 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neon">Sample campaign</p>
                <h2 className="mt-1 text-lg font-black">{showcaseCampaign.title}</h2>
                  </div>
                  <AdpadzBadge variant="status">Active</AdpadzBadge>
                </div>
                <div className="mt-5 rounded-3xl border border-neon/25 bg-[radial-gradient(circle_at_20%_20%,rgba(182,255,0,0.2),transparent_35%),linear-gradient(145deg,#20251b,#090b08)] p-5">
                  <div className="flex items-start gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neon text-lg font-black text-black">R</span>
                    <div>
                      <p className="text-sm font-black">{showcaseWorkspace.business.name}</p>
                      <p className="mt-1 text-xs text-neutral-300">{showcaseWorkspace.business.tagline}</p>
                    </div>
                  </div>
                  <p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-neon">Limited seasonal offer</p>
                  <p className="mt-2 text-2xl font-black leading-tight">{showcaseCampaign.offer.title}</p>
                  <div className="mt-5 inline-flex rounded-full bg-neon px-4 py-2.5 text-xs font-black text-black">{showcaseCampaign.ctaLabel}</div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <MiniMetric icon={Eye} value={showcaseCampaign.metrics.views.toLocaleString()} label="Views" />
                  <MiniMetric icon={MousePointerClick} value={showcaseCampaign.metrics.offerReveals.toLocaleString()} label="Reveals" />
                  <MiniMetric icon={ScanLine} value={showcaseCampaign.metrics.qrScans.toLocaleString()} label="Scans" />
                </div>
                <p className="mt-4 text-center text-xs font-bold text-[var(--text-secondary)]">Illustrative sample performance—not customer results</p>
              </div>
            </AdpadzCard>
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-white/[0.02] px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 md:grid-cols-4">
            <AdpadzMetricCard icon={Eye} label="Sample views" value={showcaseTotalViews.toLocaleString()} detail="Profile and campaign discovery" />
            <AdpadzMetricCard icon={MousePointerClick} label="Sample reveals" value={showcaseWorkspace.metrics.offerReveals.toLocaleString()} detail="Interactive offer engagement" />
            <AdpadzMetricCard icon={Users} label="Sample leads" value={showcaseWorkspace.metrics.leads.toLocaleString()} detail="Design requests and inquiries" />
            <AdpadzMetricCard icon={QrCode} label="Sample QR scans" value={showcaseWorkspace.metrics.qrScans.toLocaleString()} detail="Attributed offline discovery" />
          </div>
        </section>

        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <AdpadzSection
              eyebrow="Choose your perspective"
              title="See the same promotion from every side"
              description="The demo is designed for a sales conversation: start with the owner workspace, switch to the customer experience, then finish with the measurable result."
            >
              <div className="grid gap-4 md:grid-cols-3">
                <PerspectiveCard icon={Building2} title="Business owner" description="Build and publish every customer touchpoint from one source." href="/demo/workspace?view=overview" action="Open the workspace" />
                <PerspectiveCard icon={HeartHandshake} title="Customer" description="Discover, reveal, scan, and request a design visit." href="/demo/workspace?view=customer" action="Try the experience" featured />
                <PerspectiveCard icon={BarChart3} title="Results" description="Watch each action become visible in the connected analytics story." href="/demo/workspace?view=analytics" action="See the results" />
              </div>
            </AdpadzSection>
          </div>
        </section>

        <section className="bg-[var(--bg-surface)] px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">The complete loop</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">A guided six-step story you can show in five minutes</h2>
              <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">Every step opens a working part of the sandbox. Actions are stored only for the current browser session and can be reset instantly.</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {journeySteps.map(step => (
                <Link key={step.number} to={`/demo/workspace?view=${step.view}`} className="group">
                  <AdpadzCard as="article" variant="flat" className="h-full p-6 transition group-hover:-translate-y-1 group-hover:border-neon/35">
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neon/10 text-neon"><step.icon className="h-5 w-5" /></span>
                      <span className="text-3xl font-black text-white/10">{step.number}</span>
                    </div>
                    <h3 className="mt-5 text-lg font-black">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{step.description}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-xs font-black text-neon">Open this step <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
                  </AdpadzCard>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Create once</p>
                <h2 className="mt-3 text-3xl font-black sm:text-4xl">One promotion. Multiple ready-to-use experiences.</h2>
                <p className="mt-4 text-sm leading-relaxed text-[var(--text-secondary)]">The working example keeps the headline, offer, dates, and action consistent while adapting the presentation for each channel.</p>
                <ul className="mt-7 space-y-3">
                  {['A permanent business foundation', 'Campaign-controlled offer and message', 'Customer actions connected to analytics'].map(item => (
                    <li key={item} className="flex items-center gap-3 text-sm font-bold"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-neon/10 text-neon"><Check className="h-3.5 w-3.5" /></span>{item}</li>
                  ))}
                </ul>
              </div>
              <AdpadzCard variant="glass" className="p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {outputLabels.map((label, index) => (
                    <div key={label} className={`rounded-3xl border p-4 ${index === 1 ? 'border-neon/40 bg-neon/[0.08]' : 'border-white/[0.08] bg-white/[0.035]'}`}>
                      <span className="text-[10px] font-black text-neon">0{index + 1}</span>
                      <p className="mt-7 text-sm font-black">{label}</p>
                      <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Connected & ready</p>
                    </div>
                  ))}
                </div>
              </AdpadzCard>
            </div>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl rounded-[2.5rem] border border-neon/25 bg-neon/[0.055] p-8 text-center shadow-[var(--glow-sm)] sm:p-12">
            <Sparkles className="mx-auto h-9 w-9 text-neon" />
            <h2 className="mt-5 text-3xl font-black sm:text-4xl">Ready to explore the whole product?</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">No account is required. Create sample campaigns, trigger customer actions, manage leads, and reset everything when your presentation is done.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <AdpadzButton href="/demo/workspace" size="lg">Open guided demo <ArrowRight className="h-4 w-4" /></AdpadzButton>
              <AdpadzButton href="/auth" variant="secondary" size="lg">Create my own account</AdpadzButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.07] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 sm:flex-row">
          <div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-neon text-xs font-black text-black">A</span><span className="text-sm font-black">adpadz<span className="text-neon">.co</span></span></div>
          <p className="text-center text-xs text-[var(--text-secondary)]">Fictional business, leads, and performance data for product demonstration.</p>
          <div className="flex gap-4 text-xs font-bold text-[var(--text-muted)]"><Link to="/privacy" className="hover:text-white">Privacy</Link><Link to="/terms" className="hover:text-white">Terms</Link></div>
        </div>
      </footer>
    </div>
  );
}

function MiniMetric({ icon: Icon, value, label }: { icon: typeof Eye; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3 text-center">
      <Icon className="mx-auto h-3.5 w-3.5 text-neon" />
      <p className="mt-2 text-sm font-black">{value}</p>
      <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.13em] text-[var(--text-secondary)]">{label}</p>
    </div>
  );
}

function PerspectiveCard({
  icon: Icon,
  title,
  description,
  href,
  action,
  featured = false,
}: {
  icon: typeof Building2;
  title: string;
  description: string;
  href: string;
  action: string;
  featured?: boolean;
}) {
  return (
    <Link to={href} className="group">
      <AdpadzCard as="article" variant={featured ? 'featured' : 'flat'} className={`h-full p-6 transition group-hover:-translate-y-1 ${featured ? 'border-neon/35 bg-neon/[0.055]' : 'group-hover:border-neon/30'}`}>
        <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${featured ? 'bg-neon text-black' : 'bg-neon/10 text-neon'}`}><Icon className="h-5 w-5" /></span>
        <h3 className="mt-5 text-xl font-black">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{description}</p>
        <span className="mt-6 inline-flex items-center gap-2 text-xs font-black text-neon">{action} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" /></span>
      </AdpadzCard>
    </Link>
  );
}
