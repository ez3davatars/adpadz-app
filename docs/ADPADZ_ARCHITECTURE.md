# ADPADZ ARCHITECTURE

Status: Active

Owner: Product Architecture

---

# Purpose

This document defines the production architecture of Adpadz.

It establishes ownership, data flow, system boundaries, and implementation rules.

Business philosophy belongs in ADPADZ_PRINCIPLES.md.

Product direction belongs in ADPADZ_PRODUCT_VISION.md.

This document defines how the platform is constructed.

---

# Architectural Goal

The architecture exists to support one philosophy:

Create Once.

Publish Everywhere.

Businesses create one Campaign.

Every destination references that Campaign.

No duplication.

No disconnected systems.

---

# Core Product Hierarchy

Business

↓

Business Hub

↓

Campaign

↓

Campaign Engine

↓

Campaign Destinations

↓

Consumer Experience

Everything flows in this direction.

Data should never flow backward.

---

# Business Hub

The Business Hub is the permanent home of every business.

Business Hub owns:

• business information

• branding

• locations

• services

• hours

• gallery

• videos

• documents

• booking settings

• social links

• reviews

• lead settings

• QR identities

Business Hub owns permanent business assets.

Campaigns reference Business Hub.

Never duplicate permanent information.

---

# Campaign

Campaigns represent temporary marketing initiatives.

Examples:

Holiday Sale

Grand Opening

Customer Appreciation

Summer Promotion

New Product

Campaigns own:

headline

description

offer

CTA

schedule

campaign media

analytics

status

Campaigns never own permanent business information.

---

# Campaign Engine

Campaign Engine is the heart of Adpadz.

Every marketing experience references Campaign Engine.

Future marketing systems must extend Campaign Engine.

Never bypass it.

---

# Campaign Destinations

Campaign Destinations define where Campaigns appear.

Examples:

Community Mailer

Business Hub

Campaign Page

QR Experience

Consumer Discovery

Adpadz TV

Interactive Ads

Future Social Publishing

Future Email Marketing

Future Mobile Notifications

Adding a destination should never require redesigning Campaign Engine.

Campaign Engine remains unchanged.

Only new destination renderers are added.

---

# Community Mailer

Community Mailers are campaign distribution.

They reference Campaigns.

They never own Campaign content.

The Community Mailer Builder controls:

Zones

Layouts

Placements

Featured Sponsors

Print Production

Artwork Approval

QR placement

Community Mailers should remain independent from campaign creation.

---

# Consumer Discovery

Consumer Discovery is the primary browsing experience.

Consumers browse Campaigns.

Never business listings.

Never directories.

Discovery references Campaigns.

Discovery owns no campaign data.

Possible discovery views include:

Category

Nearby

Newest

Featured

Offers

Search

Future AI Recommendations

---

# Adpadz TV

Adpadz TV is a Campaign renderer.

It is not another campaign type.

Every Campaign should be capable of rendering as:

Static

Animated

Video

Interactive

Future media formats should extend this renderer.

---

# Smart Business Hub

Business Hub displays:

Business information

Current Campaigns

Past Campaigns

Offers

Media

Booking

Lead Capture

Reviews

Directions

Hours

Business Hub owns presentation.

Campaign Engine owns promotions.

---

# Asset Library

Every uploaded asset exists once.

Examples:

Logo

Cover Image

Gallery

Video

Commercial

Brochure

Menu

Coupon

Campaign Artwork

Assets are referenced.

Never duplicated.

---

# QR Studio

QR Studio owns destinations.

QR codes may point to:

Campaign

Business Hub

Booking

Offer

Campaign Landing

Future Experiences

QR Studio never stores campaign content.

---

# Lead Manager

Every meaningful interaction becomes an event.

Examples:

QR Scan

Campaign View

Offer Save

Website Visit

Phone Tap

Booking

Lead Form

Directions

Everything ultimately feeds Analytics.

---

# Analytics

Analytics reference:

Campaign

Business

Destination

Consumer Action

Analytics should never become business logic.

Analytics observe.

They do not control.

---

# Design System

Every interface must be assembled from the Design System.

Pages assemble Sections.

Sections assemble Components.

Components render Data.

Never bypass this hierarchy.

---

# Section Library

Reusable sections include:

Hero

Campaign

Offer

Gallery

Video

Booking

Lead

Reviews

Before & After

Testimonials

Footer

Pages compose sections.

Sections compose components.

---

# Database Ownership

Every piece of data has one owner.

Permanent Business Data

↓

Business Hub

Marketing

↓

Campaign

Media

↓

Asset Library

Consumer Actions

↓

Analytics

Leads

↓

Lead Manager

Never duplicate ownership.

---

# Security

Every destination enforces its own permissions.

Business Hub

↓

Business ownership

Mission Control

↓

Administrative authorization

Consumer Discovery

↓

Public-safe campaign data

Community Mailer

↓

Campaign references only

Authorization should remain server enforced.

Never trust client state.

---

# Extending the Platform

When adding a feature ask:

Can Business Hub own this?

Can Campaign Engine own this?

Can Asset Library own this?

Can Analytics observe this?

If yes,

extend the existing system.

Never create parallel systems.

---

# Coding Rules

Before creating:

Table

API

Component

Workflow

Renderer

Ask:

Who owns this?

If ownership is unclear,

the feature is not ready.

---

# Long-Term Architecture

Business

↓

Business Hub

↓

Campaign Engine

↓

Campaign Destinations

↓

Consumer Engagement

↓

Analytics

↓

Campaign Renewal

Every new feature should strengthen this lifecycle.

Never interrupt it.

---

# Final Rule

Architectures evolve.

Principles do not.

If implementation conflicts with:

ADPADZ_PRINCIPLES.md

the implementation should change.

Not the principles.