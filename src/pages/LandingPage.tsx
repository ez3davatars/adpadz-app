import { Link } from 'react-router-dom';
import {
  ArrowRight, BarChart3, Building2, Check, HeartHandshake, Megaphone,
  MousePointerClick, QrCode, Smartphone, Sparkles, Target, Users,
} from 'lucide-react';
import { AdpadzBadge, AdpadzButton, AdpadzCard } from '../components/adpadz-ui';
import { createInitialDemoWorkspaceState } from '../lib/demoWorkspace';
import './LandingPage.css';

const landingDemo = createInitialDemoWorkspaceState();
const landingDemoCampaign = landingDemo.campaigns[0];
const landingDemoViews = landingDemo.metrics.profileViews + landingDemo.metrics.campaignViews;

const productPillars = [
  { icon: Building2, title: 'Business Hub', description: 'Keep permanent business details, brand assets, services, contact paths, and customer-facing content in one place.' },
  { icon: Target, title: 'Campaign Engine', description: 'Create a promotion once. Campaigns remain the single source of truth for the offer, dates, message, and call to action.' },
  { icon: Megaphone, title: 'Publish Everywhere', description: 'Turn the same campaign into a Business Profile feature, interactive experience, QR path, mailer, social post, email, or flyer.' },
  { icon: BarChart3, title: 'Leads & Analytics', description: 'Measure discovery, reveals, calls, bookings, claims, QR scans, and lead forms in one customer journey.' },
];

const outputs = [
  { icon: Smartphone, label: 'Business Profile' },
  { icon: MousePointerClick, label: 'Interactive Campaign' },
  { icon: QrCode, label: 'QR Experience' },
  { icon: Megaphone, label: 'Community Mailer' },
  { icon: Sparkles, label: 'Social & Email' },
  { icon: Users, label: 'Lead Capture' },
];

const lifecycle = [
  { value: 'Discovery', detail: 'QR, mailers, campaigns' },
  { value: 'Engagement', detail: 'Interactive and profile experiences' },
  { value: 'Conversion', detail: 'Calls, offers, booking, leads' },
  { value: 'Retention', detail: 'Customer follow-up and insight' },
];

