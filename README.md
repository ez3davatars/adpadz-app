# Adpadz

Adpadz is a local advertising cooperative and marketing operating system for local businesses.

The product loop is:

1. A business stores permanent information and reusable assets in its Business Hub.
2. The business creates one Campaign as the source of promotional truth.
3. That Campaign powers interactive experiences, the public Business Profile, QR paths, community mailers, social/email copy, and print outputs.
4. Customer views, reveals, clicks, calls, claims, bookings, QR scans, and forms feed leads and analytics.

The governing product and engineering rules live in:

- docs/ADPADZ_PRODUCT_VISION.md
- docs/ADPADZ_ARCHITECTURE.md
- docs/ADPADZ_DESIGN_SYSTEM.md
- docs/ADPADZ_DECISION_RULES.md

## What works

- Email/password authentication, email verification guidance, and account recovery.
- Business Hub identity, shared assets, and business-owned services.
- Campaign create/edit/schedule/pause/archive with transactional output replacement.
- Interactive campaign discovery and real public campaign rendering.
- Business Profile/Smart Card builder and public profile experience.
- Offers, durable claim codes, booking requests, lead forms, services, gallery, media, documents, before/after, and testimonials.
- Dynamic QR Studio with persisted visual customization and scan tracking.
- Lead management, statuses, notes, copy/export, and booking-request handling.
- Real campaign/profile/lead/QR analytics.
- Campaign-derived publishing workspace for social, email, flyer, and community-mailer handoff.
- Public examples showcase and a no-sign-in, resettable guided sales demo.
- Optional private demo account with a protected one-click River City fixture reset.
- Installable PWA shell with bounded static/runtime caching.

Direct posting to third-party social or email accounts is intentionally unavailable until the business explicitly authorizes a supported provider. Adpadz prepares and persists the channel output without pretending it was externally published.

## Examples and demo workspace

Adpadz includes two complementary demonstration paths:

- `/examples` is the public product showcase for the fictional River City Outdoor Living business.
- `/demo/workspace` is a no-sign-in browser sandbox. Prospects can create a sample campaign, reveal an offer, simulate a QR scan, submit a fictional lead, change lead statuses, and see analytics update. The state is stored only in the current browser session and can be reset at any time.

All businesses, leads, imagery, testimonials, and performance figures in these routes are explicitly labeled as fictional sample data.

For owner-led presentations, the project also supports a real private Supabase demo account that uses the normal authenticated workspace and RLS. Apply all migrations first, then provide these server-side environment variables to the provisioning command:

    SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
    SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
    DEMO_ACCOUNT_EMAIL=YOUR_PRIVATE_DEMO_EMAIL
    DEMO_ACCOUNT_PASSWORD=YOUR_STRONG_PRIVATE_DEMO_PASSWORD

Run:

    npm run demo:provision

The command creates or updates only the dedicated demo Auth user, registers it privately, and loads a compact database-backed River City fixture. Its record counts intentionally differ from the broader illustrative totals in the public showcase. It always refuses to convert an existing non-demo account, so use a fresh email reserved for demonstrations. Never publish the credentials or put the service-role key in a `VITE_` variable.

## Stack

- React 18 + TypeScript
- Vite 8
- React Router
- Supabase Auth, Postgres, RLS, RPC, and Edge Functions
- Cloudflare Images integration for authenticated Smart Card image uploads
- Tailwind utility styling and the Adpadz component system
- Vitest

## Local setup

Requirements:

- Node.js 20.19 or newer (or Node.js 22.12 or newer)
- npm
- A Supabase project

Install:

    npm install

Create .env.local from .env.example:

    VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
    VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
    VITE_PUBLIC_APP_URL=http://localhost:5173

Never place a service-role key in a VITE_ variable.

Apply every migration in supabase/migrations in filename order. For a linked project with sufficient database privileges:

    npx supabase db push --include-all

The include-all flag is required when upgrading a project whose remote migration history already predates the added replay-safe foundation migration.

Start the app:

    npm run dev

## Verification

    npm run typecheck
    npm run lint
    npm test
    npm run build

The upload Edge Function can be checked separately:

    deno check supabase/functions/upload-smart-card-image/index.ts
    deno lint supabase/functions/upload-smart-card-image/index.ts
    deno fmt --check supabase/functions/upload-smart-card-image/index.ts

## Database notes

The migration history is self-contained for a fresh project. It includes:

- Legacy foundation tables referenced by the original migration history.
- Business Hub ownership and safe backfills.
- Smart Cards, QR links, leads, booking requests, and campaign outputs.
- Cross-tenant ownership enforcement and public-read date/output gates.
- Append-only campaign analytics events.
- Transactional Campaign and Smart Card bundle save RPCs.
- Persisted QR visual customization.
- Business-owned service library.

All public writes are validated against an active, published, or currently public parent record. Owner reads and writes remain restricted by RLS.

## Deployment

Run a production build and upload the contents of dist/ to the host:

    npm run build

For Apache/cPanel hosting and the PHP QR redirect fallback, follow SELF_HOSTING_DEPLOYMENT.md.

Cloudflare image upload configuration is documented in supabase/functions/upload-smart-card-image/README.md.
