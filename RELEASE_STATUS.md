# Release Validation Report
**Branch:** `main` · **Date:** 2026-07-29 · **Validated by:** Claude (Sonnet 4.6)

---

## Phase 5 Implementation

Commit `TBD` — *feat: refine creative workspace experience* (2026-07-29)

Phase 5 Creative Workspace Refinement: fixed-viewport studio layout on xl desktop (browser page no longer scrolls while editing), independent panel scrolling for destination rail and inspector, compact toolbar, mouse-wheel zoom over canvas, destination-switch fade animation (150ms), larger artwork area with reduced padding, and pre-existing unused-variable lint fix in the Phase 4 test file.

---

## Phase 5 Validation

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ Clean |
| `npm run lint` | ✅ Clean (also fixed pre-existing unused var in `release-phase4.spec.ts`) |
| `npm test` | ✅ 462 / 462 unit tests |
| `npm run build` | ✅ Clean |
| `supabase db reset` | ✅ Succeeded |
| `supabase db lint --local` | ✅ No schema errors |
| `npm run test:e2e` full suite | ✅ 57 passed · 53 skipped · **1 failed** (see below) |
| Visual baselines regenerated | `desktop/creative-workshop.png`, `mobile/creative-workshop.png`, `tablet/creative-workshop.png` |
| `npm audit` | ⚠️ 2 high (react-router CVE, pre-existing — unchanged) |

---

## What Remains (Phase 5)

1 failure, pre-existing before this branch's changes.

| Test | File | Root cause (pre-existing) |
|---|---|---|
| Advanced Creative Workshop Before/After toggle | `release-creative-workshop-advanced.spec.ts:458` | `data-original-treatment` attribute stuck at `"false"` after toggle click |

Also fixed in this phase: both Phase 4 E2E spec files contained stale assertions referencing the old toolbar label ("Campaign Creative Workshop" → "Creative Studio") and old status badge text ("Unsaved changes" → "Unsaved").

---

---

## Phase 4 Implementation

Commit `3ae5ab9` — *feat: add destination production experiences* (2026-07-28)

Phase 4 of the Creative Production Studio: five destination-specific production environments, all rendered by the single `CreativePreviewCanvas` — Community Mailer paper proof with ephemeral guide controls and QR proof status, Consumer Discovery simulated feed context, QR Landing phone-chrome frame, Social Format Rack with all four formats simultaneously, and the Adpadz TV Coming Later presentation stub. 30 new architecture tests and 13 new E2E scenarios across desktop/tablet/mobile.

---

## Phase 4 Validation

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ Clean |
| `npm run lint` | ✅ Clean |
| `npm test` | ✅ 462 / 462 unit tests |
| `npm run build` | ✅ Clean |
| `supabase db reset` | ✅ Succeeded |
| `supabase db lint --local` | ✅ No schema errors |
| `release-phase4.spec.ts` (all platforms) | ✅ 29 passed · 10 skipped |
| `npm run test:e2e` full suite | ✅ 57 passed · 53 skipped · **1 failed** (see below) |
| `npm audit` | ⚠️ 2 high (react-router CVE, pre-existing — fix is a breaking change) |
| `git diff --check -- ':!artifacts'` | ✅ Clean |

Visual baselines regenerated for: `desktop/creative-workshop.png`, `desktop/production-candidate.png`, `mobile/creative-workshop.png`, `mobile/mission-control.png`, `mobile/production-candidate.png`, `tablet/creative-workshop.png`, `tablet/mission-control.png`.

---

## What Remains (Phase 4)

1 failure, pre-existing before this branch's changes.

| Test | File | Root cause (pre-existing) |
|---|---|---|
| Advanced Creative Workshop Before/After toggle | `release-creative-workshop-advanced.spec.ts:458` | `data-original-treatment` attribute stuck at `"false"` after toggle click |

The react-router `GHSA-qwww-vcr4-c8h2` CVE (RSC Mode CSRF bypass) is pre-existing; this app does not use RSC Mode. Fixing it requires `npm audit fix --force` which is a breaking dependency upgrade outside Phase 4 scope.

---

---

## Phase 3 Implementation

Commit `c180ccc` — *feat: add campaign shell and review workflow* (2026-07-27)

