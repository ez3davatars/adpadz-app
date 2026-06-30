# upload-smart-card-image

Secure Supabase Edge Function for Adpadz Smart Card image uploads.

Required Supabase function secrets:

```bash
supabase secrets set CLOUDFLARE_ACCOUNT_ID=...
supabase secrets set CLOUDFLARE_IMAGES_API_TOKEN=...
supabase secrets set CLOUDFLARE_IMAGES_ACCOUNT_HASH=...
```

Do not expose these values with a `VITE_` prefix. The browser only calls this
function with the signed-in user's Supabase session.

Deploy:

```bash
supabase functions deploy upload-smart-card-image
```
