-- Stripe billing foundation for the Adpadz founding offer. Stripe is the
-- source of payment truth; these tables are a protected entitlement mirror for
-- the application. Browser clients can read only their own status.

CREATE TABLE IF NOT EXISTS public.billing_customers (
  owner_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE NOT NULL,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  owner_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL REFERENCES public.billing_customers(stripe_customer_id) ON DELETE CASCADE,
  stripe_subscription_id text UNIQUE,
  stripe_price_id text,
  plan_key text NOT NULL DEFAULT 'founding',
  status text NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  stripe_event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.billing_customers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.billing_subscriptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.billing_webhook_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.billing_customers TO authenticated;
GRANT SELECT ON public.billing_subscriptions TO authenticated;

DROP POLICY IF EXISTS billing_customers_owner_select ON public.billing_customers;
CREATE POLICY billing_customers_owner_select ON public.billing_customers
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

DROP POLICY IF EXISTS billing_subscriptions_owner_select ON public.billing_subscriptions;
CREATE POLICY billing_subscriptions_owner_select ON public.billing_subscriptions
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.billing_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billing_customers_set_updated_at ON public.billing_customers;
CREATE TRIGGER billing_customers_set_updated_at
  BEFORE UPDATE ON public.billing_customers
  FOR EACH ROW EXECUTE FUNCTION public.billing_set_updated_at();

DROP TRIGGER IF EXISTS billing_subscriptions_set_updated_at ON public.billing_subscriptions;
CREATE TRIGGER billing_subscriptions_set_updated_at
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.billing_set_updated_at();

COMMENT ON TABLE public.billing_customers IS
  'Server-managed Stripe customer mapping. No payment method data is stored in Supabase.';
COMMENT ON TABLE public.billing_webhook_events IS
  'Server-only idempotency ledger for verified Stripe webhook events.';
