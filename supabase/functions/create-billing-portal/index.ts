/// <reference lib="deno.ns" />
import { createClient } from 'npm:@supabase/supabase-js';

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  try {
    const url = (Deno.env.get('SUPABASE_URL') || '').trim();
    const anon = (Deno.env.get('SUPABASE_ANON_KEY') || '').trim();
    const service = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
    const stripeKey = (Deno.env.get('STRIPE_SECRET_KEY') || '').trim();
    const appUrl = (Deno.env.get('APP_URL') || '').trim().replace(/\/$/, '');
    if (!url || !anon || !service || !stripeKey || !appUrl) throw new Error('Billing is not configured yet.');
    const client = createClient(url, anon, { global: { headers: { Authorization: request.headers.get('Authorization') || '' } } });
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return json({ error: 'Sign in before managing billing.' }, 401);
    const admin = createClient(url, service);
    const { data: customer, error } = await admin.from('billing_customers').select('stripe_customer_id').eq('owner_user_id', auth.user.id).maybeSingle();
    if (error || !customer) return json({ error: 'Start a subscription before opening billing management.' }, 400);
    const form = new URLSearchParams({ customer: customer.stripe_customer_id, return_url: `${appUrl}/app/business/billing` });
    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', { method: 'POST', headers: { Authorization: `Bearer ${stripeKey}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
    const body = await response.json() as { url?: string; error?: { message?: string } };
    if (!response.ok || !body.url) throw new Error(body.error?.message || 'Stripe could not open the billing portal.');
    return json({ url: body.url });
  } catch (error) { console.error('Billing portal error', error); return json({ error: error instanceof Error ? error.message : 'Could not open billing management.' }, 500); }
});
function json(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }
