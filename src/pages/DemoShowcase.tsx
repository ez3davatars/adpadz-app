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
  Mail,
  Megaphone,
  MousePointerClick,
  QrCode,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import { createInitialDemoWorkspaceState } from '../lib/demoWorkspace';
import './DemoShowcase.css';

const showcaseWorkspace = createInitialDemoWorkspaceState();
const showcaseCampaign = showcaseWorkspace.campaigns[0];
const showcaseTotalViews = showcaseWorkspace.metrics.profileViews + showcaseWorkspace.metrics.campaignViews;

const journeySteps = [
  {
    number: '01',
    icon: Building2,
    title: 'Build the business hub',
    description: 'Give the brand, services, contact paths, assets, and public profile one permanent home.',
    view: 'overview',
  },
  {
    number: '02',
    icon: Target,
    title: 'Launch one campaign',
    description: 'Create the offer, message, action, schedule, and connected outputs from one record.',
    view: 'campaigns',
  },
  {
    number: '03',
    icon: QrCode,
    title: 'Simulate QR discovery',
    description: 'Use the branded Pad QR and watch an attributed scan join the customer journey.',
    view: 'qr',
  },
  {
    number: '04',
    icon: Sparkles,
    title: 'Meet the customer view',
    description: 'Reveal the promotion and request a design visit exactly as a customer would.',
    view: 'customer',
  },
  {
    number: '05',
    icon: Users,
    title: 'Turn interest into a lead',
    description: 'Submit a sample request and move it through the same pipeline an owner uses.',
    view: 'leads',
  },
  {
    number: '06',
    icon: BarChart3,
    title: 'Close the loop',
    description: 'See views, reveals, scans, bookings, and leads update together in analytics.',
    view: 'analytics',
  },
];

const outputChannels = [
  { icon: Smartphone, label: 'Business profile', detail: 'Always-on foundation' },
  { icon: MousePointerClick, label: 'Interactive campaign', detail: 'Offer experience' },
  { icon: QrCode, label: 'Pad QR', detail: 'Offline discovery' },
  { icon: Megaphone, label: 'Community mailer', detail: 'Shared local reach' },
  { icon: Mail, label: 'Social & email', detail: 'Prepared to share' },
  { icon: Users, label: 'Lead capture', detail: 'Response with context' },
];