Phases 0–3 of the Creative Production Studio program: unified `CREATIVE_DESTINATIONS` registry, per-field destination override system with indicators and revert, `CampaignShell` wrapping all stages, and the new read-only Review stage. Canonical workflow: **Setup → Studio → Review → Publish**.

---

## What Passed

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ Clean |
| `npm run lint` | ✅ Clean |
| `npm test` | ✅ 432 / 432 unit tests |
| `npm run build` | ✅ Clean (1.76 s) |
| `supabase db reset` | ✅ Succeeded — seed + migration `20260728000100` applied |
| `supabase db lint --local` | ✅ No schema errors (shadowed `event_index` removed) |
| `release-candidate.spec.ts:139` — responsive visual baselines | ✅ Passing (desktop · tablet · mobile) |
| `release-candidate.spec.ts:311` — Creative Workshop destination overrides | ✅ Passing |
| `npm run test:e2e` full suite | ✅ 28 passed · 43 skipped · **1 failed** (see below) |

---

## What Remains

1 failure, pre-existing before this branch's changes.

| Test | File | Root cause (pre-existing) |
|---|---|---|
| Advanced Creative Workshop Before/After toggle | `release-creative-workshop-advanced.spec.ts:458` | `data-original-treatment` attribute stuck at `"false"` after toggle click — attribute name or timing changed |

`launch.spec.ts:8`, `release-candidate.spec.ts:126`, `:215`, and `release-creative-workshop-advanced.spec.ts:885` were listed as pre-existing failures in earlier validation passes. After the `reset_demo_workspace` migration fix (`20260728000100`) restores correct fixture state, all four now pass. `:458` is unrelated to fixture state — it is a UI-level attribute assertion that fails regardless of db state.

---

## Validation Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build

# Update stale visual baselines (intentional UI height change on dashboard)
npm run test:e2e -- --update-snapshots --grep "responsive launch surfaces"

# Verify target tests individually
npm run test:e2e -- --grep "Creative Workshop preserves destination"

# Full suite
npm run test:e2e

# Whitespace check (excluding ACL-locked F: drive artifacts dir)
git diff --check -- ':!artifacts'
```

---

## Changes in This Session

| File | Change |
|---|---|
| `scripts/run-local-e2e.mjs` | Sets `PLAYWRIGHT_ARTIFACT_ROOT` to `os.tmpdir()/adpadz-e2e` if not already in env — cross-platform fix for F: drive EPERM issue |
| `eslint.config.js` | Adds `'artifacts'` to ignore list — ESLint was crashing with EPERM on ACL-locked artifact directories |
| `tests/e2e/release-candidate.spec.ts` | Fixes both target tests (see below) |
| `tests/e2e/__screenshots__/**` | Regenerated visual baselines for desktop, tablet, and mobile |
| `supabase/migrations/20260728000100_*.sql` | Removes shadowed `event_index` declaration from `reset_demo_workspace` — fixed `db lint` warning |

### Test fix detail

**`release-candidate.spec.ts:139`** — responsive visual baselines  
Root cause: stale snapshots. The business dashboard grew 172 px taller after an intentional UI update. All horizontal-overflow soft assertions were already passing. Baselines regenerated with `--update-snapshots`.

**`release-candidate.spec.ts:311`** — Creative Workshop destination overrides  
Root causes (all in the test; product behavior is correct):

1. **Stale workflow selector.** `'Continue to Distribution'` was renamed to `'Continue to Review'` in Phase 3. Test now navigates the full Phase 3 flow: Studio → Continue to Review → verify Review page (`h2 "Review every destination"`) → Continue to Publish → verify Distribution.
2. **Override-count badge breaks exact match.** Inspector section buttons render as `"Overlay 1"` when the fixture campaign already has saved destination overrides. `{ name: 'Overlay', exact: true }` timed out. Fixed with `#inspector-overlay` / `#inspector-qr` (the component's own stable IDs).
3. **Duplicate "Opacity" label.** In destination-override scope, a "Revert Overlay opacity to Global" button also carries "opacity" in its aria-label, so `getByLabel('Opacity')` resolved to 2 elements. Fixed with `getByRole('slider', { name: 'Opacity' })`.
4. **Onboarding tooltip.** A "Click any element to edit it — Got it" popover appears on the fixture user's first Creative Workshop visit. Added a soft dismissal step before inspector interaction.
