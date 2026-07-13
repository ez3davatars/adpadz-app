import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  Eye,
  HeartHandshake,
  Mail,
  MapPin,
  Megaphone,
  MousePointerClick,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AdpadzButton } from '../components/adpadz-ui';
import { createInitialDemoWorkspaceState } from '../lib/demoWorkspace';
import './LandingPage.css';
import './LandingPageReadability.css';

const demo = createInitialDemoWorkspaceState();
const campaign = demo.campaigns[0];

type OutputKey = 'profile' | 'experience' | 'qr' | 'mailer' | 'social' | 'lead';

type Output = {
  key: OutputKey;
  icon: LucideIcon;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
};

const outputs: Output[] = [
  { key: 'profile', icon: Smartphone, label: 'Business profile', eyebrow: 'Always-on home', title: 'Your best business information stays ready.', description: 'Services, proof, contact paths, and active promotions live together in one polished public destination.', action: 'Customer taps Call' },
  { key: 'experience', icon: MousePointerClick, label: 'Interactive ad', eyebrow: 'Campaign moment', title: 'A promotion people can experience.', description: 'Reveal, scratch, compare, watch, or respond instead of scrolling past another static post.', action: 'Offer is revealed' },
  { key: 'qr', icon: QrCode, label: 'QR path', eyebrow: 'Physical to digital', title: 'Every printed piece can stay connected.', description: 'A branded QR path carries the same campaign from a counter card, mailer, sign, or receipt into action.', action: 'QR scan recorded' },
  { key: 'mailer', icon: Megaphone, label: 'Community mailer', eyebrow: 'Shared local reach', title: 'A neighborhood publication, powered by local businesses.', description: 'Campaign-ready content moves into cooperative print distribution without starting the work over.', action: 'Household discovers offer' },
  { key: 'social', icon: Mail, label: 'Social & email', eyebrow: 'Prepared to share', title: 'Channel-ready copy from the same source.', description: 'Adpadz prepares consistent social, email, and flyer content for the channels a business chooses to use.', action: 'Publishing handoff ready' },
  { key: 'lead', icon: Users, label: 'Lead & insight', eyebrow: 'Action returns', title: 'Customer response comes back with context.', description: 'Calls, claims, bookings, forms, and scans become one readable journey instead of unrelated reports.', action: 'Qualified lead arrives' },
];

const privacyPoints = [
  'People choose when to explore an offer',
  'No microphone listening or behavioral surveillance',
  'No feed designed to keep people trapped',
];

