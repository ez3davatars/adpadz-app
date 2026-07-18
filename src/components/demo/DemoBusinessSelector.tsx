import { ArrowRight, Building2, MapPin, Sparkles } from 'lucide-react';
import AdpadzBrand from '../AdpadzBrand';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzGradient } from '../adpadz-ui';
import { DEMO_BUSINESS_PRESETS } from '../../lib/demoPresets';

type DemoBusinessSelectorProps = {
  onSelect: (businessSlug: string) => void;
};

export default function DemoBusinessSelector({ onSelect }: DemoBusinessSelectorProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070907] px-4 py-10 text-white sm:px-6 sm:py-16">
      <AdpadzGradient opacity={0.12} />
      <div className="relative mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <AdpadzBrand />
          <AdpadzBadge variant="local"><Sparkles className="h-3.5 w-3.5" /> Guided experience</AdpadzBadge>
        </div>

        <section className="mx-auto max-w-4xl py-16 text-center sm:py-24">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-neon">Six fictional local business stories</p>
          <h1 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-6xl lg:text-7xl">Choose a business to experience.</h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-neutral-300 sm:text-lg">
            Follow one believable challenge from neighborhood discovery through campaign engagement, booking, and lead follow-up.
          </p>
        </section>

        <section aria-label="Fictional business experiences" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {DEMO_BUSINESS_PRESETS.map(preset => (
            <AdpadzCard key={preset.slug} variant={preset.flagship ? 'featured' : 'standard'} className="group flex min-h-[29rem] flex-col p-0">
              <div className="relative h-40 overflow-hidden">
                <img src={preset.heroImage} alt="" className="h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-[1.03]" />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/15 to-transparent" />
                <span className="absolute left-4 top-4 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-black" style={{ background: preset.accent }}>
                  {preset.flagship ? 'Flagship experience' : preset.industry}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06]" style={{ color: preset.accent }}><Building2 className="h-5 w-5" /></span>
                  <div>
                    <h2 className="text-xl font-black">{preset.business.name}</h2>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400"><MapPin className="h-3.5 w-3.5" /> {preset.business.location}</p>
                  </div>
                </div>
                <div className="mt-5 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: preset.accent }}>The business challenge</p>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-300">{preset.challenge}</p>
                  <p className="mt-4 text-xs leading-relaxed text-neutral-500">{preset.outcome}</p>
                </div>
                <AdpadzButton type="button" onClick={() => onSelect(preset.slug)} fullWidth className="mt-6" gradient={`linear-gradient(135deg, ${preset.accent}, #b6ff00)`}>
                  Experience this business <ArrowRight className="h-4 w-4" />
                </AdpadzButton>
              </div>
            </AdpadzCard>
          ))}
        </section>

        <p className="mt-8 text-center text-xs text-neutral-500">Every business, customer, campaign, and engagement metric shown here is fictional sample data.</p>
      </div>
    </main>
  );
}
