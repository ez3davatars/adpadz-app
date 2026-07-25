# React Router Security Assessment

**Assessment date:** July 25, 2026  
**System:** Adpadz web application  
**Installed packages:** `react-router-dom@7.18.1`, `react-router@7.18.1`  
**Decision:** Temporarily accept the dependency finding with controls and a time-bounded review.

## Executive conclusion

Neither React Router vulnerability involved in the current dependency-resolution
conflict is reachable in Adpadz's present architecture.

Adpadz is a client-rendered Vite single-page application using React Router
Declarative Mode through `<BrowserRouter>`, `<Routes>`, and `<Route>`. It does
not use React Router Framework Mode, Data Mode route loaders/actions, server
rendering, React Server Components, server actions, or the unstable RSC APIs.
React Router therefore does not receive or execute authenticated server
requests in Adpadz.

The current `npm audit` result for `GHSA-qwww-vcr4-c8h2` is a version-based
finding rather than evidence of a reachable vulnerable path. The upstream
advisory expressly limits impact to applications using unstable RSC APIs.

A temporary risk acceptance is justified, subject to the restrictions and
review conditions in this assessment. This is not a permanent waiver.

## Scope and evidence

The review covered:

- `package.json` and the resolved npm dependency tree;
- `src/main.tsx` and `src/App.tsx`;
- every React Router import and route declaration under `src/`;
- searches for Router providers, route loaders/actions, redirects, fetchers,
  Framework Mode request handlers, SSR, static handlers, server components,
  and unstable RSC APIs;
- Vite configuration and the production build model;
- Supabase Edge Functions and database authorization controls;
- the full local RC browser authorization matrix.

Observed architecture:

- `src/main.tsx` mounts the application with React DOM `createRoot`.
- `src/App.tsx` creates a `<BrowserRouter>` and declarative `<Routes>`.
- No `createBrowserRouter`, `RouterProvider`, route `loader`, route `action`,
  `useFetcher`, React Router `<Form>`, `createRequestHandler`,
  `createStaticHandler`, `StaticRouter`, `ScrollRestoration`, `react-server`,
  or unstable RSC API is present.
- Vite produces static browser assets. There is no React Router application
  server or SSR entry point.
- Server-side mutations go directly to Supabase REST/RPC/Storage or isolated
  Supabase Edge Functions. They are not React Router actions.

## Advisory 1: GHSA-qwww-vcr4-c8h2

**Issue:** RSC Mode CSRF bypass can execute an action before returning a 400
response.

**Affected upstream surface:** React Router's unstable RSC request-processing
and server-action path. The upstream advisory states that an application is
affected only when it uses unstable RSC APIs.

**Adpadz affected code paths:** None.

The necessary vulnerable request handler is not instantiated or deployed.
Adpadz has no RSC route modules, server actions, RSC endpoint, React Router
server runtime, or authenticated cookies consumed by a React Router action.
An attacker can send arbitrary requests to the static Adpadz host, but there is
no React Router RSC action dispatcher to interpret them.

**Exploitability:** Not exploitable in the current architecture.

The package code is present transitively in browser bundles, but the vulnerable
server-side feature is neither imported nor reachable. Version presence alone
does not create the required execution path.

## Advisory 2: GHSA-2w69-qvjg-hvjx

**Issue:** Unsafe loader/action redirects in Framework Mode, Data Mode, or
unstable RSC mode can turn an open redirect based on untrusted data into client
JavaScript execution.

This advisory is relevant to the downgrade alternative proposed by npm. The
upstream advisory explicitly states that applications using Declarative Mode
with `<BrowserRouter>` are not impacted.

**Adpadz affected code paths:** None.

Adpadz uses `<BrowserRouter>` Declarative Mode and has no Router loader or
action that returns redirects. Client navigation uses fixed application paths
or locally validated destinations. No untrusted value is returned from a
React Router loader/action because no such loader/action exists.

**Exploitability:** Not exploitable in the current architecture.

Downgrading to a version flagged by this advisory would nevertheless be a poor
dependency-management choice because it would reintroduce numerous resolved
findings and provide no security benefit to the deployed Adpadz mode.
Adpadz should remain on the latest available 7.x release until a non-conflicting
patched release is available.

## Separate server trust boundary

React Router is not an authorization boundary in Adpadz.

- Supabase Auth validates user sessions.
- Row Level Security binds tenant-owned records to `auth.uid()`.
- administrative RPCs independently check the Mission Control administrator
  membership or `can_manage_community_mailers`.
- private production storage is restricted by storage policies.
- billing Edge Functions call `auth.getUser()` before accessing customer data.
- the Stripe webhook verifies its signature and does not trust browser input.

The RC authorization tests confirmed cross-tenant records are concealed,
anonymous administrative access is rejected, owner access to Mission Control
and private production objects is denied, and administrator access succeeds.
These controls would still be required if React Router were removed entirely.

## Compensating controls

Until an upstream fix is available:

1. Keep Adpadz on Declarative Mode with `<BrowserRouter>`.
2. Do not add React Router loaders, actions, Framework Mode, SSR, RSC, server
   actions, or unstable APIs without reopening this assessment first.
3. Keep all state-changing operations behind Supabase JWT validation, RLS,
   restricted RPCs, storage policies, or signed webhook verification.
4. Continue running `npm audit` in the release gate and monitor the React
   Router advisory and npm releases.
5. Upgrade promptly when a compatible patched release is published, then run
   typecheck, lint, unit tests, build, authorization tests, and the complete
   Playwright suite.
6. Reassess immediately if hosting changes from static Vite assets to a React
   Router server runtime.

## Risk decision

**Likelihood:** Negligible while the current architecture remains unchanged.  
**Impact if prerequisites were later introduced:** High, because the advisory
can permit unauthorized state-changing actions or script execution.  
**Current residual risk:** Low.

Temporary acceptance is justified because:

- both vulnerable feature sets are absent;
- upstream documentation explicitly excludes or limits impact based on the
  modes Adpadz does not use;
- authorization and mutation enforcement live at the Supabase boundary rather
  than in client routing;
- the proposed downgrade creates a worse dependency posture;
- no currently published compatible package version clears the conflicting
  audit results.

**Acceptance period:** Until the first compatible upstream release that fixes
`GHSA-qwww-vcr4-c8h2`, or 30 days from this assessment, whichever occurs first.
Renewal requires repeating the reachability search and confirming the
architecture has not changed.

## References

- [GHSA-qwww-vcr4-c8h2: RSC Mode CSRF bypass](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)
- [GHSA-2w69-qvjg-hvjx: loader/action redirect XSS](https://github.com/advisories/GHSA-2w69-qvjg-hvjx)
- [React Router Declarative Mode](https://reactrouter.com/start/declarative/routing)
