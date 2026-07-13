import { useEffect, useState, type ReactNode } from 'react';
import { Building2, Check, Loader2, LockKeyhole, Save, ShieldCheck, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzSection } from '../../components/adpadz-ui';

type BusinessRecord = {
  id: string;
  owner_user_id: string | null;
  name: string;
  slug: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  active: boolean;
};

type BusinessForm = {
  name: string;
  slug: string;
  description: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  active: boolean;
};

const emptyForm: BusinessForm = { name: '', slug: '', description: '', phone: '', email: '', website: '', address: '', active: true };

export default function BizSettings() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [form, setForm] = useState<BusinessForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBusinessHub() {
      setLoading(true);
      setError(null);
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw new Error(authError.message);
        const user = authData.user;
        if (!user) throw new Error('Sign in to load Business Settings.');
        if (!cancelled) {
          setOwnerId(user.id);
          setAccountEmail(user.email ?? '');
        }

        const { data: business, error: businessError } = await supabase.from('businesses').select('*').eq('owner_user_id', user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
        if (businessError) throw new Error(businessError.message);

        let record = business as BusinessRecord | null;
        if (!record) {
          const { data: card, error: cardError } = await supabase.from('business_cards').select('business_name,slug,bio,phone,email,website,address,is_published').eq('owner_user_id', user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
          if (cardError) throw new Error(cardError.message);
          if (card) {
            record = {
              id: '',
              owner_user_id: user.id,
              name: card.business_name,
              slug: card.slug,
              description: card.bio,
              phone: card.phone,
              email: card.email,
              website: card.website,
              address: card.address,
              active: card.is_published,
            };
          }
        }

        if (!cancelled && record) {
          setBusinessId(record.id || null);
          setForm(toForm(record));
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load Business Settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBusinessHub();
    return () => { cancelled = true; };
  }, []);

  function update<K extends keyof BusinessForm>(key: K, value: BusinessForm[K]) {
    setForm(current => ({ ...current, [key]: value }));
  }

  function updateName(value: string) {
    setForm(current => {
      const previousAutoSlug = slugify(current.name);
      return { ...current, name: value, slug: !current.slug || current.slug === previousAutoSlug ? slugify(value) : current.slug };
    });
  }

  async function saveBusinessHub() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      if (!ownerId) throw new Error('Sign in before saving Business Settings.');
      if (!form.name.trim()) throw new Error('Business name is required.');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) throw new Error('Business URL must use lowercase letters, numbers, and single hyphens.');
      const website = normalizeOptionalUrl(form.website);
      const payload = {
        owner_user_id: ownerId,
        name: form.name.trim(),
        slug: form.slug,
        description: form.description.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website,
        address: form.address.trim() || null,
        active: form.active,
      };

      const { data: savedId, error: saveError } = await supabase.rpc('save_business_hub', {
        p_business: payload,
        p_business_id: businessId,
      });
      if (saveError?.code === '40001' || saveError?.code === '40P01') {
        throw new Error('Business resources changed during this save. Try again to apply the latest state safely.');
      }
      if (saveError || typeof savedId !== 'string') throw new Error(saveError?.message ?? 'Could not save the Business Hub.');

      const { data: reloaded, error: reloadError } = await supabase.from('businesses').select('*').eq('id', savedId).single();
      if (reloadError || !reloaded) throw new Error(reloadError?.message ?? 'Could not verify Business Settings.');
      setBusinessId(savedId);
      setForm(toForm(reloaded as BusinessRecord));
      setMessage('Business Hub saved and connected to your existing profiles, campaigns, QR links, and assets.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save Business Settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Business Hub</p>
          <h1 className="text-2xl font-black">Business Settings</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">This permanent business record feeds profiles, campaigns, QR destinations, assets, and future outputs.</p>
        </div>
        <AdpadzButton type="button" onClick={() => void saveBusinessHub()} disabled={saving || loading} size="lg">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Business Hub</AdpadzButton>
      </div>

      {(error || message) && <AdpadzCard variant="flat" className={`p-4 text-sm font-bold ${error ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-neon/30 bg-neon/10 text-neon'}`} role={error ? 'alert' : 'status'}>{error || message}</AdpadzCard>}
      {loading ? <p className="flex items-center rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin text-neon" /> Loading Business Hub...</p> : (
        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <AdpadzSection eyebrow="Permanent information" title="Business identity" description="Campaigns reference these details instead of asking you to re-enter them.">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Business name" required><input value={form.name} onChange={event => updateName(event.target.value)} className="input-field" maxLength={160} /></Field>
              <Field label="Business URL" required><div className="flex items-center rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] pl-3"><span className="text-xs text-[var(--text-muted)]">adpadz.co/business/</span><input value={form.slug} onChange={event => update('slug', slugify(event.target.value))} className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm outline-none" maxLength={120} /></div></Field>
            </div>
            <Field label="Business description" className="mt-4"><textarea value={form.description} onChange={event => update('description', event.target.value)} className="input-field resize-y" rows={5} maxLength={5000} placeholder="What makes this local business worth choosing?" /></Field>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Phone"><input type="tel" value={form.phone} onChange={event => update('phone', event.target.value)} className="input-field" maxLength={64} /></Field>
              <Field label="Public email"><input type="email" value={form.email} onChange={event => update('email', event.target.value)} className="input-field" maxLength={320} /></Field>
              <Field label="Website"><input type="url" value={form.website} onChange={event => update('website', event.target.value)} className="input-field" maxLength={2048} placeholder="https://..." /></Field>
              <Field label="Address"><input value={form.address} onChange={event => update('address', event.target.value)} className="input-field" maxLength={1000} /></Field>
            </div>
            <label className="mt-5 flex items-start gap-3 rounded-2xl border border-[var(--border-default)] bg-[var(--bg-input)] p-4">
              <input type="checkbox" checked={form.active} onChange={event => update('active', event.target.checked)} className="mt-0.5 accent-lime-400" />
              <span><span className="block text-sm font-black">Business is active</span><span className="mt-1 block text-xs text-[var(--text-muted)]">Active businesses can publish customer experiences and accept public interactions.</span></span>
            </label>
          </AdpadzSection>

          <div className="space-y-4">
            <AdpadzCard variant="glass" className="p-6">
              <Building2 className="h-6 w-6 text-neon" />
              <h2 className="mt-4 text-lg font-black">One owner</h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">The Business Hub owns permanent information. Smart Cards display it. Campaigns own temporary promotions.</p>
              <div className="mt-5 flex flex-wrap gap-2"><AdpadzBadge variant="verified"><Check className="h-3.5 w-3.5" /> Single source</AdpadzBadge><AdpadzBadge variant="status">{businessId ? 'Connected' : 'Not saved'}</AdpadzBadge></div>
            </AdpadzCard>
            <AdpadzCard variant="flat" className="p-6">
              <User className="h-5 w-5 text-neon" />
              <h2 className="mt-3 text-sm font-black">Account owner</h2>
              <p className="mt-1 break-all text-xs text-[var(--text-muted)]">{accountEmail || 'Authenticated account'}</p>
            </AdpadzCard>
            <AdpadzCard variant="flat" className="p-6">
              <ShieldCheck className="h-5 w-5 text-neon" />
              <h2 className="mt-3 text-sm font-black">Ownership protected</h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Row-level policies keep this business, its cards, assets, campaigns, and outputs scoped to the authenticated owner.</p>
            </AdpadzCard>
            <AdpadzCard variant="flat" className="p-6">
              <LockKeyhole className="h-5 w-5 text-neon" />
              <h2 className="mt-3 text-sm font-black">Billing and team access</h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">No billing or team role is implied until those services are configured. Core campaign and Business Hub functionality does not fabricate an active subscription.</p>
            </AdpadzCard>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required = false, className = '', children }: { label: string; required?: boolean; className?: string; children: ReactNode }) {
  return <label className={`block ${className}`}><span className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">{label}{required ? ' *' : ''}</span>{children}</label>;
}

function toForm(record: BusinessRecord): BusinessForm {
  return {
    name: record.name || '',
    slug: record.slug || slugify(record.name),
    description: record.description || '',
    phone: record.phone || '',
    email: record.email || '',
    website: record.website || '',
    address: record.address || '',
    active: record.active !== false,
  };
}

function slugify(value: string): string {
  return value.toLocaleLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
}

function normalizeOptionalUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Website must be a complete address beginning with http:// or https://.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Website must use http:// or https://.');
  return parsed.toString();
}
