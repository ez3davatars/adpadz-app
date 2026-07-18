/// <reference lib="deno.ns" />
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  try {
    const config = requiredConfig();
    const user = await authenticatedUser(request, config.supabaseUrl, config.supabaseAnonKey);
    if (user.app_metadata?.is_demo === true) return json({ error: 'Billing is disabled in the demo account.' }, 403);
    const admin = createClient(config.supabaseUrl, config.serviceRoleKey);
    const customerId = await ensureCustomer(admin, config, user.id, user.email || undefined);
    const form = new URLSearchParams({
      mode: 'subscription', customer: customerId,
      'line_items[0][price]': config.priceId, 'line_items[0][quantity]': '1',
      success_url: `${config.appUrl}/app/business/billing?checkout=success`,
      cancel_url: `${config.appUrl}/app/business/billing?checkout=canceled`,
      client_reference_id: user.id,
      'subscription_data[metadata][owner_user_id]': user.id,
      'metadata[owner_user_id]': user.id,
      allow_promotion_codes: 'true',
    });
    const session = await stripePost(config.stripeSecretKey, '/v1/checkout/sessions', form);
    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return json({ url: session.url });
  } catch (error) {
    console.error('Billing checkout error', error);
    return json({ error: error instanceof Error ? error.message : 'Could not start checkout.' }, 500);
  }
});

type Config = { supabaseUrl: string; supabaseAnonKey: string; serviceRoleKey: string; stripeSecretKey: string; priceId: string; appUrl: string };
function requiredConfig(): Config {
  const get = (name: string) => (Deno.env.get(name) || '').trim();
  const config = { supabaseUrl: get('SUPABASE_URL'), supabaseAnonKey: get('SUPABASE_ANON_KEY'), serviceRoleKey: get('SUPABASE_SERVICE_ROLE_KEY'), stripeSecretKey: get('STRIPE_SECRET_KEY'), priceId: get('STRIPE_PRICE_ID_FOUNDING_MONTHLY'), appUrl: get('APP_URL').replace(/\/$/, '') };
  if (Object.values(config).some(value => !value)) throw new Error('Billing is not configured yet.');
  return config;
}
async function authenticatedUser(request: Request, url: string, anon: string) {
  const supabase = createClient(url, anon, { global: { headers: { Authorization: request.headers.get('Authorization') || '' } } });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in before starting checkout.');
  return data.user;
}
async function ensureCustomer(admin: SupabaseClient, config: Config, ownerUserId: string, email?: string) {
  const { data: existing, error } = await admin.from('billing_customers').select('stripe_customer_id').eq('owner_user_id', ownerUserId).maybeSingle();
  if (error) throw new Error('Could not load billing customer.');
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;
  const form = new URLSearchParams({ 'metadata[owner_user_id]': ownerUserId });
  if (email) form.set('email', email);
  const customer = await stripePost(config.stripeSecretKey, '/v1/customers', form);
  if (!customer.id) throw new Error('Stripe did not return a customer ID.');
  const { error: saveError } = await admin.from('billing_customers').upsert({ owner_user_id: ownerUserId, stripe_customer_id: customer.id, email: email || null });
  if (saveError) throw new Error('Could not save billing customer.');
  return customer.id as string;
}
async function stripePost(key: string, path: string, form: URLSearchParams): Promise<Record<string, unknown>> {
  const response = await fetch(`https://api.stripe.com${path}`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof body.error === 'object' && body.error && 'message' in body.error ? String((body.error as { message?: string }).message) : 'Stripe request failed.');
  return body;
}
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
