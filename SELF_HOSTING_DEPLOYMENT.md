# Self-hosting Adpadz on Apache or cPanel

This guide deploys the Vite frontend and PHP QR redirect fallback to standard Apache/cPanel hosting.

The hosted QR path is:

    QR code -> https://adpadz.co/q/{slug} -> Supabase redirect RPC -> saved destination

The frontend and PHP redirect use only the Supabase anon/publishable key. Never expose a service-role key.

## 1. Apply the database

Link the correct Supabase project, then apply every file in supabase/migrations in filename order:

    npx supabase db push --include-all

Do not cherry-pick only the QR migrations. The completed app also depends on the Business Hub, Smart Cards, campaigns, campaign events, services, transactional save RPCs, leads, and security-hardening migrations. The include-all flag also applies the replay-safe foundation migration when an existing remote history has already advanced beyond its timestamp.

At minimum, verify these core objects:

- businesses
- business_cards and their child tables
- business_marketing_assets
- business_services
- campaigns
- campaign_outputs
- campaign_events
- qr_links
- qr_scan_events
- save_business_hub
- save_campaign_bundle
- save_smart_card_bundle
- resolve_qr_redirect
- demo_accounts
- is_demo_account
- reset_demo_workspace

Database deployment requires a Supabase role with migration privileges.

## 2. Provision the optional private demo account

The public `/examples` showcase and `/demo/workspace` sandbox require no account setup. For owner-led presentations inside the real authenticated workspace, provision a dedicated private demo account after the migrations are applied.

Set these environment variables only in the shell or secure CI job running the provisioner:

    SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
    SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
    DEMO_ACCOUNT_EMAIL=YOUR_PRIVATE_DEMO_EMAIL
    DEMO_ACCOUNT_PASSWORD=YOUR_STRONG_PRIVATE_DEMO_PASSWORD

Then run:

    npm run demo:provision

If Auth CAPTCHA enforcement applies to password sign-in, also provide a fresh `DEMO_ACCOUNT_CAPTCHA_TOKEN`. The provisioner never prints the password or service key, refuses a `VITE_SUPABASE_SERVICE_ROLE_KEY`, and will not convert an existing non-demo Auth user. Always use a fresh email reserved for demonstrations.

Keep the demo credentials private. The account can edit its own normal workspace, so publishing shared credentials would allow visitors to overwrite each other's presentation. The private account uses a compact database-backed River City fixture, so its record counts intentionally differ from the broader illustrative totals in the public showcase. The in-app **Reset demo** action calls the protected reset RPC and restores only this registered account's fictional River City data.

## 3. Deploy the upload function

If hosted image uploads are enabled, configure and deploy:

    supabase functions deploy upload-smart-card-image

Follow supabase/functions/upload-smart-card-image/README.md for the required Cloudflare secrets.

## 4. Build the frontend

Create .env.production locally:

    VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
    VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY
    VITE_PUBLIC_APP_URL=https://adpadz.co

Then run:

    npm install
    npm run typecheck
    npm run lint
    npm test
    npm run build

## 5. Configure authentication redirects

Set the Supabase Auth site URL to the deployed HTTPS origin:

    https://adpadz.co

Add the deployed dashboard URL to the Auth redirect allow list so signup confirmations and password-recovery emails can return to the app:

    https://adpadz.co/app/business/dashboard

For local development, also allow the local origin you actually use, such as http://localhost:5173/**. Configure a production SMTP provider before launch; Supabase's development mail service is not intended for production delivery volume.

## 6. Upload the site

Upload the contents of dist/ to the domain document root.

Confirm these files are present:

- .htaccess
- index.html
- manifest.json
- sw.js
- qr-redirect.php
- qr-config.example.php
- assets/

The included .htaccess must remain in place so React routes fall back to index.html while the hosted /q/{slug} path reaches qr-redirect.php.

## 7. Configure PHP QR redirects

On the production server, create qr-config.php beside qr-redirect.php:

    <?php
    return [
      'supabase_url' => 'https://YOUR_PROJECT_REF.supabase.co',
      'supabase_anon_key' => 'YOUR_SUPABASE_ANON_OR_PUBLISHABLE_KEY',
    ];

Do not commit qr-config.php if it contains environment-specific configuration.

## 8. Production smoke test

1. Open the landing page and the public campaign feed.
2. Create or sign into a business account.
3. Save Business Settings.
4. Create and publish a Business Profile.
5. Add a Business Hub asset and service.
6. Create an active campaign with Interactive Campaign and Business Profile outputs.
7. Open the public interactive campaign and trigger a reveal and CTA.
8. Submit a lead or booking request from the public profile.
9. Create and scan a QR link.
10. Confirm the Lead Manager and Analytics pages show the new activity.
11. Reload an installed PWA page and confirm the static app shell remains available.
12. Open `/examples` and complete the no-sign-in guided demo on desktop and mobile.
13. If provisioned, sign in to the private demo account, reset it, and confirm its returned Business Profile, campaign, and QR paths resolve to the River City fixture.

## Local development

Use:

    VITE_PUBLIC_APP_URL=http://localhost:5173

The React /q/{slug} route supports local testing. Production and printed QR codes should always use the deployed HTTPS domain.
