# Adpadz QR Studio Starter

This package adds the first working Adpadz feature: a circular, Flowcode-style Pad QR generator with dynamic Adpadz short links, Supabase-backed saved QR links, scan logging, and PNG/SVG export.

## What it adds

- Business dashboard route: `/app/business/qr-studio`
- Public redirect route: `/q/:slug`
- Circular Pad QR renderer with:
  - circular badge frame
  - dotted QR modules
  - curved text ring
  - center Adpadz badge
  - short URL label
  - PNG and SVG download
- Supabase tables:
  - `qr_links`
  - `qr_scan_events`
  - `qr_link_attachments`
- Navigation item: `QR Studio`
- Scan counter via database trigger

## Files included

```text
package.json
src/App.tsx
src/components/layout/BusinessLayout.tsx
src/components/qr/CircularPadQR.tsx
src/lib/qr/qrTypes.ts
src/lib/qr/qrUtils.ts
src/pages/business/QRStudio.tsx
src/pages/QRRedirect.tsx
supabase/migrations/20260626000100_create_qr_studio_tables.sql
```

## Install

Copy these files into the repo, replacing the existing files where paths match.

Then install the QR dependency:

```bash
npm install
```

or explicitly:

```bash
npm install qrcode
npm install -D @types/qrcode
```

## Supabase setup

Run the migration:

```bash
supabase db push
```

If you are not using the Supabase CLI locally, paste the SQL from:

```text
supabase/migrations/20260626000100_create_qr_studio_tables.sql
```

into the Supabase SQL editor.

## Environment recommendation

Set this in your local `.env` and production environment:

```text
VITE_PUBLIC_APP_URL=https://adpadz.co
```

Without it, QR Studio uses the current browser origin, such as `http://localhost:5173`. That is fine for testing, but not for printed marketing materials.

## Local test flow

1. Start the app.
2. Sign in.
3. Open `/app/business/qr-studio`.
4. Create a QR link.
5. Save it before downloading for print.
6. Scan or open `/q/{slug}`.
7. Confirm it redirects and increments the scan count.

## Important implementation note

The redirect route is implemented as a Vite/React route for the first version. This is enough to start using QR Studio internally. Later, replace or supplement it with a server-side Supabase Edge Function or hosting rewrite for more reliable scan logging before redirects.
