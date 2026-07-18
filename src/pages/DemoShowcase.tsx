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
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import AdpadzBrand from '../components/AdpadzBrand';
import { createInitialDemoWorkspaceState } from '../lib/demoWorkspace';
import { DEMO_BUSINESS_PRESETS } from '../lib/demoPresets';
import { buildDemoRoute } from '../lib/demoRouting';
import './DemoShowcase.css';

const showcaseWorkspace = createInitialDemoWorkspaceState();
const showcaseCampaign = showcaseWorkspace.campaigns[0];
const showcaseLead = showcaseWorkspace.leads[0];
const showcaseTotalViews = showcaseWorkspace.metrics.profileViews + showcaseWorkspace.metrics.campaignViews;

const campaignDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const showcaseCampaignDates = [showcaseCampaign.startDate, showcaseCampaign.endDate]
  .map(date => date ? campaignDateFormatter.format(new Date(date)) : 'Open')
  .join(' - ');

const caseFileChannels = [
  { icon: Smartphone, label: 'Business Profile' },
  { icon: MousePointerClick, label: 'Interactive Ad' },
  { icon: QrCode, label: 'Pad QR' },
  { icon: Megaphone, label: 'Community Mailer' },
  { icon: Mail, label: 'Social & Email' },
];

const journeySteps = [
  {
    number: '01',
    phase: 'Foundation',
    icon: Building2,
    title: 'Build the business hub',
    description: 'Give the brand, services, contact paths, assets, and public profile one permanent home.',
    view: 'overview',
  },
  {
    number: '02',
    phase: 'Campaign',
    icon: Target,
    title: 'Launch one campaign',
    description: 'Create the offer, message, action, schedule, and connected outputs from one record.',
    view: 'campaigns',
  },
  {
    number: '03',
    phase: 'Discovery',
    icon: QrCode,
    title: 'Simulate QR discovery',
    description: 'Use the branded Pad QR and watch an attributed scan join the customer journey.',
    view: 'qr',
  },
  {
    number: '04',
    phase: 'Experience',
    icon: Sparkles,
    title: 'Meet the customer view',
    description: 'Reveal the promotion and request a design visit exactly as a customer would.',
    view: 'customer',
  },
  {
    number: '05',
    phase: 'Response',
    icon: Users,
    title: 'Turn interest into a lead',
    description: 'Submit a sample request and move it through the same pipeline an owner uses.',
    view: 'leads',
  },
  {
    number: '06',
    phase: 'Learning',
    icon: BarChart3,
    title: 'Close the loop',
    description: 'See views, reveals, scans, bookings, and leads update together in analytics.',
    view: 'analytics',
  },
];

const outputChannels = [
  { icon: Smartphone, label: 'Business profile', detail: 'The always-on foundation for the business.', layout: 'profile' },
  { icon: MousePointerClick, label: 'Interactive campaign', detail: 'A focused offer experience built for response.', layout: 'campaign' },
  { icon: QrCode, label: 'Pad QR', detail: 'A trackable bridge from physical to digital.', layout: 'qr' },
  { icon: Megaphone, label: 'Community mailer', detail: 'Shared neighborhood reach with one clear message.', layout: 'mailer' },
  { icon: Mail, label: 'Social & email', detail: 'Prepared copy that is ready to distribute.', layout: 'social' },
  { icon: Users, label: 'Lead capture', detail: 'Every response arrives with its campaign context.', layout: 'leads' },
];