export default function DemoShowcase() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Adpadz Examples | One Campaign, Complete Journey';
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className="examples-page">
      <a href="#examples-content" className="examples-skip-link">Skip to examples</a>

      <header className="examples-nav">
        <div className="examples-nav__inner">
          <Link to="/" className="examples-brand" aria-label="Adpadz home">
            <img src="/brand/adpadz-logo.png" alt="" />
            <span>adpadz<span>.co</span></span>
          </Link>
          <nav aria-label="Examples navigation">
            <a href="#perspectives">Perspectives</a>
            <a href="#journey">The journey</a>
            <a href="#outputs">Outputs</a>
          </nav>
          <div className="examples-nav__actions">
            <Link to="/" className="examples-back-link"><ArrowLeft /> Home</Link>
            <Link to="/demo/workspace" className="examples-button examples-button--small">Open demo <ArrowRight /></Link>
          </div>
        </div>
      </header>

      <main id="examples-content">
        <section className="examples-hero">
          <div className="examples-grain" />
          <div className="examples-hero__layout">
            <div className="examples-hero__copy">
              <p className="examples-kicker"><span /> A working campaign, not a slideshow.</p>
              <h1>See one local offer become a <em>complete customer journey.</em></h1>
              <p className="examples-hero__lead">
                Follow River City Outdoor Living—a fictional sample business—from its permanent profile to campaign launch, neighborhood discovery, lead capture, and measurable response.
              </p>
              <div className="examples-actions">
                <Link to="/demo/workspace" className="examples-button">Start the guided demo <ArrowRight /></Link>
                <Link to="/demo/workspace?view=customer" className="examples-text-link">Enter as a customer <ArrowRight /></Link>
              </div>
              <div className="examples-proof">
                {['No sign-in', 'Safe sample data', 'Reset anytime'].map(item => (
                  <span key={item}><ShieldCheck /> {item}</span>
                ))}
              </div>
            </div>

            <div className="examples-hero__stage" aria-label="Sample Adpadz campaign preview">
              <div className="examples-orbit examples-orbit--outer" />
              <div className="examples-orbit examples-orbit--inner" />
              <div className="examples-stage-note"><Sparkles /> Follow it from launch to lead.</div>

              <article className="examples-campaign-card">
                <div className="examples-campaign-card__top">
                  <span><Target /> Live campaign</span>
                  <b>Active</b>
                </div>
                <p>{showcaseWorkspace.business.name}</p>
                <h2>{showcaseCampaign.title}</h2>
                <div className="examples-campaign-card__offer">
                  <small>Seasonal offer</small>
                  <strong>{showcaseCampaign.offer.title}</strong>
                  <span>{showcaseCampaign.ctaLabel} <ArrowRight /></span>
                </div>
                <div className="examples-mini-metrics">
                  <MiniMetric icon={Eye} value={showcaseCampaign.metrics.views.toLocaleString()} label="Views" />
                  <MiniMetric icon={MousePointerClick} value={showcaseCampaign.metrics.offerReveals.toLocaleString()} label="Reveals" />
                  <MiniMetric icon={ScanLine} value={showcaseCampaign.metrics.qrScans.toLocaleString()} label="Scans" />
                </div>
              </article>

              <img className="examples-hero__frog" src="/brand/adpadz-frog.webp" alt="The Adpadz frog guide presenting a sample campaign" />
              <div className="examples-stage-chip examples-stage-chip--profile"><Smartphone /> Profile</div>
              <div className="examples-stage-chip examples-stage-chip--qr"><QrCode /> QR path</div>
              <div className="examples-stage-chip examples-stage-chip--lead"><Users /> Lead</div>
            </div>
          </div>
        </section>

        <section className="examples-metric-ribbon" aria-label="Illustrative sample campaign metrics">
          <div>
            <Metric icon={Eye} label="Sample views" value={showcaseTotalViews.toLocaleString()} detail="Profile + campaign" />
            <Metric icon={MousePointerClick} label="Offer reveals" value={showcaseWorkspace.metrics.offerReveals.toLocaleString()} detail="Intentional engagement" />
            <Metric icon={Users} label="Sample leads" value={showcaseWorkspace.metrics.leads.toLocaleString()} detail="Requests + inquiries" />
            <Metric icon={QrCode} label="QR scans" value={showcaseWorkspace.metrics.qrScans.toLocaleString()} detail="Attributed discovery" />
          </div>
          <p>Illustrative demo activity—not customer results.</p>
        </section>

        <section className="examples-perspectives" id="perspectives">
          <div className="examples-section-heading examples-section-heading--dark">
            <p className="examples-kicker"><span /> Three views. One source of truth.</p>
            <h2>Walk through the promotion from every side.</h2>
            <p>Start with the owner workspace, switch into the customer’s moment, then return to the measurable result.</p>
          </div>
          <div className="examples-perspective-grid">
            <PerspectiveCard
              number="01"
              icon={Building2}
              eyebrow="Business workspace"
              title="Build and publish without repeating the work."
              description="Manage the business foundation, campaign, connected outputs, and response from one workspace."
              href="/demo/workspace?view=overview"
              action="Open the workspace"
            />
            <PerspectiveCard
              number="02"
              icon={HeartHandshake}
              eyebrow="Customer moment"
              title="Discover an offer worth choosing to explore."
              description="Experience the interactive promotion, reveal the value, and take the next step without pressure."
              href="/demo/workspace?view=customer"
              action="Try the experience"
              featured
            />
            <PerspectiveCard
              number="03"
              icon={BarChart3}
              eyebrow="Connected result"
              title="See which customer actions actually came back."
              description="Follow views, scans, reveals, requests, and leads as parts of the same campaign story."
              href="/demo/workspace?view=analytics"
              action="See the results"
            />
          </div>
        </section>

        <section className="examples-journey" id="journey">
          <div className="examples-journey__intro">
            <div className="examples-section-heading">
              <p className="examples-kicker"><span /> The complete loop.</p>
              <h2>Six working steps. About five minutes.</h2>
            </div>
            <p>Every step opens a functioning part of the safe sandbox. Choose a starting point or follow the story in order.</p>
          </div>
          <div className="examples-journey-grid">
            {journeySteps.map(step => (
              <JourneyCard key={step.number} {...step} />
            ))}
          </div>
        </section>

        <section className="examples-outputs" id="outputs">
          <div className="examples-outputs__copy">
            <p className="examples-kicker"><span /> Create once. Travel well.</p>
            <h2>One clear promotion.<br /><em>Six useful forms.</em></h2>
            <p>The message stays recognizable while each output is shaped for the place and moment in which someone encounters it.</p>
            <ul>
              {['One permanent business foundation', 'One campaign-controlled message', 'Customer actions connected to context'].map(item => (
                <li key={item}><Check /> {item}</li>
              ))}
            </ul>
          </div>
          <div className="examples-output-grid">
            {outputChannels.map((output, index) => (
              <article key={output.label} className={index === 1 ? 'is-featured' : ''}>
                <div><output.icon /><span>0{index + 1}</span></div>
                <h3>{output.label}</h3>
                <p>{output.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="examples-final">
          <div className="examples-final__frog-wrap">
            <div />
            <img src="/brand/adpadz-frog.webp" alt="The Adpadz frog guide" />
          </div>
          <div>
            <p className="examples-kicker"><span /> Safe to explore.</p>
            <h2>Try the whole journey before creating an account.</h2>
            <p>Create sample campaigns, trigger customer actions, manage leads, and reset the fictional workspace whenever you’re finished.</p>
            <div className="examples-actions">
              <Link to="/demo/workspace" className="examples-button">Open guided demo <ArrowRight /></Link>
              <Link to="/auth" className="examples-text-link">Create my account <ArrowRight /></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="examples-footer">
        <Link to="/" className="examples-brand" aria-label="Adpadz home">
          <img src="/brand/adpadz-logo.png" alt="" />
          <span>adpadz<span>.co</span></span>
        </Link>
        <p>Fictional businesses, leads, and performance data for product demonstration.</p>
        <div><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div>
      </footer>
    </div>
  );
}

function MiniMetric({ icon: Icon, value, label }: { icon: typeof Eye; value: string; label: string }) {
  return (
    <div>
      <Icon />
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Metric({ icon: Icon, value, label, detail }: { icon: typeof Eye; value: string; label: string; detail: string }) {
  return (
    <article>
      <Icon />
      <div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
    </article>
  );
}

function PerspectiveCard({
  number,
  icon: Icon,
  eyebrow,
  title,
  description,
  href,
  action,
  featured = false,
}: {
  number: string;
  icon: typeof Building2;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
  featured?: boolean;
}) {
  return (
    <Link to={href} className={`examples-perspective-card${featured ? ' is-featured' : ''}`}>
      <span className="examples-perspective-card__number">{number}</span>
      <div className="examples-perspective-card__icon"><Icon /></div>
      <p>{eyebrow}</p>
      <h3>{title}</h3>
      <blockquote>{description}</blockquote>
      <span className="examples-card-link">{action} <ArrowRight /></span>
    </Link>
  );
}

function JourneyCard({
  number,
  icon: Icon,
  title,
  description,
  view,
}: (typeof journeySteps)[number]) {
  return (
    <Link to={`/demo/workspace?view=${view}`} className="examples-journey-card">
      <div><span>{number}</span><Icon /></div>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="examples-card-link">Open this step <ArrowRight /></span>
    </Link>
  );
}
