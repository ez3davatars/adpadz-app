# ADPADZ DECISION RULES

Version 1.0

## PURPOSE

This document defines the engineering, product, UX, and architectural decision rules for Adpadz.

It exists to prevent inconsistent implementations, duplicate systems, unnecessary complexity, and architectural drift.

Before making ANY implementation decision, AI must consult this document.

If a requested implementation conflicts with these rules, stop and explain the conflict before writing code.

---

# FIRST PRINCIPLE

Every decision must increase value for one or more of:

Businesses

Consumers

Sales Partners

Adpadz

If a feature provides no meaningful value to one of these groups,

do not build it.

---

# SIMPLICITY WINS

Whenever multiple solutions exist,

prefer the simplest architecture that satisfies the requirements.

Never build complexity for hypothetical future needs.

Future-ready is good.

Over-engineered is not.

---

# CREATE ONCE

Businesses should enter information one time.

The system should reuse that information everywhere.

Never ask businesses to duplicate work.

---

# SINGLE SOURCE OF TRUTH

Every piece of data has ONE owner.

Examples:

Business information

↓

Business Hub

Campaign information

↓

Campaign Engine

Assets

↓

Asset Library

Leads

↓

Lead Manager

Analytics

↓

Analytics System

Never duplicate ownership.

---

# NEVER DUPLICATE DATA

Never copy:

Offers

Headlines

Descriptions

Videos

Images

Booking information

Business information

Instead,

reference existing objects.

---

# REUSE BEFORE BUILD

Before creating:

Table

Component

Section

Page

API

Ask:

Does this already exist?

If yes,

reuse it.

Never create duplicate functionality.

---

# PAGE RULE

Pages assemble Sections.

Pages do not own UI.

Sections assemble Design System components.

Components should never know about pages.

---

# DESIGN RULE

Never create custom buttons.

Never create custom cards.

Never invent spacing.

Never invent typography.

Never invent shadows.

Always use the Adpadz Design System.

---

# BUSINESS HUB RULE

Permanent information belongs in Business Hub.

Examples:

Logo

Gallery

Videos

Services

Business Info

Booking

Reviews

Never store permanent information inside Campaigns.

---

# CAMPAIGN RULE

Temporary marketing belongs in Campaigns.

Examples:

Holiday Sale

Grand Opening

New Product

Summer Promotion

Campaigns should never permanently store business information.

---

# SMART CARD RULE

Smart Cards display.

They do not own.

Smart Cards render Business Hub + Campaign Engine.

Never duplicate campaign information inside Smart Cards.

---

# INTERACTIVE AD RULE

Interactive Ads exist for engagement.

They should always point users toward Campaigns.

They are not the final destination.

---

# COMMUNITY MAILER RULE

Community Mailers distribute Campaigns.

Never build standalone mailer content disconnected from Campaigns.

---

# QR RULE

QR Codes connect physical marketing with digital experiences.

Never point QR codes to static pages when a Campaign experience exists.

---

# ASSET RULE

Every uploaded asset exists once.

Never upload duplicates.

Campaigns reference assets.

Smart Cards reference assets.

Mailers reference assets.

---

# LEAD RULE

Every meaningful interaction should be measurable.

Examples:

Booking

Lead Form

Offer Claim

Call

Directions

QR Scan

Interactive Ad

Video

Campaign View

Everything should contribute to business insight.

---

# AI RULE

AI assists.

AI never replaces the business owner.

AI should:

Reduce work

Improve quality

Increase consistency

Never remove business control.

---

# USER EXPERIENCE RULE

Every page answers:

What am I looking at?

What should I do next?

Only one primary CTA per screen.

Never overwhelm users.

---

# DASHBOARD RULE

Dashboards should answer:

What needs attention?

What should I do today?

What is performing well?

Avoid meaningless statistics.

---

# PERFORMANCE RULE

Always prefer:

Fast loading

Reusable queries

Small components

Lazy loading when appropriate

Never sacrifice responsiveness for unnecessary effects.

---

# MOBILE RULE

Every feature must work beautifully on mobile.

Desktop enhancements are optional.

Mobile usability is mandatory.

---

# ERROR RULE

Never fail silently.

Every failed write:

Throws

Logs

Displays a friendly message

Never pretend a save succeeded.

Always reload saved data from Supabase after successful writes.

---

# DATABASE RULE

Before creating a table ask:

Can an existing table own this?

Before creating a relationship ask:

Does this duplicate another relationship?

Database growth should be intentional.

---

# COMPONENT RULE

Never create one-off UI.

If a component will likely be reused,

add it to the Design System.

---

# FEATURE RULE

Every new feature must answer:

Who owns this data?

Which section renders it?

Which Design System components render it?

What Campaign value does it provide?

If those answers are unclear,

the feature is not ready.

---

# CAMPAIGN RULE

Every future marketing capability should integrate with Campaign Engine.

Examples:

Interactive Ads

Mailers

QR

Smart Cards

Social

Email

Flyers

Never bypass Campaign Engine.

---

# FUTURE RULE

When adding a feature,

prefer extending existing systems instead of creating new ones.

Ask:

Can Campaign Engine do this?

Can Business Hub do this?

Can Asset Library do this?

If yes,

extend.

Do not duplicate.

---

# CODEX IMPLEMENTATION RULES

Before every implementation:

Read:

ADPADZ_PRODUCT_VISION.md

ADPADZ_ARCHITECTURE.md

ADPADZ_DESIGN_SYSTEM.md

ADPADZ_DECISION_RULES.md

Follow all four together.

If implementation conflicts with any document,

stop.

Explain the conflict.

Do not continue until resolved.

---

# FINAL PRINCIPLE

Every decision should move Adpadz closer to one goal:

Create one campaign.

Publish it everywhere.

Manage everything from one place.

If a decision strengthens that philosophy,

it is probably the correct decision.

If it weakens that philosophy,

choose another solution.
