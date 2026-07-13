import { useEffect, useState } from 'react';
import { Check, CreditCard, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AdpadzBadge, AdpadzButton, AdpadzCard, AdpadzSection } from '../../components/adpadz-ui';

type Subscription = { status: string; plan_key: string; cancel_at_period_end: boolean; current_period_end: string | null };

export default function BizBilling() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'checkout' | 'portal' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void load(); }, []);
  async function load() {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { setError('Sign in to view billing.'); setLoading(false); return; }
    const { data, error: loadError } = await supabase.from('billing_subscriptions').select('status,plan_key,cancel_at_period_end,current_period_end').eq('owner_user_id', auth.user.id).maybeSingle();
    if (loadError) setError(loadError.message); else setSubscription(data as Subscription | null);
    const result = new URLSearchParams(window.location.search).get('checkout');
    if (result === 'success') setMessage('Checkout completed. Your access will update as soon as Stripe confirms the subscription.');
    if (result === 'canceled') setMessage('Checkout was canceled. Nothing was charged.');
    setLoading(false);
  }
  async function openBilling(action: 'checkout' | 'portal') {
    setBusy(action); setError(null); setMessage(null);
    const { data, error: invokeError } = await supabase.functions.invoke(action === 'checkout' ? 'create-billing-checkout' : 'create-billing-portal');
    if (invokeError || !data?.url) { setError(data?.error || invokeError?.message || 'Billing could not be opened.'); setBusy(null); return; }
    window.location.assign(data.url as string);
  }
  const active = subscription?.status === 'active' || subscription?.status === 'trialing';
  return <div className="space-y-6">
    <div><p className="text-[11px] font-black uppercase tracking-[0.22em] text-neon">Billing</p><h1 className="text-2xl font-black">Simple, founder-friendly pricing</h1><p className="mt-1 max-w-2xl text-sm text-[var(--text-muted)]">One business workspace with the current Adpadz campaign, QR, lead, and content tools.</p></div>
    {(error || message) && <AdpadzCard variant="flat" className={`p-4 text-sm font-bold ${error ? 'border-red-400/30 bg-red-500/10 text-red-100' : 'border-neon/30 bg-neon/10 text-neon'}`} role={error ? 'alert' : 'status'}>{error || message}</AdpadzCard>}
    <AdpadzSection eyebrow="Founding offer" title="$19 per month" description="Cancel any time. Direct social publishing and customer email delivery are not included until those services are introduced.">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center"><div><div className="text-4xl font-black">$19<span className="text-base text-[var(--text-muted)]"> / month</span></div><ul className="mt-5 space-y-2 text-sm text-[var(--text-secondary)]">{['One business workspace and owner seat','Business Hub, Smart Cards, QR Studio, campaigns, leads, and analytics','Copy-ready social, mailer, flyer, and email outputs','Founding price is locked for 12 months while active'].map(item => <li key={item} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-neon" />{item}</li>)}</ul></div><AdpadzCard variant="glass" className="min-w-64 p-5"><CreditCard className="h-6 w-6 text-neon" /><p className="mt-3 text-sm font-black">{loading ? 'Checking subscription…' : active ? 'Founding subscription active' : 'Ready when you are'}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{subscription?.cancel_at_period_end && subscription.current_period_end ? `Ends ${new Date(subscription.current_period_end).toLocaleDateString()}.` : active ? 'Manage payment method, invoices, or cancellation securely through Stripe.' : 'Start securely with Stripe Checkout.'}</p><div className="mt-4">{active ? <AdpadzButton type="button" disabled={busy !== null} onClick={() => void openBilling('portal')} className="w-full">{busy === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />} Manage billing</AdpadzButton> : <AdpadzButton type="button" disabled={busy !== null || loading} onClick={() => void openBilling('checkout')} className="w-full">{busy === 'checkout' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Start founding plan</AdpadzButton>}</div></AdpadzCard></div>
    </AdpadzSection>
    <AdpadzCard variant="flat" className="p-5"><div className="flex gap-3"><ShieldCheck className="h-5 w-5 shrink-0 text-neon" /><div><h2 className="text-sm font-black">Secure billing</h2><p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">Adpadz never stores card numbers. Checkout, invoices, payment updates, and cancellation are handled by Stripe. Subscription access is confirmed by signed server-side Stripe events.</p></div>{subscription && <AdpadzBadge variant={active ? 'verified' : 'status'}>{subscription.status.replace('_', ' ')}</AdpadzBadge>}</div></AdpadzCard>
  </div>;
}
