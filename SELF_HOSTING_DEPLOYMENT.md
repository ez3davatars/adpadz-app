# Self-Hosting Adpadz on Apache/cPanel

This guide deploys the Vite-built Adpadz app to standard Apache/cPanel-style hosting with PHP support. The QR redirect model is:

`QR code -> https://adpadz.co/q/{slug} -> saved destination URL`

No Supabase service-role key is required on the frontend or in the PHP redirect endpoint.

## A. Supabase Setup

Run these migrations in order:

1. `supabase/migrations/20260626000100_create_qr_studio_tables.sql`
2. `supabase/migrations/20260626000200_create_qr_redirect_rpc.sql`

Confirm these database objects exist:

- `qr_links`
- `qr_scan_events`
- `qr_link_attachments`
- `resolve_qr_redirect` RPC

The RPC resolves one slug at a time, logs a scan event, and returns only the redirect result. It does not expose all QR links or private QR metadata.

## B. Local Production Build

Create `.env.production` locally:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
VITE_PUBLIC_APP_URL=https://adpadz.co
```

Notes:

- `VITE_PUBLIC_APP_URL` must be the deployed Adpadz domain, such as `https://adpadz.co`.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are frontend-safe Supabase values.
- Do not put a Supabase service-role key in any `VITE_` variable.
- Do not commit real `.env` files.

Build locally:

```bash
npm install
npm run typecheck
npm run build
```

## C. Upload to Hosting

Upload the contents of `dist/` to the Adpadz domain document root.

Confirm these files exist in the uploaded document root:

- `.htaccess`
- `index.html`
- `qr-redirect.php`
- `qr-config.example.php`

On the production server, create `qr-config.php` from `qr-config.example.php`:

```php
<?php
return [
  'supabase_url' => 'https://YOUR_PROJECT_REF.supabase.co',
  'supabase_anon_key' => 'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY',
];
```

Do not commit or upload private local `.env` files. Do not expose a service-role key.

## D. Test

1. Visit `https://adpadz.co/app/business/qr-studio`.
2. Create a QR link.
3. Confirm the generated short link looks like `https://adpadz.co/q/{slug}`.
4. Open the short link directly in a browser.
5. Scan the QR from a phone.
6. Confirm it redirects to the destination URL.
7. Confirm a scan event appears in Supabase.

## Local Development

Local development can still use `http://localhost:5173/q/{slug}` through the React app. Production and printed QR codes should use `VITE_PUBLIC_APP_URL=https://adpadz.co` so generated QR codes encode the hosted Adpadz short link.