export default function LandingPage() {
  const [activeOutput, setActiveOutput] = useState<OutputKey>('experience');
  const [perspective, setPerspective] = useState<'business' | 'customer'>('business');
  const selectedOutput = outputs.find(output => output.key === activeOutput) ?? outputs[1];

  return (
    <div className="premium-landing">
      <header className="premium-nav">
        <div className="premium-nav__inner">
          <Link to="/" className="premium-brand" aria-label="Adpadz home">
            <img src="/brand/adpadz-logo.png" alt="" />
            <span>adpadz<span>.co</span></span>
          </Link>
          <nav aria-label="Main navigation">
            <a href="#journey">The journey</a>
            <a href="#for-everyone">How it works</a>
            <a href="#privacy">Our promise</a>
            <Link to="/examples">Examples</Link>
          </nav>
          <div className="premium-nav__actions">
            <Link to="/auth" className="premium-sign-in">Sign in</Link>
            <AdpadzButton href="/demo/workspace" size="md">Explore Adpadz <ArrowRight /></AdpadzButton>
          </div>
        </div>
      </header>

      <main>
        <section className="premium-hero">
          <div className="premium-hero__grain" aria-hidden="true" />
          <div className="premium-hero__layout">
            <div className="premium-hero__copy">
              <p className="premium-kicker"><span /> Local marketing, connected</p>
              <h1>Your promotion shouldn’t disappear after <em>one post.</em></h1>
              <p className="premium-hero__lead">Adpadz turns one clear campaign into a connected local customer journey—from discovery to response.</p>
              <div className="premium-hero__actions">
                <AdpadzButton href="/demo/workspace" size="lg">Experience a campaign <ArrowRight /></AdpadzButton>
                <Link to="/examples" className="premium-text-link">See real product examples <ArrowRight /></Link>
              </div>
              <div className="premium-hero__proof" aria-label="Adpadz product principles">
                <span><Check /> One campaign source</span>
                <span><Check /> Many connected outputs</span>
                <span><Check /> Customer action you can follow</span>
              </div>
            </div>

            <div className="premium-hero__story" aria-label="One campaign connecting to local customer experiences">
              <div className="hero-orbit hero-orbit--outer" aria-hidden="true" />
              <div className="hero-orbit hero-orbit--inner" aria-hidden="true" />
              <div className="hero-campaign">
                <span className="hero-campaign__tag"><Target /> Live campaign</span>
                <p>River City Outdoor Living</p>
                <strong>{campaign.title}</strong>
                <span className="hero-campaign__offer">{campaign.offer.title}</span>
              </div>
              <div className="hero-node hero-node--profile"><Smartphone /><span>Profile</span></div>
              <div className="hero-node hero-node--qr"><QrCode /><span>QR</span></div>
              <div className="hero-node hero-node--mailer"><Megaphone /><span>Mailer</span></div>
              <div className="hero-node hero-node--lead"><Users /><span>Lead</span></div>
              <img className="premium-hero__frog" src="/brand/adpadz-frog.webp" alt="The Adpadz frog guide standing confidently on a lily pad" />
              <div className="frog-note"><Sparkles /> Build it once. Let it travel.</div>
            </div>
          </div>
          <a className="premium-scroll-cue" href="#journey"><span>Follow one campaign</span><ArrowRight /></a>
        </section>

        <section className="campaign-ribbon" aria-label="Adpadz campaign flow">
          <div><span>01</span><strong>Build the business foundation</strong></div>
          <i />
          <div><span>02</span><strong>Create one campaign</strong></div>
          <i />
          <div><span>03</span><strong>Connect every response</strong></div>
        </section>

        <section id="journey" className="journey-section">
          <div className="section-heading section-heading--dark">
            <p className="premium-kicker"><span /> One source. Six useful forms.</p>
            <h2>Watch a campaign move through the neighborhood.</h2>
            <p>The content stays consistent. The experience changes to fit the moment.</p>
          </div>

          <div className="journey-workbench">
            <div className="journey-source">
              <div className="journey-source__top">
                <span>Campaign source</span>
                <b>Active</b>
              </div>
              <img src="/demo/river-city-hero.svg" alt="Fictional River City Outdoor Living campaign" />
              <div className="journey-source__body">
                <small>{demo.business.name}</small>
                <h3>{campaign.title}</h3>
                <p>{campaign.headline}</p>
                <div><CalendarDays /> Jun 15 – Sep 15</div>
              </div>
            </div>

            <div className="journey-selector" role="tablist" aria-label="Campaign output">
              {outputs.map(output => (
                <button
                  key={output.key}
                  type="button"
                  role="tab"
                  aria-selected={activeOutput === output.key}
                  className={activeOutput === output.key ? 'is-active' : ''}
                  onClick={() => setActiveOutput(output.key)}
                >
                  <output.icon />
                  <span>{output.label}</span>
                  <ArrowRight />
                </button>
              ))}
            </div>

            <article className={`journey-result journey-result--${selectedOutput.key}`} aria-live="polite">
              <div className="journey-result__signal"><selectedOutput.icon /></div>
              <p className="journey-result__eyebrow">{selectedOutput.eyebrow}</p>
              <h3>{selectedOutput.title}</h3>
              <p>{selectedOutput.description}</p>
              <div className="journey-result__event"><span /> {selectedOutput.action}</div>
              <div className="journey-result__footer">
                <small>Still powered by</small>
                <strong>{campaign.title}</strong>
              </div>
            </article>
          </div>
          <p className="sample-notice">Interactive product illustration using fictional sample data.</p>
        </section>

        <section id="for-everyone" className="perspective-section">
          <div className="perspective-section__intro">
            <p className="premium-kicker"><span /> Two sides. One local connection.</p>
            <h2>Useful for the business.<br />Enjoyable for the customer.</h2>
            <p>Most platforms optimize one side and make the other do the work. Adpadz connects both experiences by design.</p>
            <div className="perspective-toggle" role="group" aria-label="Choose a perspective">
              <button type="button" onClick={() => setPerspective('business')} className={perspective === 'business' ? 'is-active' : ''}><Building2 /> I’m a business</button>
              <button type="button" onClick={() => setPerspective('customer')} className={perspective === 'customer' ? 'is-active' : ''}><HeartHandshake /> I’m a customer</button>
            </div>
          </div>

          <div className={`perspective-card perspective-card--${perspective}`} aria-live="polite">
            {perspective === 'business' ? (
              <>
                <div className="perspective-card__number">01</div>
                <p className="perspective-card__eyebrow">Business workspace</p>
                <h3>Stop rebuilding the same promotion in five different places.</h3>
                <div className="perspective-steps">
                  <span><Target /> Create the campaign</span>
                  <span><Megaphone /> Choose its outputs</span>
                  <span><BarChart3 /> Follow customer action</span>
                </div>
                <div className="perspective-card__moment"><b>Next best step</b><p>Review 3 new leads from Summer Patio Transformation.</p><ArrowRight /></div>
              </>
            ) : (
              <>
                <div className="perspective-card__number">02</div>
                <p className="perspective-card__eyebrow">Customer experience</p>
                <h3>Find useful local offers when you actually want them.</h3>
                <div className="perspective-steps">
                  <span><MapPin /> Discover nearby</span>
                  <span><MousePointerClick /> Explore by choice</span>
                  <span><HeartHandshake /> Contact the business directly</span>
                </div>
                <div className="perspective-card__moment"><b>Offer revealed</b><p>{campaign.offer.title}</p><ArrowRight /></div>
              </>
            )}
          </div>
        </section>

        <section id="privacy" className="privacy-section">
          <div className="privacy-mark" aria-hidden="true"><Eye /><span /><ShieldCheck /></div>
          <div className="privacy-copy">
            <p className="premium-kicker"><span /> Respect is part of the product.</p>
            <h2>Seen by choice.<br /><em>Never by surveillance.</em></h2>
            <p>Adpadz is built for intentional local discovery—not the uneasy feeling that an app listened, followed, or predicted what someone was thinking.</p>
          </div>
          <div className="privacy-points">
            {privacyPoints.map(point => <div key={point}><Check /><span>{point}</span></div>)}
          </div>
        </section>

        <section className="guide-section">
          <div className="guide-section__image"><img src="/brand/adpadz-frog.webp" alt="Adpadz frog guide" /></div>
          <div className="guide-section__copy">
            <p className="premium-kicker"><span /> Your guide to Adpadz</p>
            <blockquote>“You bring the offer. Adpadz helps it go places.”</blockquote>
            <p>Try the complete journey as both the business owner and the customer. No account, no pressure, and no guessing what the product does.</p>
            <AdpadzButton href="/demo/workspace" size="lg">Open the guided demo <ArrowRight /></AdpadzButton>
            <span className="guide-section__note"><Check /> Safe fictional sandbox · Reset anytime</span>
          </div>
        </section>

        <section className="premium-final">
          <div>
            <p className="premium-kicker"><span /> Ready when the campaign is.</p>
            <h2>One clear promotion.<br />A connected local presence.</h2>
          </div>
          <div className="premium-final__actions">
            <AdpadzButton href="/demo/workspace" size="lg">Experience Adpadz <ArrowRight /></AdpadzButton>
            <Link to="/auth">Create your account</Link>
          </div>
        </section>
      </main>

      <footer className="premium-footer">
        <Link to="/" className="premium-brand"><img src="/brand/adpadz-logo.png" alt="" /><span>adpadz<span>.co</span></span></Link>
        <p>Helping local businesses grow. Helping communities thrive.</p>
        <div><Link to="/examples">Examples</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></div>
      </footer>
    </div>
  );
}