export default function DemoShowcase() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Adpadz Examples | One Campaign, Complete Journey';
    return () => { document.title = previousTitle; };
  }, []);

  return (
    <div className='examples-page'>
      <a href='#examples-content' className='examples-skip-link'>Skip to examples</a>

      <header className='examples-nav'>
        <div className='examples-nav__inner'>
          <AdpadzBrand />
          <nav aria-label='Examples navigation'>
            <a href='#perspectives'>Perspectives</a>
            <a href='#journey'>The journey</a>
            <a href='#outputs'>Outputs</a>
          </nav>
          <div className='examples-nav__actions'>
            <Link to='/' className='examples-back-link'><ArrowLeft /> Home</Link>
            <Link to='/demo/workspace' className='examples-button examples-button--small'>Open demo <ArrowRight /></Link>
          </div>
        </div>
      </header>

      <main id='examples-content'>
        <section className='examples-hero'>
          <div className='examples-hero__intro'>
            <div className='examples-hero__folio'>
              <p className='examples-kicker examples-kicker--ink'><span /> ADPADZ PRODUCT TOUR</p>
              <p>CASE FILE 001 / FICTIONAL DEMO</p>
            </div>

            <div className='examples-hero__editorial'>
              <h1>Follow one campaign from first offer to real response.</h1>
              <div className='examples-hero__brief'>
                <p>
                  This interactive fictional demo follows River City Outdoor Living as one seasonal offer becomes a business profile, customer experience, QR path, community message, and measurable lead.
                </p>
                <div className='examples-actions examples-actions--hero'>
                  <Link to='/demo/workspace' className='examples-button'>Start the guided demo <ArrowRight /></Link>
                </div>
                <div className='examples-proof' aria-label='Demo details'>
                  {['No sign-in', 'Safe sample data', 'Reset anytime'].map(item => (
                    <span key={item}><ShieldCheck /> {item}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className='examples-case-file'>
            <div className='examples-case-file__rail'>
              <span>CAMPAIGN CASE FILE</span>
              <span>{showcaseCampaign.status} / SUMMER 2026</span>
            </div>

            <div className='examples-case-board' aria-label='River City Outdoor Living campaign flow'>
              <article className='examples-case-zone examples-case-zone--source'>
                <div className='examples-case-zone__topline'>
                  <span>01 / SOURCE</span>
                  <Target />
                </div>
                <p className='examples-case-zone__label'>Campaign owner</p>
                <h2>{showcaseWorkspace.business.name}</h2>
                <p className='examples-case-zone__location'>{showcaseWorkspace.business.location}</p>

                <div className='examples-source-offer'>
                  <small>Seasonal offer</small>
                  <strong>{showcaseCampaign.offer.title}</strong>
                </div>

                <dl className='examples-source-details'>
                  <div>
                    <dt>Run dates</dt>
                    <dd>{showcaseCampaignDates}</dd>
                  </div>
                  <div>
                    <dt>Primary CTA</dt>
                    <dd>{showcaseCampaign.ctaLabel}</dd>
                  </div>
                </dl>
              </article>

              <FlowConnector label='Route campaign to outputs' />

              <section className='examples-case-zone examples-case-zone--routing'>
                <div className='examples-case-zone__topline'>
                  <span>02 / ROUTING</span>
                  <Megaphone />
                </div>
                <p className='examples-case-zone__label'>Channel map</p>
                <h2>One campaign. Five live paths.</h2>
                <ol className='examples-route-list'>
                  {caseFileChannels.map((channel, index) => (
                    <li key={channel.label}>
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <channel.icon />
                      <strong>{channel.label}</strong>
                    </li>
                  ))}
                </ol>
              </section>

              <FlowConnector label='Connect outputs to response' />

              <article className='examples-case-zone examples-case-zone--response'>
                <div className='examples-case-zone__topline'>
                  <span>03 / RESPONSE</span>
                  <HeartHandshake />
                </div>
                <div className='examples-response-status'><span /> New lead received</div>
                <p className='examples-case-zone__label'>Customer signal</p>
                <h2>{showcaseLead.name}</h2>
                <p className='examples-response-message'>&quot;{showcaseLead.message}&quot;</p>

                <div className='examples-response-events'>
                  <span><HeartHandshake /> Design visit requested</span>
                  <span><QrCode /> Pad QR attributed</span>
                </div>

                <div className='examples-response-offer'>
                  <small>Offer revealed</small>
                  <strong>{showcaseCampaign.offer.title}</strong>
                </div>
              </article>
            </div>

            <div className='examples-case-file__footer'>
              <p>Illustrative case data - no real business or customer results.</p>
              <Link to='/demo/workspace?view=customer' className='examples-case-link'>Enter as a customer <ArrowRight /></Link>
            </div>
          </div>
        </section>

        <section className='examples-metric-band' aria-label='Illustrative sample campaign metrics'>
          <div className='examples-metric-band__header'>
            <span>DEMO SIGNALS</span>
            <p>Illustrative activity, not customer results.</p>
          </div>
          <div className='examples-metric-band__grid'>
            <Metric icon={Eye} label='Sample views' value={showcaseTotalViews.toLocaleString()} detail='Profile + campaign' />
            <Metric icon={MousePointerClick} label='Offer reveals' value={showcaseWorkspace.metrics.offerReveals.toLocaleString()} detail='Intentional engagement' />
            <Metric icon={Users} label='Sample leads' value={showcaseWorkspace.metrics.leads.toLocaleString()} detail='Requests + inquiries' />
            <Metric icon={QrCode} label='QR scans' value={showcaseWorkspace.metrics.qrScans.toLocaleString()} detail='Attributed discovery' />
          </div>
        </section>

        <section className='examples-perspectives' id='perspectives'>
          <div className='examples-section-heading examples-section-heading--dark'>
            <p className='examples-kicker'><span /> THREE PERSPECTIVES</p>
            <div>
              <h2>Walk the campaign like an exhibit.</h2>
              <p>Move through the owner's workspace, the customer's moment, and the result that comes back. Every room uses the same campaign record.</p>
            </div>
          </div>

          <div className='examples-perspective-gallery'>
            <PerspectivePanel
              number='01'
              icon={Building2}
              eyebrow='Business workspace'
              title='Build and publish without repeating the work.'
              description='Manage the business foundation, campaign, connected outputs, and response from one workspace.'
              href='/demo/workspace?view=overview'
              action='Open the workspace'
              accent='business'
            />
            <PerspectivePanel
              number='02'
              icon={HeartHandshake}
              eyebrow='Customer moment'
              title='Discover an offer worth choosing to explore.'
              description='Experience the interactive promotion, reveal the value, and take the next step without pressure.'
              href='/demo/workspace?view=customer'
              action='Try the experience'
              accent='customer'
            />
            <PerspectivePanel
              number='03'
              icon={BarChart3}
              eyebrow='Connected result'
              title='See which customer actions actually came back.'
              description='Follow views, scans, reveals, requests, and leads as parts of the same campaign story.'
              href='/demo/workspace?view=analytics'
              action='See the results'
              accent='results'
            />
          </div>
        </section>

        <section className='examples-journey' id='journey'>
          <div className='examples-journey__intro'>
            <div>
              <p className='examples-kicker examples-kicker--ink'><span /> CAMPAIGN ROUTE</p>
              <h2>Six milestones. One connected trip.</h2>
            </div>
            <p>Follow the route in order or enter anywhere. Each milestone opens a working part of the safe product sandbox.</p>
          </div>

          <ol className='examples-timeline'>
            {journeySteps.map(step => (
              <JourneyMilestone key={step.number} {...step} />
            ))}
          </ol>
        </section>

        <section className='examples-outputs' id='outputs'>
          <div className='examples-outputs__header'>
            <div>
              <p className='examples-kicker'><span /> DISTRIBUTION BOARD</p>
              <h2>Create once.<br />Route everywhere.</h2>
            </div>
            <div className='examples-outputs__summary'>
              <p>The offer stays recognizable while every output is shaped for the place and moment in which someone encounters it.</p>
              <ul>
                {['One business foundation', 'One campaign-controlled message', 'Every response keeps its context'].map(item => (
                  <li key={item}><Check /> {item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className='examples-distribution-board'>
            {outputChannels.map((output, index) => (
              <OutputTile key={output.label} {...output} number={'0' + (index + 1)} />
            ))}
          </div>
        </section>

        <section className='examples-industry-stories'>
          <div className='examples-industry-stories__header'>
            <div><p className='examples-kicker'><span /> CHOOSE A BUSINESS TO EXPERIENCE</p><h2>Six local stories.<br />One connected system.</h2></div>
            <p>River City is the flagship case file. Each additional business follows an equally complete, industry-specific challenge through measurable customer engagement.</p>
          </div>
          <div className='examples-industry-stories__grid'>
            {DEMO_BUSINESS_PRESETS.map(preset => (
              <Link key={preset.slug} to={buildDemoRoute(preset.slug)} className={'examples-industry-story' + (preset.flagship ? ' examples-industry-story--flagship' : '')}>
                <div className='examples-industry-story__image'><img src={preset.heroImage} alt='' /><span style={{ background: preset.accent }}>{preset.flagship ? 'Flagship' : preset.industry}</span></div>
                <div className='examples-industry-story__body'><small>{preset.business.location}</small><h3>{preset.business.name}</h3><p>{preset.challenge}</p><strong>Experience this business <ArrowRight /></strong></div>
              </Link>
            ))}
          </div>
          <p className='examples-industry-stories__note'>All businesses, customers, campaigns, and engagement metrics are fictional sample data.</p>
        </section>

        <section className='examples-final'>
          <div className='examples-final__frame'>
            <div className='examples-final__stage'>
              <div className='examples-final__scene-label'><Sparkles /> Your campaign guide</div>
              <div className='examples-final__halo' />
              <div className='examples-final__pad-shadow' />
              <img src='/brand/adpadz-frog.webp' alt='The Adpadz frog guide ready to lead the product tour' />
            </div>

            <div className='examples-final__copy'>
              <p className='examples-kicker'><span /> SAFE TO EXPLORE</p>
              <h2>Now take the case file for a spin.</h2>
              <p>Create sample campaigns, trigger customer actions, manage leads, and reset the fictional workspace whenever you're finished.</p>
              <div className='examples-actions'>
                <Link to='/demo/workspace' className='examples-button'>Open guided demo <ArrowRight /></Link>
                <Link to='/auth' className='examples-text-link'>Create my account <ArrowRight /></Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className='examples-footer'>
        <AdpadzBrand compact />
        <p>Fictional businesses, leads, and performance data for product demonstration.</p>
        <div><Link to='/privacy'>Privacy</Link><Link to='/terms'>Terms</Link></div>
      </footer>
    </div>
  );
}

function FlowConnector({ label }: { label: string }) {
  return (
    <div className='examples-flow-connector' aria-label={label}>
      <span />
      <ArrowRight />
    </div>
  );
}

function Metric({ icon: Icon, value, label, detail }: { icon: typeof Eye; value: string; label: string; detail: string }) {
  return (
    <article>
      <div className='examples-metric-band__icon'><Icon /></div>
      <strong>{value}</strong>
      <div><span>{label}</span><small>{detail}</small></div>
    </article>
  );
}

function PerspectivePanel({
  number,
  icon: Icon,
  eyebrow,
  title,
  description,
  href,
  action,
  accent,
}: {
  number: string;
  icon: typeof Building2;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  action: string;
  accent: 'business' | 'customer' | 'results';
}) {
  return (
    <Link to={href} className={'examples-perspective-panel examples-perspective-panel--' + accent}>
      <div className='examples-perspective-panel__topline'>
        <span>EXHIBIT {number}</span>
        <Icon />
      </div>
      <div className='examples-perspective-panel__body'>
        <p>{eyebrow}</p>
        <h3>{title}</h3>
        <blockquote>{description}</blockquote>
      </div>
      <span className='examples-panel-link'>{action} <ArrowRight /></span>
    </Link>
  );
}

function JourneyMilestone({
  number,
  phase,
  icon: Icon,
  title,
  description,
  view,
}: (typeof journeySteps)[number]) {
  return (
    <li>
      <Link to={'/demo/workspace?view=' + view} className='examples-milestone'>
        <div className='examples-milestone__marker'>
          <span>{number}</span>
          <Icon />
        </div>
        <div className='examples-milestone__content'>
          <p>{phase}</p>
          <h3>{title}</h3>
          <blockquote>{description}</blockquote>
          <span>Open this step <ArrowRight /></span>
        </div>
      </Link>
    </li>
  );
}

function OutputTile({
  icon: Icon,
  label,
  detail,
  layout,
  number,
}: {
  icon: typeof Smartphone;
  label: string;
  detail: string;
  layout: string;
  number: string;
}) {
  return (
    <article className={'examples-output-tile examples-output-tile--' + layout}>
      <div className='examples-output-tile__topline'>
        <span>OUT / {number}</span>
        <Icon />
      </div>
      <div>
        <h3>{label}</h3>
        <p>{detail}</p>
      </div>
      <small>CAMPAIGN CORE TO CHANNEL</small>
    </article>
  );
}
