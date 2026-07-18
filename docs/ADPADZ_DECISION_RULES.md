# ADPADZ DECISION RULES

Status: Active

Owner: CEO Office

---

# Purpose

This document governs every product, engineering, UX, architectural, and business decision made within Adpadz.

Before implementing any feature, changing existing functionality, creating a database table, designing UI, or introducing a new workflow, consult these rules.

If a proposal conflicts with any rule in this document, stop implementation and resolve the conflict before continuing.

---

# Rule 1

## Highest ROI Wins

Every decision begins with one question:

> Is this the highest ROI use of our time?

If another task creates more business value, customer value, or launch progress, do that first.

Engineering time is our scarcest resource.

Protect it.

---

# Rule 2

## Revenue Before Convenience

Features that help launch or operate Community Mailers take priority over features that simply make the platform nicer to use.

If a feature directly helps:

• sell campaigns

• build campaigns

• approve campaigns

• distribute campaigns

• renew campaigns

It moves to the front of the roadmap.

---

# Rule 3

## Every Feature Must Strengthen Campaigns

Campaigns are the center of Adpadz.

Every feature should improve one or more of:

Campaign creation

Campaign distribution

Campaign discovery

Campaign management

Campaign measurement

Campaign renewal

If it doesn't strengthen Campaigns, reconsider whether it belongs.

---

# Rule 4

## Extend Before Creating

Before introducing:

Table

Component

Workflow

API

Page

Dashboard

Renderer

Ask:

Can an existing system do this?

Extend existing systems whenever possible.

Avoid parallel implementations.

---

# Rule 5

## Every Campaign Becomes More Valuable After Printing

Traditional advertising loses value after delivery.

Adpadz campaigns should continue producing exposure through:

Consumer Discovery

Business Hub

QR

Campaign Pages

Adpadz TV

Future destinations

Every feature should increase campaign lifespan.

---

# Rule 6

## The Community Mailer Is the Acquisition Engine

The Community Mailer exists to:

Acquire businesses

Acquire consumers

Generate revenue

Drive QR engagement

Increase neighborhood density

It is not merely a print product.

When evaluating new features, ask:

Does this improve the Community Mailer as an acquisition engine?

---

# Rule 7

## Exposure Before Guaranteed Results

Adpadz measures campaign activity.

Businesses measure business outcomes.

Adpadz may report:

QR scans

Campaign views

Offer saves

Profile visits

Phone taps

Website visits

Time active

Never imply guaranteed sales or ROI.

---

# Rule 8

## One Campaign. Many Destinations.

Businesses create one Campaign.

Everything else references that Campaign.

Never require businesses to recreate content because it appears somewhere else.

Every new destination should extend Campaign Engine.

---

# Rule 9

## Permanent Information Lives in Business Hub

Business Hub owns:

Business information

Branding

Hours

Locations

Services

Media

Reviews

Campaigns reference Business Hub.

Never duplicate permanent information.

---

# Rule 10

## Campaigns Own Marketing

Campaigns own:

Offers

Headlines

Descriptions

CTA

Schedules

Campaign Media

Temporary promotions

Marketing belongs nowhere else.

---

# Rule 11

## Assets Exist Once

Logos

Videos

Images

Brochures

Menus

Commercials

Coupons

Documents

Upload once.

Reference everywhere.

---

# Rule 12

## Consumer Discovery Is Campaign-First

Consumers should discover campaigns.

Not business listings.

Not directories.

The campaign is the primary discovery object throughout the platform.

---

# Rule 13

## Business Value First

Every feature should increase value for businesses by reducing:

Time

Cost

Complexity

Repeated work

If the feature creates more work than value, redesign it.

---

# Rule 14

## Consumer Experience Must Feel Effortless

Consumers should always know:

What am I looking at?

What can I discover next?

Avoid overwhelming interfaces.

Avoid unnecessary clicks.

---

# Rule 15

## Premium Over Feature Quantity

Never add features simply because competitors have them.

Prefer fewer, higher-quality experiences over larger feature lists.

Premium experiences create differentiation.

---

# Rule 16

## Simplicity Is a Competitive Advantage

The simplest architecture that satisfies the requirement is usually correct.

Avoid solving hypothetical future problems.

Build for today's validated roadmap.

---

# Rule 17

## Reuse the Design System

Never invent:

Buttons

Cards

Spacing

Typography

Shadows

Components

Extend the Design System before introducing new UI patterns.

---

# Rule 18

## Every Feature Needs an Owner

Before implementation ask:

Who owns this?

Business Hub

Campaign Engine

Mission Control

Asset Library

Lead Manager

Analytics

If ownership is unclear, stop.

---

# Rule 19

## Measure Everything That Matters

Every meaningful interaction should become an event.

Examples:

QR Scan

Campaign View

Offer Save

Phone Tap

Booking

Lead

Website Visit

Directions

Analytics should inform businesses without overwhelming them.

---

# Rule 20

## AI Assists

AI should:

Reduce work

Improve quality

Increase consistency

Generate creative ideas

AI should never replace business ownership or decision-making.

---

# Rule 21

## Mobile Is Mandatory

Every workflow must work beautifully on mobile.

Desktop enhancements are welcome.

Mobile support is not optional.

---

# Rule 22

## Fail Loudly

Never fail silently.

Every failed write must:

Throw

Log

Display a helpful message

After successful writes:

Reload from Supabase.

Never assume local state is authoritative.

---

# Rule 23

## Neighborhood Density Is the Moat

The long-term value of Adpadz is created by neighborhood density.

Every campaign should increase:

Business participation

Consumer participation

Campaign quality

Marketplace value

Protect this advantage.

---

# Rule 24

## Launch Before Expansion

Do not build future systems until they support a proven business.

Launch.

Learn.

Improve.

Expand.

Repeat.

---

# Rule 25

## CEO Test

Before beginning implementation ask:

Does this move Adpadz closer to launching and repeating successful Community Mailers?

If the answer is no…

It should not be the next feature.

---

# Required Reading Order

Before any significant implementation, review:

1. ADPADZ_PRINCIPLES.md
2. ADPADZ_PRODUCT_VISION.md
3. ADPADZ_ARCHITECTURE.md
4. ADPADZ_DESIGN_SYSTEM.md
5. ADPADZ_DECISION_RULES.md
6. System-specific documentation

If documents appear to conflict:

Stop.

Explain the conflict.

Resolve it before writing code.

---

# Final Principle

Every line of code should strengthen one mission:

**Help local businesses create one campaign, publish it everywhere, and continuously increase its value through the Adpadz local advertising network.**