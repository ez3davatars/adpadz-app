# ADPADZ ARCHITECTURE

Version 1.0

## PURPOSE

This document defines the core architecture of Adpadz.

Before implementing any feature, modifying existing functionality, creating database tables, changing UI, or refactoring code, this document MUST be read and followed.

The purpose is to prevent duplicate data models, inconsistent UI, and architectural drift.

---

# CORE PRINCIPLE

Create once.

Publish everywhere.

A business should never enter the same marketing information twice.

Everything originates from one source of truth and is distributed automatically throughout the platform.

---

# PRODUCT HIERARCHY

Business

↓

Business Hub

↓

Campaign Engine

↓

Outputs

↓

Customer Experience

---

# BUSINESS HUB

The Business Hub stores permanent business information.

Examples:

Logo

Cover Images

Gallery

Videos

Services

Business Information

Smart Card

Booking Settings

Lead Settings

QR Codes

Reviews

Documents

Menus

Brochures

Social Links

Business Hours

These are long-lived assets.

Campaigns reference these assets.

They do not duplicate them.

---

# CAMPAIGN ENGINE

The Campaign Engine is the heart of Adpadz.

Campaigns are the ONLY source of truth for promotions.

Campaigns contain:

Title

Headline

Description

Offer

CTA

Media references

Dates

Status

Analytics

Campaigns NEVER duplicate business information.

Campaigns reference Business Hub assets.

---

# CAMPAIGN OUTPUTS

Campaign Outputs determine where campaigns appear.

Examples:

Smart Card

Interactive Ad

Community Mailer

QR Landing Page

Facebook

Instagram

Email

Flyer

Homepage

Future outputs may be added without changing Campaigns.

One Campaign

↓

Many Outputs

---

# SMART CARD

A Smart Card is NOT the campaign.

It is a business landing page.

The Smart Card renders:

Business information

Current campaigns

Offers

Booking

Lead forms

Media

Videos

Services

Testimonials

Before & After

Links

Analytics

The Smart Card should never become the source of truth for campaigns.

---

# INTERACTIVE ADS

Interactive Ads are Discovery.

They drive engagement.

Examples:

Tap To Reveal

Scratch Off

Before & After

Spin Wheel (future)

Memory Match (future)

Interactive Ads render Campaign content.

They never own Campaign content.

---

# COMMUNITY MAILERS

Community Mailers are distribution.

Mailers reference Campaigns.

Mailers do not duplicate campaign information.

---

# QR STUDIO

QR codes point users toward:

Campaigns

Smart Cards

Landing Pages

Offers

Booking

Videos

QR Studio stores destinations.

It does not duplicate Campaign content.

---

# LEADS

Every interaction should ultimately create:

Leads

Bookings

Offer Claims

Calls

Website Visits

Analytics Events

Everything feeds the Lead Manager.

---

# ASSET LIBRARY

Every uploaded asset exists only once.

Assets include:

Logo

Cover Images

Gallery

Commercials

Videos

Documents

PDFs

Menus

Brochures

QR Codes

Coupons

Campaigns reference assets.

Never upload the same item twice.

---

# DESIGN SYSTEM

All UI must come from the Adpadz Design System.

Pages should not invent new components.

Allowed UI building blocks:

Buttons

Cards

Badges

Pills

Sections

Action Bars

Heroes

Footers

Coupon Cards

Avatar

Gradients

If a component does not exist, create it inside the Design System.

Do not build page-specific components unless absolutely necessary.

---

# SECTION LIBRARY

Pages should assemble reusable sections.

Examples:

HeroSection

ActionSection

OfferSection

BookingSection

LeadSection

VideoSection

GallerySection

BeforeAfterSection

TestimonialsSection

LinksSection

FooterSection

Pages should compose sections.

Sections compose UI components.

---

# CUSTOMER JOURNEY

Adpadz follows this sequence:

Discovery

↓

Engagement

↓

Conversion

↓

Retention

Discovery

Interactive Ads

Community Mailers

QR Codes

Engagement

Smart Card

Campaign

Media

Conversion

Booking

Offer Claim

Lead Form

Phone Call

Retention

Repeat Campaigns

Future Notifications

Saved Businesses

Analytics

Every feature should support one or more stages.

---

# DATABASE OWNERSHIP

Every new feature must belong to ONE owner only.

Allowed owners:

Business Hub

Campaign

Campaign Output

Asset

Lead

Analytics

Do not create duplicate storage.

Never copy Campaign information into Smart Cards.

Never duplicate Assets.

Reference IDs whenever possible.

---

# CODING RULES

Before creating a table:

Ask:

"What owns this data?"

Before creating UI:

Ask:

"What Design System component should render this?"

Before creating a page:

Ask:

"What existing Sections can build this?"

Never duplicate logic.

Never duplicate UI.

Never duplicate data.

---

# ERROR HANDLING

Every Supabase write must throw on error.

No silent failures.

Pattern:

const { error } = ...

if (error) throw new Error(error.message);

After saving:

Always reload the saved record from Supabase.

Never assume local state is correct.

---

# VISUAL DESIGN

Adpadz should feel:

Premium

Modern

Beautiful

Minimal

Interactive

Confident

Local

Friendly

Never feel:

Busy

Corporate

Generic

Template-based

Dashboard-heavy

Every page should feel like part of one application.

---

# LONG-TERM VISION

Business creates one Campaign.

Campaign Engine automatically publishes to:

Smart Card

Interactive Ads

Community Mailer

QR Landing

Social Media

Email

Flyers

Future outputs

Business enters information once.

Adpadz distributes it everywhere.

---

# INSTRUCTIONS FOR CODEX

Before every implementation:

1. Read this document.

2. Follow it.

3. Do not invent alternate architectures.

4. Reuse existing Design System components.

5. Reuse existing Section Library components.

6. Reuse Business Hub assets.

7. Reuse Campaign Engine data.

8. Do not duplicate storage.

9. Explain any architectural changes before implementing them.

10. If a requested feature conflicts with this architecture, stop and explain why before making changes.
