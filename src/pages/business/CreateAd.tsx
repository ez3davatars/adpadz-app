import { useState } from 'react';
import { Zap, MousePointerClick, ArrowUpRight, Check, Eye, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type AdType = 'tap_reveal' | 'scratch' | 'before_after' | 'swipe';

const types: { id: AdType; label: string; desc: string; icon: any }[] = [
  { id: 'tap_reveal', label: 'Tap to Reveal', desc: 'Users tap to uncover your offer', icon: Zap },
  { id: 'scratch', label: 'Scratch Off', desc: 'Interactive scratch card', icon: MousePointerClick },
  { id: 'before_after', label: 'Before / After', desc: 'Swipe to compare images', icon: ArrowUpRight },
];

export default function BizCreateAd() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [adType, setAdType] = useState<AdType>('tap_reveal');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [ctaText, setCtaText] = useState('Claim Offer');
  const [offerText, setOfferText] = useState('');
  const [tone, setTone] = useState('friendly');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold">Create New Ad</h1>
        <p className="text-sm text-[var(--text-muted)] mt-0.5">Build an interactive ad in minutes</p>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {['Format', 'Content', 'Review'].map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1 rounded-full transition-colors ${i + 1 <= step ? 'bg-neon' : 'bg-[var(--bg-input)]'}`} />
            <p className={`text-[10px] mt-1 ${i + 1 <= step ? 'text-neon' : 'text-[var(--text-muted)]'}`}>{s}</p>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <h2 className="text-base font-semibold mb-4">Choose ad format</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {types.map(t => (
              <button
                key={t.id}
                onClick={() => setAdType(t.id)}
                className={`p-5 rounded-2xl border text-left transition-all hover:scale-[1.02] ${
                  adType === t.id ? 'border-neon bg-neon/5' : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${adType === t.id ? 'bg-neon/20' : 'bg-[var(--bg-input)]'}`}>
                  <t.icon className={`w-5 h-5 ${adType === t.id ? 'text-neon' : 'text-[var(--text-muted)]'}`} />
                </div>
                <p className={`text-sm font-semibold ${adType === t.id ? 'text-neon' : ''}`}>{t.label}</p>
                <p className="text-xs text-[var(--text-muted)] mt-1">{t.desc}</p>
                {adType === t.id && <Check className="w-4 h-4 text-neon mt-2" />}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(2)} className="btn-primary text-sm px-6 py-3">Continue</button>
        </div>
      )}

      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-base font-semibold mb-2">Ad Content</h2>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Headline</label>
              <input value={headline} onChange={e => setHeadline(e.target.value)} placeholder="TODAY'S SPECIAL!" className="input-field" maxLength={60} />
              <span className="text-[10px] text-[var(--text-muted)]">{headline.length}/60</span>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Tap to reveal your exclusive deal..." className="input-field resize-none" rows={3} maxLength={160} />
              <span className="text-[10px] text-[var(--text-muted)]">{description.length}/160</span>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Offer Text (revealed)</label>
              <input value={offerText} onChange={e => setOfferText(e.target.value)} placeholder="25% OFF your next order" className="input-field" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">CTA Button</label>
                <input value={ctaText} onChange={e => setCtaText(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="text-xs font-medium text-[var(--text-secondary)] mb-1.5 block">Tone</label>
                <select value={tone} onChange={e => setTone(e.target.value)} className="input-field">
                  <option value="friendly">Friendly</option>
                  <option value="professional">Professional</option>
                  <option value="playful">Playful</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(1)} className="btn-secondary text-sm px-5 py-2.5">Back</button>
              <button onClick={() => setStep(3)} disabled={!headline} className="btn-primary text-sm px-5 py-2.5 disabled:opacity-50">Preview</button>
            </div>
          </div>

          {/* Phone preview */}
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-neon" /> Live Preview
            </p>
            <PhonePreview headline={headline} description={description} offerText={offerText} ctaText={ctaText} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-base font-semibold mb-4">Review & Publish</h2>
            <div className="card-surface p-5 space-y-3 text-sm">
              <Row label="Format" value={types.find(t => t.id === adType)?.label || ''} />
              <Row label="Headline" value={headline || '(empty)'} />
              <Row label="Offer" value={offerText || '(empty)'} />
              <Row label="CTA" value={ctaText} />
              <Row label="Tone" value={tone} />
              <Row label="Status" value="Ready to publish" highlight />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setStep(2)} className="btn-secondary text-sm px-5 py-2.5">Back</button>
              <button
                onClick={() => navigate('/app/business/dashboard')}
                className="btn-primary text-sm px-6 py-3"
              >
                <Sparkles className="w-4 h-4" /> Publish Ad
              </button>
            </div>
          </div>
          <PhonePreview headline={headline} description={description} offerText={offerText} ctaText={ctaText} />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--text-muted)]">{label}</span>
      <span className={`font-medium ${highlight ? 'text-neon' : ''}`}>{value}</span>
    </div>
  );
}

function PhonePreview({ headline, description, offerText, ctaText }: { headline: string; description: string; offerText: string; ctaText: string }) {
  return (
    <div className="flex justify-center">
      <div className="w-[260px] rounded-[36px] border-[3px] border-[var(--border-default)] overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
        <div className="h-5 flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
          <div className="w-14 h-2.5 rounded-full bg-[var(--border-default)]" />
        </div>
        <div className="p-4 min-h-[420px] flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-neon/15 border border-neon/30 flex items-center justify-center mb-5 animate-glow-pulse">
            <Zap className="w-8 h-8 text-neon" />
          </div>
          <p className="text-[10px] text-neon uppercase tracking-widest font-medium mb-2">Tap to Reveal</p>
          <h3 className="text-base font-bold mb-1.5">{headline || 'Your Headline'}</h3>
          <p className="text-[10px] text-[var(--text-secondary)] mb-5 px-4 leading-relaxed">
            {description || 'Description goes here'}
          </p>
          {offerText && (
            <div className="px-4 py-2 rounded-lg bg-neon/10 border border-neon/20 mb-4">
              <p className="text-xs text-neon font-semibold">{offerText}</p>
            </div>
          )}
          <button className="px-5 py-2 rounded-full bg-neon text-black text-xs font-semibold">
            {ctaText || 'Learn More'}
          </button>
        </div>
        <div className="h-1 w-1/3 mx-auto bg-[var(--border-default)] rounded-full mb-3" />
      </div>
    </div>
  );
}
