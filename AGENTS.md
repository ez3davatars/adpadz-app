# Adpadz Repository Instructions

Adpadz is a Local Advertising Cooperative and local-business marketing platform.

Before planning, modifying, or implementing any product feature, read:

1. `docs/ADPADZ_PRODUCT_VISION.md`
2. `docs/ADPADZ_ARCHITECTURE.md`
3. `docs/ADPADZ_DESIGN_SYSTEM.md`
4. `docs/ADPADZ_DECISION_RULES.md`

Read the following when the task affects those systems:

- `docs/ADPADZ_MISSION_CONTROL.md`
- `docs/ADPADZ_COMMUNITY_MAILER_BUILDER.md`

## Core product standard

Every feature must be:

- Premium
- Simple
- Elegant
- Useful to a local business owner
- Consistent with Create Once, Publish Everywhere
- Built from existing systems before introducing new ones

## Decision order

Before building anything:

1. Determine the business and user outcome.
2. Identify which existing system owns the data.
3. Reuse existing architecture, sections, and design-system components.
4. Avoid duplicate data, UI, workflows, and terminology.
5. Keep one obvious primary action per screen.
6. Ensure the feature works beautifully on mobile.
7. Never invent results, metrics, customer evidence, or capabilities.

## System ownership

- Permanent business information belongs to Business Hub.
- Promotional information belongs to Campaign Engine.
- Uploaded media belongs to Asset Library.
- Public business experiences render shared data and do not duplicate it.
- Community Mailers distribute Campaigns.
- Mission Control remains separate from customer-facing Business Hub.
- Analytics records meaningful customer interactions.

## Working behavior

For each implementation request:

1. Inspect the current repository before proposing changes.
2. Identify existing components, tables, routes, and patterns that can be reused.
3. Explain any conflict with the governing documentation.
4. Prefer the smallest complete solution.
5. Implement only the requested scope.
6. Run relevant tests, typecheck, lint, and build.
7. Report changed files, validation results, unresolved risks, and whether a commit was created.

If the request conflicts with the governing documents, stop and explain the conflict before implementing it.