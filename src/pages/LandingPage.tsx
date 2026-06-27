import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Zap, BarChart3, Target, Smartphone,
  ArrowRight, Sparkles, TrendingUp, Users,
  Menu, X, Play
} from 'lucide-react';

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'backdrop-blur-xl border-b' : ''}`}
        style={scrolled ? { background: 'rgba(5,5,5,0.9)', borderColor: 'var(--border-subtle)' } : {}}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-neon flex items-center justify-center">
                <span className="text-black font-black text-sm">A</span>
              </div>
              <span className="font-bold text-lg">adpadz<span className="text-neon">.co</span></span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-[var(--text-secondary)] hover:text-neon transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm text-[var(--text-secondary)] hover:text-neon transition-colors">How It Works</a>
              <Link to="/feed" className="text-sm text-[var(--text-secondary)] hover:text-neon transition-colors">Explore</Link>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link to="/auth" className="text-sm text-[var(--text-secondary)] hover:text-white px-4 py-2 transition-colors">Log In</Link>
              <Link to="/auth" className="btn-primary text-sm px-5 py-2">Get Started</Link>
            </div>

            <button className="md:hidden text-white" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-b px-4 py-4 space-y-3" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
            <a href="#features" className="block text-sm text-[var(--text-secondary)]">Features</a>
            <a href="#how-it-works" className="block text-sm text-[var(--text-secondary)]">How It Works</a>
            <Link to="/feed" className="block text-sm text-[var(--text-secondary)]">Explore</Link>
            <hr className="border-[var(--border-subtle)]" />
            <Link to="/auth" className="btn-primary w-full text-sm py-2.5">Get Started</Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-neon/[0.03] rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-neon/[0.02] rounded-full blur-[80px]" />
        </div>
        <div className="max-w-7xl mx-auto relative text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neon/[0.08] border border-neon/20 mb-8">
            <Sparkles className="w-4 h-4 text-neon" />
            <span className="text-xs text-neon font-medium">AI-Powered Interactive Ads</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black leading-[1.05] mb-6">
            <span className="text-white">Create. Publish. </span>
            <span className="gradient-text">Grow.</span>
            <br />
            <span className="text-white">Local ads that </span>
            <span className="gradient-text">work.</span>
          </h1>

          <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed">
            AI-powered interactive ads for local businesses. Scratch-offs, tap-to-reveal deals,
            and dynamic promotions that captivate your audience.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth" className="btn-primary text-base px-8 py-4">
              Start Creating Free <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/feed" className="btn-secondary text-base px-8 py-4">
              <Play className="w-5 h-5" /> Explore Ads
            </Link>
          </div>

          {/* Hero Visual */}
          <div className="mt-16 relative max-w-5xl mx-auto">
            <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[var(--bg-base)] to-transparent z-10 pointer-events-none" />
            <div className="rounded-2xl border p-1.5" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
              <div className="rounded-xl p-6 sm:p-8" style={{ background: 'var(--bg-card)' }}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { icon: Sparkles, label: 'Scratch & Win', sub: '20% OFF', featured: false },
                    { icon: Zap, label: 'Tap to Reveal', sub: "Today's Special!", featured: true },
                    { icon: Target, label: 'Before & After', sub: 'See Results', featured: false },
                  ].map(card => (
                    <div
                      key={card.label}
                      className={`rounded-2xl p-5 text-center border transition-all ${
                        card.featured
                          ? 'bg-neon/[0.06] border-neon/30 shadow-[var(--glow-sm)]'
                          : 'bg-[var(--bg-input)] border-[var(--border-subtle)]'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center ${card.featured ? 'bg-neon/15 border border-neon/30' : 'bg-[var(--bg-hover)]'}`}>
                        <card.icon className={`w-7 h-7 ${card.featured ? 'text-neon' : 'text-[var(--text-muted)]'}`} />
                      </div>
                      <h4 className={`font-bold text-sm mb-0.5 ${card.featured ? 'text-neon' : ''}`}>{card.label}</h4>
                      <p className="text-xs text-[var(--text-muted)]">{card.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 border-y" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { value: '10x', label: 'Higher Engagement' },
            { value: '87%', label: 'Interaction Rate' },
            { value: '12K+', label: 'Businesses Served' },
            { value: '3.2M', label: 'Ads Delivered' },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-black gradient-text mb-1">{stat.value}</div>
              <div className="text-xs text-[var(--text-muted)]">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Everything to <span className="gradient-text">dominate</span> local advertising
            </h2>
            <p className="text-[var(--text-secondary)] text-sm max-w-xl mx-auto">
              From AI-powered creation to real-time analytics.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(f => (
              <div key={f.title} className="card-surface p-5 group hover:border-[var(--border-neon)] transition-all">
                <div className="w-10 h-10 rounded-xl bg-neon/10 flex items-center justify-center mb-3 group-hover:bg-neon/20 transition-colors">
                  <f.icon className="w-5 h-5 text-neon" />
                </div>
                <h3 className="text-sm font-semibold mb-1.5">{f.title}</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: 'var(--bg-surface)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Three steps to <span className="gradient-text">explosive growth</span>
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">Launch your first campaign in under 5 minutes.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={s.title} className="relative">
                <div className="text-5xl font-black text-neon/[0.08] absolute -top-3 -left-1">{String(i + 1).padStart(2, '0')}</div>
                <div className="relative pt-7 pl-3">
                  <h3 className="text-base font-bold mb-2">{s.title}</h3>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="card-glass glow-border p-10 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to grow your business?</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
              Join AdPadz and start reaching customers with interactive ads that convert.
            </p>
            <Link to="/auth" className="btn-primary text-base px-10 py-4">
              Get Started Free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10 px-4 sm:px-6 lg:px-8" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neon flex items-center justify-center">
              <span className="text-black font-black text-xs">A</span>
            </div>
            <span className="font-bold text-sm">adpadz<span className="text-neon">.co</span></span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">&copy; 2026 AdPadz. Helping local businesses grow.</p>
          <div className="flex gap-4 text-xs text-[var(--text-muted)]">
            <a href="#" className="hover:text-neon transition-colors">Privacy</a>
            <a href="#" className="hover:text-neon transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  { icon: Sparkles, title: 'AI Ad Creator', description: 'Describe your promotion and our AI generates stunning interactive ads in seconds.' },
  { icon: Smartphone, title: 'Interactive Formats', description: 'Scratch-offs, tap-to-reveal, before/after — ads people want to engage with.' },
  { icon: BarChart3, title: 'Real-Time Analytics', description: 'Track impressions, engagement, conversions, and ROI on a live dashboard.' },
  { icon: Target, title: 'Local Targeting', description: 'Reach customers in your service area with geo-targeted campaigns.' },
  { icon: TrendingUp, title: 'AI Optimization', description: 'Campaigns auto-optimize for maximum engagement and conversions.' },
  { icon: Users, title: 'Audience Insights', description: 'Understand who interacts with your ads and build profiles over time.' },
];

const steps = [
  { title: 'Create Your Ad', description: 'Use our AI builder or choose templates. Add offers, images, and branding in minutes.' },
  { title: 'Publish & Target', description: 'Set audience, budget, and location. Launch with one click.' },
  { title: 'Watch It Grow', description: 'Monitor real-time engagement and let AI optimize automatically.' },
];
