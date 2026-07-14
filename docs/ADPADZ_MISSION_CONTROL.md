# Adpadz Mission Control

Mission Control is Adpadz's internal operations application. It gives trusted staff a cross-account operational view without adding staff controls to the customer-facing Business Hub. Phase 1 establishes authentication, server-enforced authorization, a dedicated command-center shell, and a read-only dashboard backed by real database records.

Mission Control and the Business Hub share the project's Supabase Auth session, but they do not share authorization rules, layouts, or data-access helpers. A valid customer session never grants Mission Control access by itself.

## Routes

| Route | Purpose |
| --- | --- |
| `/admin/login` | Internal email/password login; there is no public admin registration. |
| `/admin` | Resolves to the correct destination for the current authentication and authorization state. |
| `/admin/dashboard` | Protected Phase 1 operations dashboard. |
| `/admin/access-denied` | Safe destination for an authenticated account without active admin membership. |

Expected routing decisions:

- An active authorized admin visiting `/admin`, `/admin/login`, or `/admin/access-denied` is sent to `/admin/dashboard`.
- An unauthenticated visitor to a protected admin route is sent to `/admin/login`.
- An authenticated user without active valid membership is sent to `/admin/access-denied`.
- A verification or network failure is shown as a retryable error. It is not silently treated as either authorization or a zero-data dashboard.
- Mission Control sign-out ends the shared Supabase session and returns to `/admin/login`.

Local development URLs, with Vite's default port, are:

```text
http://localhost:5173/admin/login
http://localhost:5173/admin
http://localhost:5173/admin/dashboard
http://localhost:5173/admin/access-denied
```

## Separation from the Business Hub

| Mission Control | Business Hub |
| --- | --- |
| Internal Adpadz staff operations | A business customer's own workspace |
| Requires an active `admin_users` record | Requires a normal authenticated customer session |
| Uses dedicated `/admin/*` pages, components, and data helpers | Uses the customer-facing business routes and layouts |
| Reads sanitized cross-tenant summaries through narrow RPCs | Reads and writes tenant-owned records through existing RLS policies |
| No public registration or in-browser role management | Normal customer authentication and product workflows |

Do not add Mission Control controls to Business Hub components. New internal modules should remain under the admin component, page, and library namespaces.

## Role model

`public.admin_users` is keyed to `auth.users.id` and accepts only these roles:

| Role | Intended scope |
| --- | --- |
| `owner` | Highest-level internal owner; future administrator management and policy decisions. |
| `admin` | Broad internal operations administration. |
| `sales` | Future CRM and advertiser workflows. |
| `creative` | Future asset, proof, and approval workflows. |
| `finance` | Future payment and campaign-economics workflows. |
| `support` | Future support and account-assistance workflows. |

In Phase 1, every active supported role may view the dashboard. The roles are durable authorization inputs, not decorative client state. Future modules must enforce role-specific permissions on the server as well as in navigation. `owner` is the highest role, but there is deliberately no Phase 1 browser UI or browser grant for creating, changing, or deleting administrators.

Membership is fail-closed:

- `role` has no default and is restricted by a database check constraint.
- `active` defaults to `false`; activation must be explicit.
- `display_name` is required and cannot be blank.
- deactivating or deleting the membership immediately makes the authorization RPC return `false`.

## Security and authorization flow

The browser uses only `VITE_SUPABASE_URL` and the frontend-safe anon/publishable key. Never put a Supabase service-role key in a `VITE_*` variable or browser bundle.

The protected flow is:

1. Supabase Auth verifies the session and user.
2. The admin guard calls `public.is_adpadz_admin()` using the authenticated JWT identity.
3. The function returns `true` only when its argument is the current `auth.uid()` and that user has an active, valid `admin_users` row.
4. RLS permits an authenticated user to read only their own active admin profile.
5. The dashboard calls two narrow, read-only RPCs. Those RPCs repeat the active-admin check before reading operational data.

Authorization never uses local storage flags, query parameters, editable Auth metadata, email domains, or hard-coded email addresses.

### Database boundaries

Migration `20260714030000_create_adpadz_crm_admin.sql` creates:

- `public.admin_users`, its updated-at trigger, RLS, and a self-read-only policy;
- `public.is_adpadz_admin(check_user_id uuid default auth.uid())`;
- `public.get_adpadz_admin_dashboard_metrics()`;
- `public.get_adpadz_admin_recent_activity(limit_count integer default 20)`.

All three callable functions are `SECURITY DEFINER` with `search_path = pg_catalog, public`, revoke execution from `PUBLIC` and `anon`, and grant execution only to `authenticated`. The caller cannot use `is_adpadz_admin` to test another user's UUID. `admin_users` grants authenticated clients `SELECT` only, constrained by its self-read RLS policy; it grants no browser insert, update, or delete capability.

No admin policy is added to customer-owned tables. Cross-tenant reads remain inside the two reviewed RPCs:

- The metrics RPC returns one row containing 15 count fields. A database count of zero is a real zero. An individual failed source query is `null` for a partial-data state, and an RPC failure makes the response unavailable; neither is converted to zero.
- The activity RPC returns at most 100 sanitized events and omits lead contact details, QR metadata, owner identifiers, URLs, and other private source fields.

The published-profile metrics reproduce the public-profile rule: a card must be marked published, belong to its owner's Business Hub, and that Business Hub must be active. Merely having `business_cards.is_published = true` is not enough.

## First-admin bootstrap

Admin creation is a privileged SQL operation in Phase 1. First create the person's Auth account through the normal Supabase Auth process. Then use the Supabase SQL Editor or another trusted database session with sufficient privileges. Do not run this from the browser.

