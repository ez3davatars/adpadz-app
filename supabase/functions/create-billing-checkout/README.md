# Stripe billing functions

Deploy these functions after applying migration `20260711000300`:

```powershell
supabase functions deploy create-billing-checkout
supabase functions deploy create-billing-portal
supabase functions deploy stripe-webhook --no-verify-jwt
```

Set server-only function secrets from Stripe **test mode** first:

```powershell
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_PRICE_ID_FOUNDING_MONTHLY=price_...
supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...
supabase secrets set APP_URL=https://your-adpadz-domain.example
```

Create a recurring $19/month USD product/price named `Adpadz Founding` in
Stripe. Configure Stripe Customer Portal in test mode, then add a webhook to:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`

Subscribe the webhook to: `checkout.session.completed`,
`customer.subscription.created`, `customer.subscription.updated`, and
`customer.subscription.deleted`.

Never use a `VITE_` prefix for Stripe secret keys or webhook signing secrets.
