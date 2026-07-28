# Creative Production Studio — Audit

**Adpadz · One Campaign. Many Destinations.**
Prepared by the Creative Product Director / Principal UX Architect / Senior Frontend Engineer role.
Scope: Campaign Studio, Creative Workshop, Distribution, Community Mailer, QR Studio, consumer surfaces, TV readiness.
Status: **Audit only. No code was modified. No implementation is authorized until explicit approval.**

---

## 1. What currently works well

**The rendering architecture is the crown jewel.** There is exactly one creative renderer — `CampaignTemplateRenderer` — used by the Workshop canvas, the consumer Feed, the public QR landing page, the Distribution previews, the social PNG export, and the mailer print candidate rasterizer. `communityMailerCandidate.ts` even records `creativeRenderer: "CampaignTemplateRenderer"` as provenance, and architecture tests enforce single-renderer usage. WYSIWYG fidelity is structurally guaranteed. This is the hard part of a creative platform and it is already done correctly.

**The constraint system is right.** Four template families with fixed, normalized layout boxes (`templateRegistry.ts`), ~35 whitelisted settings, every numeric clamped and every enum validated at every boundary (`normalizeCreativeSettings`, `normalizeWorkshopState`, `normalizeCampaignContent`). Nothing untrusted reaches the renderer. This is exactly the "professional by default" posture Adpadz needs — the opposite of a Canva clone.

**Print safety is real, not decorative.** Mailer QR visibility is locked, QR contrast is gated at save time against `MIN_PRODUCTION_QR_CONTRAST_RATIO`, section resets preserve a usable Mailer QR, saves that affect print force preflight reconfirmation, and only owned/active/unexpired QRs can be print-saved. The state-machine tests (`creativeWorkshopState.test.ts`, ~25 cases) pin all of this.

**Creative History is content-addressed** (FNV-1a fingerprint over canonicalized settings) so no-op saves create no versions; restore loads as a single undoable unsaved change. Compare supports history/saved/session pairs with an aspect-ratio-aware split view.

**Dialog accessibility in the Workshop is above average**: focus traps with restore, scroll locks, `aria-modal`, `aria-live` announcements for undo/redo/selection, 44px touch targets, direct element inspection with screen-reader announcements.

**The Workshop's responsive skeleton is genuinely mobile-first**: preview ordered first on mobile, inspector becomes a proper modal bottom sheet below `xl`, sticky save bar, destination rail becomes a horizontal scroller.

---

## 2. What feels visually weak

The Workshop *functions* like a studio but *reads* like a settings console.

- **The preview is a card among cards.** The stage sits inside an `AdpadzCard` in the middle grid column, capped at `max-w-[620px]`, with identical border/background treatment to the destination rail and inspector. Nothing says "this is the artwork; everything else is chrome."
- **Typography is inverted.** The dominant text style across the Workshop is 9–10px, `font-black`, uppercase, letter-spaced. Micro-labels outnumber and out-shout content. When everything is black-weight, nothing has weight. Meanwhile the campaign title — the one thing the user owns — is a truncated `text-lg`.
- **Neon is unbudgeted.** Active states, statuses, eyebrows, badges, buttons, and borders all use the same neon. The accent has no reserved meaning (it should mean "primary action" and "ready," nothing else).
- **Destination cards are paragraphs, not places.** Each destination is a text button with a name, a tagline, and a status string. For a visual product, the destinations show no visual — no live thumbnail, no aspect-ratio silhouette.
- **Format switching is text chips** ("Standard / Combined / Featured Sponsor") where shape is the actual information. A 9:16 Story and a 1200×628 Landscape should be visibly different objects before they are labels.
- **Status is prose, not signal.** The context string ("Mailer · Standard · Hero Visual · Global settings (override preserved)") is repeated twice per screen as metadata sentences. Zoom options "Fit / 50% / 100%" are arbitrary and unexplained.
- The full-screen preview — the most "studio" moment in the product — is a modal with a row of 9px pill buttons, not an immersive stage.

## 3. What feels structurally confusing