Confirm that the placeholder resolves to exactly the intended Auth account:

```sql
select id, email
from auth.users
where email = 'OWNER_EMAIL_HERE';
```

Promote that account explicitly:

```sql
insert into public.admin_users (
  user_id,
  role,
  display_name,
  active
)
select
  id,
  'owner',
  'Adpadz Owner',
  true
from auth.users
where email = 'OWNER_EMAIL_HERE'
on conflict (user_id) do update
set role = excluded.role,
    display_name = excluded.display_name,
    active = excluded.active;
```

Replace `OWNER_EMAIL_HERE`; do not commit a real administrator email to the repository. The statement affects zero rows if the Auth account does not exist. Verify the result from the trusted SQL session:

```sql
select user_id, role, display_name, active, created_at, updated_at
from public.admin_users
where user_id = (
  select id from auth.users where email = 'OWNER_EMAIL_HERE'
);
```

Subsequent memberships use the same pattern with one of the six allowed roles. Keep `active = false` until access is intentionally approved. To revoke access without deleting audit identity, set `active = false` from a trusted SQL session.

## Dashboard data contract

`get_adpadz_admin_dashboard_metrics()` returns these verified counts:

```text
active_businesses
total_campaigns
active_campaigns
draft_campaigns
campaigns_without_dates
total_leads
new_leads
total_qr_scans
published_profiles
businesses_without_published_profiles
community_mailers
available_placements
reserved_placements
sold_placements
community_mailers_with_open_placements
```

The current sources are `businesses`, `campaigns`, `business_card_leads`, `qr_scan_events`, `business_cards`, `community_cards`, and `community_card_slots`. QR scans count canonical event rows rather than cached counters. Leads use the current Smart Card lead table rather than the legacy `leads` table. An open community mailer is published, has sales open, and has at least one available slot.

`get_adpadz_admin_recent_activity()` merges recent business creation, campaign updates, captured leads, and QR scans. Its shape is:

```text
id text
source text       -- business | campaign | lead | qr
kind text
title text
detail text
occurred_at timestamptz
```

Campaign economics remains a deliberate setup state. The repository does not yet contain a complete, verified model for campaign revenue, direct production cost, overhead allocation, and estimated net profit, so Phase 1 must not display invented financial values.

## Environment and deployment

Use the same frontend-safe Supabase configuration as the rest of the app:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
VITE_PUBLIC_APP_URL=https://adpadz.co
```

Requirements:

- Use a Node version supported by `package.json` (`^20.19.0` or `>=22.12.0`).
- Apply every migration in filename order before testing Mission Control.
- Keep production deep-link fallback configured so `/admin/*` serves the SPA entry point.
- Deploy the application and database migration to the same Supabase environment.
- Never expose or document a real service-role credential in frontend configuration.

For a linked Supabase project, review the target first and then apply migrations with the repository's standard command:

```bash
npx supabase migration list
npx supabase db push --include-all
```

The earlier `feature/adpadz-crm-admin` attempt contained an incomplete migration body. This repository's complete `20260714030000_create_adpadz_crm_admin.sql` is the authoritative undeployed migration. If a target unexpectedly reports that timestamp as already applied, stop: do not rewrite deployed history. Inspect the live objects and add a new corrective migration instead.

## Migration validation

For a disposable local Supabase database, a full reset is the strongest replay check. It erases the local database, so never point it at shared or production data:

```bash
npx supabase start
npx supabase db reset
npx supabase db lint
```

After applying the migration, verify the security posture in a trusted SQL session:

```sql
select relrowsecurity
from pg_class
where oid = 'public.admin_users'::regclass;

select
  has_function_privilege('anon', 'public.is_adpadz_admin(uuid)', 'EXECUTE')
    as anon_can_check_admin,
  has_function_privilege(
    'authenticated',
    'public.is_adpadz_admin(uuid)',
    'EXECUTE'
  ) as authenticated_can_check_admin;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'admin_users'
order by grantee, privilege_type;
```

Expected results include RLS enabled, no anon function execution, authenticated execution of the authorization function, and no authenticated write privilege on `admin_users`.

Exercise these application cases with separate accounts:

1. Signed out: `/admin/dashboard` redirects to `/admin/login`.
2. Signed in as a normal Business Hub customer: access is denied.
3. Signed in as an active bootstrapped admin: the dashboard loads.
4. Change that admin to `active = false`, refresh, and confirm access is denied.
5. Restore access, temporarily interrupt Supabase connectivity, and confirm a retryable error appears rather than fake zeroes or an access-denied redirect.
6. Confirm sign-out ends the session and returns to `/admin/login`.

Run the repository checks after installing dependencies:

```bash
npm install
npm run typecheck
npm run lint
npm run test
npm run build
```

Focused Phase 1 tests cover strict role parsing, authorization outcomes, redirect decisions, metric normalization, and partial/unavailable data handling.

## Phase 1 boundary and next phase

Phase 1 includes the secure admin foundation, dedicated responsive shell, real operational overview, needs-attention signals, sanitized recent activity, an informational campaign-operations flow, and an honest campaign-economics setup state.

The sidebar names future areas, but they are not implemented CRM features. In particular, Sales Pipeline is not part of this phase. A recommended Phase 2 is to design the Sales Pipeline data model and server-side role matrix first, then add advertiser/contact/task workflows, audit history, and narrow write RPCs. Team administration, finance calculations, campaign production operations, analytics expansion, and role-management UI remain future work.
