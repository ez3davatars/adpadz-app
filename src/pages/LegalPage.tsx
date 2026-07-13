import { Link, useLocation } from 'react-router-dom';
import {
  ArrowLeft, ArrowUpRight, Briefcase, CheckCircle2, FilePenLine,
  Handshake, ShieldCheck, Sparkles, UserRound, Waypoints,
} from 'lucide-react';
import './LegalPage.css';

type LegalSection = {
  title: string;
  icon: typeof UserRound;
  body: string;
  points?: string[];
};

const termsSections: LegalSection[] = [
  { title: 'Using Adpadz', icon: UserRound, body: 'You may use Adpadz only for lawful business purposes. You are responsible for your account, your login credentials, and the accuracy of the information you provide.' },
  { title: 'Your content', icon: FilePenLine, body: 'You are solely responsible for all content you publish through Adpadz, including advertisements, offers, pricing, images, logos, descriptions, links, QR destinations, schedules, promotions, and customer communications.', points: ['You represent that you have the legal right to use all content you upload and that your content complies with applicable laws.'] },
  { title: 'Business responsibility', icon: Briefcase, body: 'You are solely responsible for your business practices, products, services, pricing, promotions, customer interactions, and any representations you make to customers.', points: ['Adpadz does not verify the accuracy or legality of your content or business activities.'] },
  { title: 'Customer information', icon: ShieldCheck, body: 'You are responsible for collecting, storing, and using customer information in compliance with applicable privacy, consumer-protection, marketing, and data-protection laws.' },
  { title: 'Third-party services', icon: Waypoints, body: 'If you connect Adpadz with websites, social media platforms, payment providers, booking systems, email services, or other third-party services, your use of those services is governed by their own terms and policies.', points: ['Adpadz is not responsible for third-party services or their availability.'] },
  { title: 'Availability', icon: Sparkles, body: 'Adpadz may update, modify, suspend, or discontinue features at any time.', points: ['We may suspend or terminate accounts that violate these Terms or misuse the platform.'] },
  { title: 'No guaranteed results', icon: ArrowUpRight, body: 'Adpadz provides marketing tools and reporting only.', points: ['Marketing results vary based on many factors outside our control, including your business, pricing, offer, audience, competition, and market conditions.', 'Adpadz does not guarantee leads, bookings, sales, revenue, engagement, or any specific business outcome.'] },
  { title: 'Limitation of responsibility', icon: ShieldCheck, body: 'You are responsible for your use of Adpadz and the content you publish.', points: ['To the maximum extent permitted by applicable law, Adpadz is not responsible for business losses, lost profits, lost customers, indirect damages, claims arising from your use of the platform, your marketing campaigns, your business practices, or third-party services.'] },
  { title: 'Acceptance', icon: Handshake, body: 'By creating an account or using Adpadz, you agree to these Terms of Use.' },
];

const privacySections: LegalSection[] = [
  { title: 'Information Adpadz processes', icon: UserRound, body: 'Account details, business profile content, campaign content, uploaded asset metadata, submitted leads, and interaction events such as views, clicks, QR scans, bookings, and offer actions.' },
  { title: 'How information is used', icon: Sparkles, body: 'To authenticate users, operate the Business Hub and Campaign Engine, publish selected customer experiences, deliver leads to the relevant business, protect the service, and provide performance analytics.' },
  { title: 'Public business content', icon: FilePenLine, body: 'A business chooses which Business Profiles, campaigns, offers, contact details, and assets are published. Published content can be viewed by anyone with the page or QR link.' },
  { title: 'Service providers', icon: Waypoints, body: 'Adpadz relies on infrastructure providers such as Supabase and, when configured by the business, image delivery or external publishing providers. Each provider processes only the information needed to deliver its service.' },
  { title: 'Retention and choices', icon: Briefcase, body: 'Businesses can update or unpublish their content and manage captured leads inside the app. Operational records may be retained for security, legal, backup, and reporting needs.' },
  { title: 'Security', icon: ShieldCheck, body: 'Adpadz uses authenticated access and database row-level policies to separate business-owned information. No online service can guarantee absolute security.' },
];

export default function LegalPage() {
  const { pathname } = useLocation();
  const privacy = pathname === '/privacy';
  const title = privacy ? 'Privacy Notice' : 'Terms of Use';
  const sections = privacy ? privacySections : termsSections;

  return (
    <div className="legal-page">
      <div className="legal-shell">
        <header className="legal-topbar">
          <Link to="/" className="legal-back"><ArrowLeft size={15} /> Back to Adpadz</Link>
          <span className="legal-owner">Hobo's With Tools, LLC</span>
        </header>

        <main className="legal-content">
          <section className="legal-hero">
            <img src="/brand/adpadz-logo.png" alt="Adpadz" className="legal-brand" />
            <div className="legal-hero-copy">
              <h1 className="legal-title">{title}</h1>
              <p className="legal-date">Effective July 10, 2026</p>
              <div className="legal-rule" />
              <p className="legal-intro">{privacy ? 'This notice explains the information used to operate the Adpadz local-business marketing platform.' : 'These Terms of Use govern your use of the Adpadz local-business marketing platform.'}</p>
            </div>
            <img src="/brand/adpadz-frog.webp" alt="Adpadz frog mascot giving a thumbs up" className="legal-mascot" />
          </section>

          {sections.map((section, index) => {
            const Icon = section.icon;
            return (
              <section key={section.title} className="legal-card">
                <div className="legal-icon"><Icon size={34} strokeWidth={1.8} /></div>
                <div className="legal-card-copy">
                  <p className="legal-number">{String(index + 1).padStart(2, '0')}</p>
                  <h2 className="legal-heading">{section.title}</h2>
                  <p className="legal-body">{section.body}</p>
                  {section.points?.map(point => (
                    <p key={point} className="legal-point">
                      <CheckCircle2 className="legal-check" size={14} />
                      <span>{point}</span>
                    </p>
                  ))}
                </div>
              </section>
            );
          })}

          <footer className="legal-footer">
            <div className="legal-footer-brand">
              <img src="/brand/adpadz-logo.png" alt="Adpadz" className="legal-footer-logo" />
              <p className="legal-footer-tagline">Local Marketing. <span>Smarter. Simpler. Stronger.</span></p>
            </div>
            <Link to={privacy ? '/terms' : '/privacy'} className="legal-switch">Read {privacy ? 'Terms' : 'Privacy'} <ArrowUpRight size={12} /></Link>
          </footer>
        </main>
      </div>
    </div>
  );
}