const journeySteps = [
  { number: '01', title: 'Build the foundation', description: 'Add permanent business information, services, brand assets, contact actions, and the public Business Profile.' },
  { number: '02', title: 'Create one campaign', description: 'Set the promotion, offer, media, dates, call to action, interactive format, and the outputs it should power.' },
  { number: '03', title: 'Learn from customer action', description: 'Track views, reveals, clicks, QR scans, bookings, claims, and leads without stitching together unrelated reports.' },
];

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen overflow-hidden">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-[color-mix(in_srgb,var(--bg-base)_88%,transparent)] backdrop-blur-xl safe-top">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" aria-label="Adpadz home">
            <img src="/brand/adpadz-logo.png" alt="Adpadz" className="landing-nav-logo" />
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-bold text-[var(--text-secondary)] md:flex" aria-label="Main navigation">
            <a href="#platform" className="transition hover:text-white">Platform</a>
            <a href="#journey" className="transition hover:text-white">How it works</a>
            <Link to="/examples" className="transition hover:text-white">Examples</Link>
            <Link to="/feed" className="transition hover:text-white">Explore local</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden px-3 py-2 text-sm font-bold text-[var(--text-secondary)] hover:text-white sm:inline-flex">Sign in</Link>
            <AdpadzButton href="/auth" size="md" className="text-sm">Start a campaign <ArrowRight className="h-4 w-4" /></AdpadzButton>
          </div>
        </div>
      </header>

      <main>
        <section className="landing-hero-section">
          <div className="landing-hero-grid">
            <div className="landing-hero-copy">
              <AdpadzBadge variant="local" className="text-xs"><HeartHandshake className="h-4 w-4" /> Built for local business</AdpadzBadge>
              <h1 className="landing-hero-title">Create once.<span>Grow everywhere.</span></h1>
              <p className="landing-hero-description">
                Adpadz turns one clear campaign into every customer experience your business needs—then shows which actions are actually creating growth.
              </p>
              <div className="landing-hero-actions">
                <AdpadzButton href="/auth" size="lg">Build your first campaign <ArrowRight className="h-4 w-4" /></AdpadzButton>
                <AdpadzButton href="/demo/workspace" variant="secondary" size="lg">Explore the live demo</AdpadzButton>
              </div>
              <div className="landing-proof">
                {['One source of truth', 'Reusable business assets', 'Real customer actions'].map(item => (
                  <span key={item}><Check className="h-4 w-4 text-neon" />{item}</span>
                ))}
              </div>
            </div>

            <div className="landing-control" aria-label="Example Adpadz campaign workflow">
              <div className="landing-control-head">
                <p className="landing-control-kicker">Campaign control</p>
                <span className="landing-control-status">Ready to publish</span>
              </div>

              <ControlRow icon={Building2} label="Foundation" title="River City Outdoor Living" meta="Business Hub" />
              <ControlRow icon={Target} label="Active campaign" title={landingDemoCampaign.title} meta="One source" active />

              <div className="landing-control-outputs">
                <p className="landing-control-label">Connected outputs</p>
                <div className="landing-control-output-grid">
                  {outputs.slice(0, 4).map(output => (
                    <div key={output.label} className="landing-output-chip">
                      <output.icon className="h-4 w-4 shrink-0 text-neon" />
                      <span>{output.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="landing-control-metrics">
                <Metric value={landingDemoViews.toLocaleString()} label="Views" />
                <Metric value={landingDemo.metrics.qrScans.toLocaleString()} label="QR scans" />
                <Metric value={landingDemo.metrics.leads.toLocaleString()} label="Leads" />
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-white/[0.07] bg-white/[0.018] px-4 py-11 sm:px-6 lg:px-8">
          <div className="landing-lifecycle">
            {lifecycle.map((stage, index) => (
              <article key={stage.value} className="landing-stage">
                <span className="landing-stage-number">0{index + 1}</span>
                <h3>{stage.value}</h3>
                <p>{stage.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="platform" className="scroll-mt-20 px-4 py-28 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="max-w-3xl">
              <p className="landing-section-eyebrow">The local marketing system</p>
              <h2 className="landing-section-title">Fewer disconnected tools.<br />One clear next step.</h2>
              <p className="landing-section-description">Adpadz keeps permanent business information separate from temporary campaigns, then connects both to every customer-facing output.</p>
            </div>
            <div className="landing-pillar-grid">
              {productPillars.map((pillar, index) => (
                <AdpadzCard key={pillar.title} as="article" variant="glass" className="landing-pillar">
                  <span className="landing-pillar-number">0{index + 1}</span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neon/10 text-neon"><pillar.icon className="h-5 w-5" /></span>
                  <h3>{pillar.title}</h3>
                  <p>{pillar.description}</p>
                </AdpadzCard>
              ))}
            </div>
          </div>
        </section>

        <section id="journey" className="scroll-mt-20 border-y border-white/[0.07] bg-[var(--bg-surface)] px-4 py-28 sm:px-6 lg:px-8">
          <div className="landing-journey mx-auto max-w-6xl">
            <div>
              <p className="landing-section-eyebrow">How it works</p>
              <h2 className="landing-section-title">One campaign becomes a measurable journey.</h2>
              <p className="landing-section-description">The business owner stays in control. Adpadz reduces repeated work and keeps every output connected.</p>
            </div>
            <div className="landing-step-list">
              {journeySteps.map(step => (
                <article key={step.number} className="landing-step">
                  <span className="landing-step-number">{step.number}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="examples" className="scroll-mt-20 px-4 py-28 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
              <div className="landing-example-copy">
                <AdpadzBadge variant="local" className="mb-5 text-xs"><Sparkles className="h-4 w-4" /> Working example · sample data</AdpadzBadge>
                <h2 className="landing-section-title">See the whole customer journey before you subscribe.</h2>
                <p className="mt-5">
                  River City Outdoor Living is a fictional business built to show the complete Adpadz experience. Create a promotion as the owner, experience it as a customer, then watch every action appear in analytics.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                  <AdpadzButton href="/demo/workspace" size="lg">Open the guided demo <ArrowRight className="h-4 w-4" /></AdpadzButton>
                  <AdpadzButton href="/examples" variant="secondary" size="lg">View the showcase</AdpadzButton>
                </div>
                <div className="landing-proof mt-6">
                  {['No sign-in', 'Safe sandbox', 'Reset anytime'].map(item => <span key={item}><Check className="h-4 w-4 text-neon" />{item}</span>)}
                </div>
              </div>

              <AdpadzCard variant="glass" className="landing-example-card p-5 sm:p-7">
                <div className="grid gap-3 md:grid-cols-3 md:items-stretch">
                  {[
                    { icon: Target, number: '01', title: 'Create', detail: landingDemoCampaign.title, meta: `One offer · ${landingDemoCampaign.outputs.length} outputs` },
                    { icon: MousePointerClick, number: '02', title: 'Experience', detail: 'Reveal, scan, request', meta: 'Customer journey' },
                    { icon: BarChart3, number: '03', title: 'Measure', detail: 'Actions become insight', meta: 'Connected analytics' },
                  ].map((item, index) => (
                    <div key={item.number} className={`relative rounded-3xl border p-5 ${index === 1 ? 'border-neon/40 bg-neon/[0.075]' : 'border-white/[0.08] bg-white/[0.035]'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${index === 1 ? 'bg-neon text-black' : 'bg-neon/10 text-neon'}`}><item.icon className="h-4 w-4" /></span>
                        <span className="text-2xl font-black text-white/10">{item.number}</span>
                      </div>
                      <p className="mt-7 text-xs font-black uppercase tracking-[0.16em] text-neon">{item.title}</p>
                      <p className="landing-example-detail mt-2 font-black">{item.detail}</p>
                      <p className="mt-1 text-[var(--text-muted)]">{item.meta}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.07] text-center">
                  <ExampleMetric value={landingDemoViews.toLocaleString()} label="Sample views" />
                  <ExampleMetric value={landingDemo.metrics.qrScans.toLocaleString()} label="Sample scans" />
                  <ExampleMetric value={landingDemo.metrics.leads.toLocaleString()} label="Sample leads" />
                </div>
              </AdpadzCard>
            </div>
          </div>
        </section>

        <section className="px-4 pb-28 pt-8 sm:px-6 lg:px-8">
          <div className="landing-final-cta">
            <div className="relative z-10">
              <p className="landing-section-eyebrow">Ready when you are</p>
              <h2>Make local marketing feel manageable again.</h2>
              <p>Build the Business Hub, launch one campaign, and let every output stay connected to the same source of truth.</p>
            </div>
            <div className="landing-final-actions">
              <AdpadzButton href="/auth" size="lg">Start building <ArrowRight className="h-4 w-4" /></AdpadzButton>
              <AdpadzButton href="/examples" variant="secondary" size="lg">See the example</AdpadzButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.07] px-4 py-9 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-5 sm:flex-row">
          <img src="/brand/adpadz-logo.png" alt="Adpadz" className="landing-footer-logo" />
          <p className="text-center text-sm text-[var(--text-muted)]">&copy; 2026 Adpadz. The local advertising cooperative.</p>
          <div className="flex gap-5 text-sm font-bold text-[var(--text-muted)]"><Link to="/examples" className="hover:text-white">Examples</Link><Link to="/privacy" className="hover:text-white">Privacy</Link><Link to="/terms" className="hover:text-white">Terms</Link></div>
        </div>
      </footer>
    </div>
  );
}

function ControlRow({ icon: Icon, label, title, meta, active = false }: { icon: typeof Building2; label: string; title: string; meta: string; active?: boolean }) {
  return (
    <div className={`landing-control-row ${active ? 'landing-control-row--active' : ''}`}>
      <span className="landing-control-icon"><Icon className="h-5 w-5" /></span>
      <div>
        <p className="landing-control-label">{label}</p>
        <p className="landing-control-title">{title}</p>
      </div>
      <span className="landing-control-meta">{meta}</span>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="landing-control-metric"><strong>{value}</strong><span>{label}</span></div>;
}

function ExampleMetric({ value, label }: { value: string; label: string }) {
  return <div className="bg-black/30 px-2 py-4"><p className="text-xl font-black text-neon">{value}</p><p className="mt-1 text-[11px] font-black uppercase tracking-[0.1em] text-[var(--text-muted)]">{label}</p></div>;
}