- **Creative authoring lives in four places.** `CreateAd.tsx` (Campaign Studio) contains its own template picker, theme toggle, QR/expiration toggles, image fit/position/zoom sliders, and a 2×2 live destination preview grid (`TemplateStudioPreview`). The Workshop then owns the same controls, deeper. Content Studio ("Marketing Package") and Distribution add two more preview-and-status surfaces. A business owner cannot form a stable model of *where design happens*.
- **The Workshop is orphaned in the IA.** It is unreachable from Campaigns, Dashboard, and Community Campaigns. `campaignReadiness.ts` never emits a `/creative` next action — the most sophisticated surface in the app is only reachable through CreateAd's edit mode or a secondary button inside Distribution.
- **The sidebar lies.** "Campaigns" and "Campaign Distribution" both navigate to `/app/business/campaigns` (`BusinessLayout.tsx:33,36`); "Campaign Studio" goes to Create-Ad; Community Campaigns reuses the Dashboard icon. Two nav items, one destination.
- **The scope model is invisible.** Global vs. destination override is a full-snapshot fork: the first destination-scoped edit copies all ~35 fields, after which global edits silently stop reaching that destination. No per-field indicator exists anywhere. The "Edit scope" toggle also sits in the right column, physically and conceptually disconnected from the destination rail on the left — two halves of one decision, 800px apart.
- **QR Studio is a dead end.** The Workshop links into it; nothing links back to any campaign, and QR Studio knows which campaign it serves.
- **Auto-scope-switching is surprising.** Choosing Featured Sponsor globally, or hiding a QR globally, silently flips the user into destination scope with an explanatory message — correct behavior, but delivered as a side effect the user must read a banner to understand.

## 4. What is duplicated

| # | Duplication | Sites | Severity |
|---|---|---|---|
| 1 | **Creative editing controls** — template picker, theme, QR/expiration toggles, image framing sliders | `CreateAd.tsx` (`TemplateStudioPreview`, image framing card) vs. Workshop inspector | High — two sources of design truth |
| 2 | **Destination preview grids** | `CreateAd.tsx:656` 2×2 grid vs. Workshop stage vs. Distribution previews | High |
| 3 | **Mailer placement settings synthesized inline** vs. read from the production snapshot | `CommunityMailerPlacement.tsx:107` vs. `communityMailerCandidateBrowser.ts:44` | **Critical — on-screen mailer ≠ printed candidate** |
| 4 | Destination list | 3 TS locations (`creativeWorkshop.ts:247`, `creativeWorkshopState.ts:70`, `CampaignCreativeWorkshopAdvanced.tsx:128`) + 4 SQL CHECK constraints | High for TV |
| 5 | Aspect-ratio tables | Workshop `formats` map, `CreativeHistoryDrawer.historyPreviewRatio` (divergent — missing `featured`), `CreateAd.tsx:647` | Medium |
| 6 | `destinationToRenderer` | `creativeWorkshop.ts:368` vs. `CreativePreviewCanvas.tsx:112` | Medium |
| 7 | QR rendering engines ×3 | `CircularPadQR` (branded), `QrMark` in the renderer (plain `qrcode` lib), plus `QRStudio.tsx:1240` re-mapping ~36 props by hand instead of using `QRStudioPreview` | High — same campaign renders a branded pad on one surface, a generic black square on another |
| 8 | `resolveDestinationCreative → normalizeCampaignContent → renderer` wiring hand-rolled | Feed, AdView, Distribution ×2, CreateAd | Medium |
| 9 | `trapFocus` ×3, scroll-lock/focus-restore ×3, `elementLabel` ×4, `boxStyle` ×2, `Field`/`Check` primitives ×3 | across campaign-creative + mailer + QR Studio | Low each, high aggregate |
| 10 | Preflight computed twice per admin render | `CommunityMailerProductionPanel:17` + `CommunityMailerCandidatePanel:58` | Low |
| 11 | Mailer discovery QR bypasses the adapter, dropping all saved QR styling | `MailerBrandArea.tsx:67` | Medium |

## 5. What should be removed

