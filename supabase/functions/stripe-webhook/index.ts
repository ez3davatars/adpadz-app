/// <reference lib="deno.ns" />
import { createClient } from 'npm:@supabase/supabase-js';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Use POST.', { status: 405 });
  const secret = (Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET') || '').trim();
  const url = (Deno.env.get('SUPABASE_URL') || '').trim();
  const service = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!secret || !url || !service) return new Response('Webhook is not configured.', { status: 500 });
  const rawBody = await request.text();
  if (!await validSignature(rawBody, request.headers.get('stripe-signature'), secret)) return new Response('Invalid signature.', { status: 400 });
  try {
    const event = JSON.parse(rawBody) as StripeEvent;
    const admin = createClient(url, service);
    const { error: ledgerError } = await admin.from('billing_webhook_events').insert({ stripe_event_id: event.id, event_type: event.type, payload: event });
    if (ledgerError?.code === '23505') return new Response('Already processed.', { status: 200 });
    if (ledgerError) throw ledgerError;
    if (event.type.startsWith('customer.subscription.')) await syncSubscription(admin, event.data.object);
    if (event.type === 'checkout.session.completed' && event.data.object.subscription) await syncSubscriptionById(admin, String(event.data.object.subscription));
    await admin.from('billing_webhook_events').update({ processed_at: new Date().toISOString() }).eq('stripe_event_id', event.id);
    return new Response('OK', { status: 200 });
  } catch (error) { console.error('Stripe webhook error', error); return new Response('Webhook processing failed.', { status: 500 }); }
});
type StripeEvent = { id: string; type: string; data: { object: Record<string, unknown> } };
async function syncSubscription(admin: any, subscription: Record<string, unknown>) {
  const customerId = String(subscription.customer || '');
  if (!customerId) return;
  const { data: customer } = await admin.from('billing_customers').select('owner_user_id').eq('stripe_customer_id', customerId).maybeSingle();
  if (!customer) return;
  const item = Array.isArray((subscription.items as { data?: unknown[] } | undefined)?.data) ? (subscription.items as { data: Record<string, unknown>[] }).data[0] : undefined;
  const price = item?.price as Record<string, unknown> | undefined;
  const status = normalizeStatus(String(subscription.status || 'inactive'));
  await admin.from('billing_subscriptions').upsert({ owner_user_id: customer.owner_user_id, stripe_customer_id: customerId, stripe_subscription_id: String(subscription.id || ''), stripe_price_id: typeof price?.id === 'string' ? price.id : null, plan_key: 'founding', status, cancel_at_period_end: subscription.cancel_at_period_end === true, current_period_end: unixToIso(subscription.current_period_end) });
}
async function syncSubscriptionById(_admin: any, _id: string) {
  // The subscription.created/updated event is the authoritative event and will
  // normally arrive with Checkout completion. This avoids trusting browser data.
}
function normalizeStatus(value: string) { return ['trialing','active','past_due','canceled','unpaid','paused'].includes(value) ? value : 'inactive'; }
function unixToIso(value: unknown) { return typeof value === 'number' ? new Date(value * 1000).toISOString() : null; }
async function validSignature(body: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map(value => value.split('=', 2)).filter(([key, value]) => key && value));
  const timestamp = Number(parts.t); const signature = parts.v1;
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`)));
  const expected = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(expected, signature);
}
function timingSafeEqual(left: string, right: string) { if (left.length !== right.length) return false; let result = 0; for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index); return result === 0; }
