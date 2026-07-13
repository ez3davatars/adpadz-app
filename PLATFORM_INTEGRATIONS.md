# Platform integrations

This guide is for the Adpadz owner before direct publishing is built. Today,
Adpadz can prepare campaign content; it does not yet connect to or publish on
any third-party platform. Do not enter platform client secrets, access tokens,
or database passwords in `.env.local`, browser code, screenshots, or Git.

## Recommended order

1. X text publishing
2. Facebook Page publishing
3. Instagram Professional publishing
4. TikTok Upload (customer completes the post in TikTok)
5. TikTok Direct Post, after audit approval
6. Email sending through a transactional email provider

Every platform needs a production HTTPS callback URL. Use a stable domain, for
example `https://app.adpadz.co/integrations/<platform>/callback`. The final
paths may change when the backend is implemented, so register production and
staging callback URLs only after they are confirmed in code.

## Shared requirements

Before setting up any developer application, prepare:

- An Adpadz legal business identity and a dedicated owner email address.
- Public, live Privacy Policy, Terms, Support, and Data Deletion pages.
- A production app domain served over HTTPS.
- A brief screen recording showing: sign in, connect account, select a
  customer-owned account, preview a post, explicitly publish, and disconnect.
- A clear explanation of why each permission is requested.

The eventual implementation must keep credentials and refresh tokens in a
server-side secret store. It must encrypt customer connection tokens, enforce
business ownership via RLS, record consent/publish/disconnect events, support
token expiry and revocation, and never report a post as live until the platform
confirms it.

## X

### Owner setup

1. Create an X Developer account and create a Project and App in the Developer
   Console.
2. Enable user-context OAuth 2.0 Authorization Code with PKCE.
3. Register the approved Adpadz redirect URI and configure the app for Read and
   Write access.
4. Request only the scopes needed for the first release:
   `tweet.read`, `tweet.write`, `users.read`, and `offline.access` when token
   refresh is required.
5. Keep the client secret in the server-side deployment secret store only.

### First Adpadz release

- Let a customer connect their X account.
- Offer a character-aware preview and explicit Publish button.
- Use the user's authorization to create a post through `POST /2/tweets`.
- Save the returned post ID and URL; support retrying only safe failed jobs.
- Add media upload later, after text posting is proven.