- **`Social.tsx` — 421 lines of unreachable code** (route redirects to Campaigns, no lazy import). It also carries a third, contradictory mailer mental model.
- **CreateAd's creative controls**: `TemplateStudioPreview`, the image fit/position/zoom card, and the 2×2 preview grid. Campaign Studio should own *content and outputs*; the Workshop owns *creative*. Replace with the existing read-only `CreativeSummary` + "Design Creative" for both new and editing states.
- **The dead `"studio"` member** of `CampaignTemplateDestination`.
- **Guide toggles from persisted creative state** (`safeAreaVisible`, `bleedVisible`, `qrMinimumVisible`). They are editor UI state, yet they pollute the settings fingerprint and generate history versions labeled "Safe-area guide."
- **The unreachable drag/resize subsystem** in `CommunityMailerCanvas.tsx:44–78` (its only `admin-edit` consumer hard-codes `layout_locked: true`) — wire it deliberately or delete it.
- **The duplicate sidebar entry** ("Campaign Distribution" → same route as "Campaigns").
- The duplicated helpers in §4 (consolidate, don't multiply).

## 6. What should be promoted

- **The preview, to a true stage.** It is the product; it should command the screen.
- **The Workshop, to the campaign's center of gravity.** Reachable from Campaigns list rows, Dashboard next-actions, and readiness (`campaignReadiness` should emit `/creative` destinations).
- **Destination switching, to the primary navigation of the studio** — with live per-destination thumbnails and true status (Global / Customized / Needs attention), making "One Campaign. Many Destinations." something you *see*.
- **Creative History**, from a drawer behind a small header button to a first-class, visible affordance — it is a differentiator.
- **Print safety, to a visible "Proof" mode** for the Mailer destination rather than scattered toggles in an accordion section.
- **Direct element inspection** — currently discoverable only via a dismissible hint. Hover affordances on the canvas should teach it.
- **QR Studio round-trips**: "Back to campaign" continuity in both directions.

## 7. Recommended information architecture

Make the **Campaign** the object; make the **Studio** its home.

```
Sidebar (simplified)
├─ Dashboard
├─ Campaigns                ← single entry point; list + metrics
├─ Community Mailer         (Community Campaigns, renamed for clarity)
├─ QR Studio
├─ Business  (Profile / Services / Assets)
├─ Customers (Leads / Analytics)
└─ Settings  (Business / Billing)

Campaign (one shell, /campaigns/:id, persistent header: name · status · readiness · Save)
├─ Setup        ← CreateAd's content steps (content, offer, schedule, outputs)
├─ Studio       ← Creative Workshop, the centerpiece
├─ Distribute   ← Distribution overview + social export workspace
└─ History      ← Creative History, promoted
```

Rules: the campaign shell provides one consistent header and stage-to-stage navigation (Setup → Studio → Distribute mirrors the natural workflow). CreateAd's step wizard survives as Setup, minus every creative control. Distribution keeps its read-only stance — it is the *shipping dock*, and its current "Read-only · design changes stay in Creative Workshop" copy is exactly right. No new routes are strictly required; `/edit`, `/creative`, `/distribution` become tabs of one shell.

## 8. Recommended interaction architecture

- **Destination rail = the studio's primary switcher.** Each destination entry shows a miniature live render (the renderer is cheap at thumbnail size once memoized), its aspect silhouette, and a status chip. Selecting a destination changes the stage; the rail is always visible.
- **Scope becomes explicit and legible.** Default editing is Global. A destination acquires an override only through a deliberate "Customize for {Mailer}" action. While an override exists: (a) the inspector marks each field that diverges from Global with a subtle override dot, (b) each field offers "Revert to Global," (c) the destination rail shows "Customized." This fixes the silent-shadowing hazard (the snapshot-not-diff model) at the interaction layer first; a diff-based storage model can follow later.
- **Contextual inspector stays click-driven.** Clicking canvas elements opens the matching section (already implemented and good). Elevate it: hover outlines on the canvas, an element breadcrumb ("Headline · Text"), and Esc-to-deselect (exists).
- **Formats are visual.** Ratio-accurate silhouette chips; changing format animates the stage between aspect ratios.
- **Keyboard**: real ⌘Z/⇧⌘Z/⌘S shortcuts (undo/redo exist only as buttons today), arrow-key element cycling, F for full screen.
- **Feedback**: replace the inline message strip with transient toasts for confirmations; keep inline (and `role="alert"`) only for blocking errors like the QR-contrast save gate. Replace remaining `window.confirm` calls with `CreativeConfirmDialog`.
- **Debounced history.** Slider drags currently push a history entry per tick (each doing a full-state `JSON.stringify` compare). Coalesce continuous gestures into one undo step on release.

## 9. Recommended visual composition

- **Stage-first hierarchy**: the artwork sits on a recessed, near-black canvas field with generous margin; panels (rail, inspector) sit one elevation level up; the artwork alone gets a soft shadow and true-white surround behavior in light-creative cases. Three elevation levels total, used consistently.
- **Type ramp discipline**: minimum interface size 11px; eyebrow/micro-labels demoted from `font-black` to `font-semibold` with reduced tracking; one display size for the campaign title. `font-black` reserved for the artwork and primary CTA.
- **Accent budget**: neon = primary action + "ready" state only. Amber = unsaved/attention (already the convention — keep it). Everything else neutral.
- **Spacing**: consistent 8pt grid; the current mix of `p-3/p-4/p-5` and `gap-1/2/3` inside one view should collapse to two paddings and two gaps.
- **Motion**: 150–200ms ease-out on destination/format transitions (aspect-ratio morph of the stage is the signature moment); no motion elsewhere. `prefers-reduced-motion` respected.

## 10. Recommended desktop layout (≥1280px)

```
┌────────────────────────────────────────────────────────────────┐
│ Header: ← Campaign name · readiness ○ | History ⌘Z ⌘⇧Z [Save] │
├──────────┬──────────────────────────────────────┬──────────────┤
│ Rail 240 │              STAGE                   │ Inspector 360│
│          │                                      │              │
│ ▣ Mailer │      ┌──────────────────┐            │ (contextual  │
│ ▢ Discov.│      │                  │            │  sections,   │
│ ▢ QR     │      │    creative      │            │  scope       │
│ ▢ Social │      │                  │            │  indicator   │
│ ▢ TV ◌   │      └──────────────────┘            │  at top)     │
│  (live   │  floating: formats · zoom · before/  │              │
│  thumbs) │  after · full-screen                 │              │
└──────────┴──────────────────────────────────────┴──────────────┘
```

The current `[220px_1fr_340px]` grid is close; the changes are: stage backdrop treatment, floating stage controls instead of a toolbar card, live thumbnails in the rail, scope indicator moved into the inspector header, and the preview no longer artificially capped at 620px (zoom: Fit / 100% / pixel-true per format).

## 11. Recommended tablet layout (768–1279px)

Destination switcher becomes a segmented control above the stage (with status dots, no thumbnails). Stage takes full width. Inspector remains the existing bottom-sheet pattern but pinnable: a half-height, non-modal sheet that coexists with the stage while adjusting sliders (the current sheet is modal, which hides the very preview being edited — the single biggest tablet flaw). Standardize the breakpoint story: the app currently splits at `md`/`lg`/`xl`/`2xl` in different files for equivalent layouts (Distribution uses three in one file with inverted column weights; the mailer canvas gates at `2xl` in two pages and `xl` in a third). One rule: single-column below `lg`, split at `lg`, wide split at `xl`. No `2xl` gates.

## 12. Recommended mobile layout (<768px)

Order: destination segmented control → stage → primary actions. Tap element → bottom sheet inspector opens to that section (exists; keep). Sheet at 60% height with the selected element kept visible above it (scroll-into-view on select). Sticky bottom bar: Undo · Save (exists; keep). Full-screen preview becomes the default review gesture (tap stage to enter). Mailer proof-mode controls collapse to a single "Print guides" toggle.

## 13. How Social, Mailer, Discovery, QR, and TV should differ

Each destination gets a **stage dressing** and destination-specific controls; nothing else forks.

- **Mailer — the proof.** Stage renders the placement in paper context: bleed/trim/safe guides on by default, QR contrast readout visible, preflight status inline. This is where print safety stops being accordion toggles and becomes an environment.
- **Discovery — the feed.** Stage shows the card inside a neutral feed frame (above/below ghost cards) so scale and thumb-stopping power are judged in context.
- **QR Landing — the phone.** Stage renders the 3:4 hero inside a device frame; the linked QR code shown beside it closes the scan→land loop visually.
- **Social — the rack.** All four formats rendered as a rack of live previews; selecting one focuses it; caption + PNG export live here (Distribution's social workspace folds in or deep-links). Export remains rasterized from the shared renderer.
- **TV — the room (future).** 16:9 landscape format, distance-legibility warnings (minimum effective type size at 10ft), motion-safe/no-QR-dependency defaults, dwell-time as the "format" variable. Architecturally it must be a registry entry, not a fifth hardcoded branch — see §16 Phase 0.

## 14. What must remain shared

Non-negotiables, all already true and to be preserved: one renderer (`CampaignTemplateRenderer`); one content contract (`normalizeCampaignContent`); one settings schema with total normalization; one workshop state + history store; one template registry with fixed layout boxes; the resolve-with-resources authorization pattern in `resolveDestinationCreative`; one Creative History; one readiness engine; the export/print paths rasterizing the same component the editor shows; existing tests (state-machine suite and the two Playwright release specs are the real safety net and must keep passing through every phase).

## 15. What should not be built

No freeform drag-and-drop or arbitrary positioning. No resizable/rotatable layers, z-order controls, or unlimited elements. No custom fonts or user CSS. No per-destination separate editors (destinations are views of one campaign, never forks). No template *builder* for end users — templates remain curated. No second renderer for TV or anything else. No real-time collaboration, comments, or multi-user cursors in this horizon. No rebuild of the state layer — `creativeWorkshopState` is well-tested and sound; the UX around it is what changes.

## 16. Proposed phased implementation plan

Each phase independently: **Audit → UX proposal → Architecture proposal → approval → implement → stop for review.** No phase begins without sign-off.

**Phase 0 — Foundation consolidation (no visible UX change).**
Single `CREATIVE_DESTINATIONS` descriptor registry (key, labels, icon, formats, ratios, capability flags: `requiresQr`, `hasBleed`, `affectsPrint`, `allowsFeaturedSponsor`) replacing the 3 TS destination lists, 2 `destinationToRenderer` copies, 3 ratio tables, and `=== "mailer"` checks; DB migration relaxing the 4 SQL destination CHECKs to registry-driven validation. Delete `Social.tsx`, dead `"studio"` member, dead mailer drag code. Extract `useDialogBehavior` (trap/lock/restore ×3→1) and `useDestinationCreative` (wiring ×5→1). Fix the two correctness bugs: mailer placement settings must come from the snapshot path, and `containerType` must be owned by the renderer's wrapper (fixing `CommunityMailerPlacement` and `AdView`). Move guide toggles out of persisted settings. All existing tests must pass; architecture tests updated to pin the registry.

**Phase 1 — The Stage.** New Workshop shell: stage-first composition, elevation and type ramp, floating stage controls, destination rail with live thumbnails, format silhouettes, header consolidation. Memoize the render path (`React.memo` on renderer + canvas, coalesced slider history, remove the inspector's forced-reflow effect) so thumbnails are affordable.

**Phase 2 — Scope & inspector.** Explicit "Customize for {destination}" flow, per-field override indicators with "Revert to Global," inspector section polish, keyboard shortcuts, toast feedback, tablet pinned sheet. Storage model unchanged.

**Phase 3 — Campaign shell & IA.** Setup/Studio/Distribute/History tabs under one campaign header; strip creative controls from CreateAd; fix sidebar (single Campaigns entry, correct icons); readiness emits `/creative` next-actions; Dashboard and Campaigns list deep-link into the Studio; QR Studio round-trip.

**Phase 4 — Destination experiences.** Mailer proof mode, Discovery feed frame, QR phone frame, Social rack with integrated export, TV registry entry behind a flag (format + guides only, no distribution).

**Phase 5 — Hardening.** History drawer virtualization/lazy thumbnails, image `loading`/`decoding`/dimensions across 42 `<img>` sites, `manualChunks` (isolate `pdf-lib`, `qrcode`, `CircularPadQR`), semantics pass (radio groups instead of `aria-pressed` clusters, real tabs in mailer side-tabs, fix `<h3 className="contents">`, nested-interactive DOM in mailer placements, focus traps on the two admin dialogs), breakpoint standardization, QR Studio adopting its own `QRStudioPreview` adapter, a11y test coverage.

---

*Appendix — critical defects worth fixing regardless of the redesign:* (1) mailer on-screen vs. printed-candidate settings divergence (`CommunityMailerPlacement.tsx:107`); (2) missing `containerType` in `CommunityMailerPlacement`/`AdView` making `cqw` type sizing resolve incorrectly; (3) silent-failure destination lists at `creativeWorkshop.ts:247` and `creativeWorkshopState.ts:70` that would swallow a TV destination without a compile error; (4) `MailerBrandArea` dropping all saved QR styling; (5) inspector effect performing forced layout reflow on every settings change.
