# Adpadz billing and pricing

This is the launch pricing model for Adpadz, a service produced by Hobo's With
Tools, LLC. It is a planning document, not customer-facing terms or a promise
of a particular platform feature.

## Current product and cost boundary

Today, a paid Adpadz customer can use the Business Hub, Smart Cards, QR Studio,
campaign creation, public campaign/QR experiences, lead capture, analytics,
campaign content preparation, and export/copy-ready social and email content.

Adpadz does **not** currently auto-publish to social networks, send customer
marketing email, generate AI content through a paid API, or host customer
video. Do not charge for those future services until they exist and their
per-customer usage limits are defined.

## What one active customer costs

At launch, infrastructure is mostly a shared platform cost—not a large
per-customer charge. The exact total also depends on the chosen web host,
domain renewals, taxes, support time, and any paid plugins.

| Cost area | Current cost model | Planning treatment |
| --- | --- | --- |
| Supabase production | Pro starts at $25/month and includes one Micro compute instance, 100,000 MAUs, 8 GB database, 100 GB storage, and 250 GB egress. | Shared fixed launch cost. |
| Cloudflare Images | Stored images cost $5 per 100,000 images/month; delivery is $1 per 100,000 images. | Usually negligible at launch, but monitor it. |
| App/static/QR hosting | Depends on the hosting account selected by Hobo's With Tools, LLC. | Add the actual monthly invoice. |
| Auth/transactional email | Use a production SMTP provider before launch. Resend is $0 for up to 3,000 emails/month, then $20/month for 50,000. | Start free or include in shared overhead. |
| Card collection | Stripe's standard domestic online card fee is 2.9% + $0.30 per successful payment. | Variable cost on every subscription payment. |
| Direct social publishing | Not yet implemented. | Price separately only once active. |
| Support, sales, taxes, refunds | Varies with the business. | Do not mistake infrastructure margin for profit. |

Official current pricing: [Supabase](https://supabase.com/pricing),
[Cloudflare Images](https://developers.cloudflare.com/images/pricing/),
[Resend](https://resend.com/pricing), and [Stripe](https://stripe.com/pricing).

### Example launch economics

Assume $50/month in shared software costs for Supabase, images, a modest host,
and email. This deliberately excludes the owner's time, taxes, chargebacks,
and advertising.

| Customers | Price/customer | Monthly revenue | Stripe fees (approx.) | Shared software | Remaining before labor/tax |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | $49 | $490 | $17.21 | $50 | $422.79 |
| 10 | $59 | $590 | $20.11 | $50 | $519.89 |
| 25 | $59 | $1,475 | $50.28 | $50 | $1,374.72 |
| 50 | $79 | $3,950 | $129.55 | $50 | $3,770.45 |

Stripe estimate formula: `customers × (monthly price × 0.029 + 0.30)`.
Actual fees vary by payment method, country, refunds, disputes, and tax setup.

The conclusion is important: **infrastructure should not determine Adpadz's
launch price.** Customer value, support time, sales cost, and retention matter
far more. A local business that wins one qualified lead can justify a
substantially higher price than the platform's dollar-level hosting cost.

## Recommended launch offer

Start with one clearly understandable paid plan. Avoid a complex tier grid
before customer behavior is known.

### Adpadz Growth — $59/month

**Founding customer offer:** $49/month for the first 10–20 customers, locked
for 12 months while their account remains active.

Include:

- One business workspace and one primary business profile
- Smart Card and business landing experience
- QR Studio and QR destination management
- Campaign Studio, interactive campaign, mailer, flyer, social, and email
  content outputs
- Lead capture and campaign/QR analytics
- Image uploads within a fair-use limit
- One owner seat at launch
- Standard email support

Set an annual option only after month-to-month onboarding converts reliably:
**$590/year** (two months free) is a sensible later equivalent.

### Later add-ons, not launch plans

- Additional team seat: $15–$25/month
- Additional business/location: $25–$49/month
- Done-for-you campaign setup: one-time service fee
- Direct social publishing: $20–$40/month once it is live
- Email sending: usage-based or a separate marketing package after compliance
  and deliverability features exist
- High-volume image/video/analytics usage: quoted or metered overage

Do not list an "unlimited" plan. Use fair use and measurable limits once real
usage is observed.

## Billing product design

For the first implementation, use Stripe Checkout and Stripe Customer Portal.
They reduce PCI scope and let the customer manage their card, invoices,
upgrades, and cancellation without Adpadz handling card numbers.

### Required backend records

- `billing_customers`: business owner, Stripe customer ID, current status
- `subscriptions`: Stripe subscription/price IDs, billing period, cancel-at-
  period-end, plan entitlement snapshot
- `billing_events`: immutable, idempotent Stripe webhook event log
- `plan_entitlements`: the server-side feature/usage rules enforced by the app

### Required flows

1. User signs up and receives a time-limited trial or an account that is ready
   to check out.
2. User starts Stripe Checkout for the selected plan.
3. Stripe sends a signed webhook to a server-only endpoint.
4. The webhook, not the browser return page, activates or changes access.
5. The app reads server-backed entitlements before allowing paid actions.
6. The customer uses Stripe Customer Portal to update payment method, download
   invoices, or cancel.
7. Failed-payment and cancellation webhooks move the account through a clear
   grace/read-only/expired lifecycle.

Never trust a front-end `plan` field, and never expose Stripe secret keys or
webhook secrets in Vite environment variables.

## Decisions Hobo's With Tools, LLC should make before implementation

1. Confirm the launch plan price: recommended $59/month, with $49/month
   founding offer.
2. Choose whether there is a trial (recommended: 14 days, no card) or a paid
   demo/onboarding call instead.
3. Choose the initial customer limit: recommended one business, one owner seat.
4. Define the fair-use image limit and support response expectation.
5. Confirm the legal business address, support email, refund/cancellation
   policy, and tax setup for Stripe.
6. Create the Stripe account under Hobo's With Tools, LLC—not an individual.

## Before accepting payment

- Publish customer-facing pricing, Terms, Privacy Policy, and cancellation
  policy naming Hobo's With Tools, LLC as the provider of Adpadz.
- Configure a production transactional email provider for receipts and account
  messages.
- Use Stripe test mode for complete checkout, webhook, upgrade, cancellation,
  failure, and portal tests.
- Make billing status visible in account settings.
- Do not turn on live mode until entitlement enforcement and webhook verification
  are tested.