Official references: [X authentication](https://docs.x.com/xdks/python/authentication),
[create/manage posts](https://docs.x.com/x-api/posts/manage-tweets/quickstart),
and [authentication/scopes mapping](https://docs.x.com/fundamentals/authentication/guides/v2-authentication-mapping).

## Facebook Pages

Adpadz should publish only to customer-managed Facebook Pages, never a
customer's personal profile.

### Owner setup

1. Create an app in [Meta for Developers](https://developers.facebook.com/).
2. Add Facebook Login for Business and set the valid OAuth redirect URI.
3. Add the Pages API/product capabilities required for publishing.
4. During development, add developers/testers and a test Page. Production
   customers cannot use the app until Meta grants the needed permissions and
   completes any required business verification/app review.
5. Prepare a review video and permission-use explanation for the exact scopes
   requested. For basic Page publishing this normally includes
   `pages_show_list`, `pages_read_engagement`, and `pages_manage_posts`.

### First Adpadz release

- Connect the customer's Meta account, then list only Pages they can manage.
- Require them to choose a Page before enabling publishing.
- Create text/link posts first; add photos, video, Reels, comments, and
  insights in later releases.
- Store the Page ID separately from the person's authorization and record the
  returned post ID.

Reference: Meta's [Instagram API collection](https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00)
describes the related Pages permissions; Meta's developer portal is the source
of truth for the current Facebook Pages review requirements.

## Instagram

Instagram publishing is for Professional accounts (Business or Creator), not
ordinary consumer accounts. Decide during implementation which Meta onboarding
route Adpadz supports and keep that route consistent.

### Owner setup

1. In the same Meta app, add the Instagram API/content-publishing capability.
2. Choose either Instagram Login or Facebook Login as the supported connection
   method. Facebook Login commonly requires a Page linked to the Professional
   Instagram account; Instagram Login has a distinct permission model.
3. Configure the redirect URI and request only publishing/basic permissions.
   For the Facebook Login route, the usual initial set is `instagram_basic`,
   `instagram_content_publish`, `pages_show_list`, and
   `pages_read_engagement`.
4. Complete Meta review/business verification before opening the feature to
   customers.

### First Adpadz release

- Check that the connected account is eligible before allowing a publish.
- Start with image/carousel feed posts or Reels only after validating the
  current API requirements.
- Generate the media container, poll until it is ready, publish it, and store
  the returned media ID/URL and status.
- Do not promise Stories support in the first release.

Official reference: [Meta's Instagram API documentation collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api?entity=request-23987686-26e7999c-fc7e-44c8-8f71-ab2de8d35c32).

## TikTok

TikTok needs video/photo assets in addition to caption text, so it is the
largest integration.

### Owner setup

1. Create an app in [TikTok for Developers](https://developers.tiktok.com/).
2. Add the Content Posting API product and configure web redirect URLs.
3. Verify the Adpadz app, Privacy Policy, Terms, and media hosting domain/URL
   prefix in the portal. A verified domain is required when TikTok pulls media
   from an Adpadz URL.
4. Build and test the Upload flow first using `video.upload`. It sends a draft
   to the customer's TikTok inbox, where they finish editing/publishing.
5. Request `video.publish` only when ready for Direct Post. Submit the app for
   audit with an end-to-end demo. Until it is audited, direct-posted content is
   restricted to private visibility.
6. Configure a webhook endpoint and verify its request handling before launch.

### First Adpadz release

- Require a compliant vertical video and caption preview.
- Connect a TikTok creator account and use the Upload flow first.
- Track the returned `publish_id` and show a truthful status: queued, uploaded,
  awaiting creator action, published, or failed.
- Add Direct Post only after TikTok grants approval and the UX handles creator
  settings, moderation, and delayed completion.

Official references: [Content Posting overview](https://developers.tiktok.com/products/content-posting-api/),
[Direct Post setup](https://developers.tiktok.com/doc/content-posting-api-get-started),
[Upload API](https://developers.tiktok.com/doc/content-posting-api-reference-upload-video/),
and [post status/webhooks](https://developers.tiktok.com/doc/content-posting-api-reference-get-video-status?enter_method=left_navigation).

## Email

Email is not a social-account OAuth integration. Adpadz will need a dedicated
transactional email provider (for example, Resend, Postmark, or Amazon SES),
plus a verified sending domain.

### Owner setup

1. Choose a provider and create a production account.
2. Add the DNS records the provider gives you (SPF, DKIM, and any required
   tracking/return-path records) for an Adpadz sending subdomain such as
   `mail.adpadz.co`.
3. Configure a branded sender address, reply handling, unsubscribe preference
   handling where required, and a webhook endpoint for deliveries, bounces,
   complaints, and opt-outs.
4. Keep the provider API key in deployment secrets only.

### First Adpadz release

- Start with owner-sent test emails and explicit recipient consent.
- Record delivery events and immediately suppress addresses that bounce or
  unsubscribe.
- Do not send marketing mail from a customer business until consent, sender
  identity, and legal requirements are implemented for the intended regions.

## What Adpadz will build after portal setup

1. Tables for platform connections, encrypted credentials, publish jobs, and
   immutable audit records.
2. OAuth start/callback endpoints and disconnect/revocation handling.
3. Server-only publishing workers plus webhook handlers.
4. Campaign preview, account picker, confirmation, scheduling, status, retry,
   and history UI.
5. Automated tests with test accounts and a production-readiness checklist.

Do not create production integrations one platform at a time inside the UI.
First create the developer apps and give Adpadz one documented, secure
connection model; then we can implement X as the smallest end-to-end pilot.
