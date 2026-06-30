/// <reference lib="deno.ns" />

import { createClient } from '@supabase/supabase-js';

type SmartCardImageType = 'logo' | 'cover' | 'gallery';

type CloudflareImagesUploadResult = {
  success?: boolean;
  result?: {
    id?: string;
    variants?: string[];
  };
  errors?: Array<{ message?: string }>;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxBytes: Record<SmartCardImageType, number> = {
  logo: 2 * 1024 * 1024,
  cover: 5 * 1024 * 1024,
  gallery: 5 * 1024 * 1024,
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Use POST to upload an image.' }, 405);
  }

  try {
    const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').trim();
    const supabaseAnonKey = (Deno.env.get('SUPABASE_ANON_KEY') || '').trim();
    const cloudflareAccountId = (Deno.env.get('CLOUDFLARE_ACCOUNT_ID') || '').trim();
    const cloudflareToken = (
      Deno.env.get('CLOUDFLARE_IMAGES_API_TOKEN') ||
      Deno.env.get('CLOUDFLARE_API_TOKEN') ||
      ''
    ).trim();
    const cloudflareAccountHash = (Deno.env.get('CLOUDFLARE_IMAGES_ACCOUNT_HASH') || '').trim();

    if (!supabaseUrl || !supabaseAnonKey) {
      return json({ error: 'Upload service is missing Supabase configuration.' }, 500);
    }

    if (!cloudflareAccountId) {
      return json({ error: 'Missing Cloudflare account ID' }, 500);
    }

    if (!cloudflareToken) {
      return json({ error: 'Missing Cloudflare token' }, 500);
    }

    const authorization = request.headers.get('Authorization') ?? '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return json({ error: 'Sign in before uploading Smart Card images.' }, 401);
    }

    const incomingFormData = await request.formData();
    const file = incomingFormData.get('file');
    const cardId = String(incomingFormData.get('card_id') ?? '').trim();
    const imageType = String(incomingFormData.get('image_type') ?? '').trim();

    if (!cardId) {
      return json({ error: 'Save the Smart Card before uploading images.' }, 400);
    }

    if (!file) {
      return json({ error: 'Missing file' }, 400);
    }

    if (!(file instanceof File)) {
      return json({ error: 'Invalid file upload' }, 400);
    }

    if (!isSmartCardImageType(imageType)) {
      return json({ error: 'Unsupported image type' }, 400);
    }

    if (!allowedTypes.has(file.type)) {
      return json(
        {
          error:
            'Use a JPEG, PNG, or WebP image. GIF, SVG, HEIC, BMP, and TIFF files are not supported.',
        },
        400,
      );
    }

    if (file.size > maxBytes[imageType]) {
      return json({ error: 'File too large' }, 400);
    }

    const { data: card, error: cardError } = await supabase
      .from('business_cards')
      .select('id,owner_user_id')
      .eq('id', cardId)
      .eq('owner_user_id', userData.user.id)
      .maybeSingle();

    if (cardError || !card) {
      return json({ error: 'You can only upload images to Smart Cards you own.' }, 403);
    }

    const cloudflareForm = new FormData();
    cloudflareForm.append('file', file, file.name);

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/images/v1`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cloudflareToken}`,
        },
        body: cloudflareForm,
      },
    );

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Cloudflare Images upload failed', {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      });

      return json({ error: 'Cloudflare Images rejected the upload.' }, 502);
    }

    const uploadResult = parseJson(responseText);

    if (!uploadResult?.success || !uploadResult.result?.id) {
      console.error('Cloudflare Images returned an unexpected payload', {
        status: response.status,
        statusText: response.statusText,
        body: responseText,
      });

      return json({ error: 'Cloudflare Images returned an invalid upload response.' }, 502);
    }

    const imageId = uploadResult.result.id;
    const firstVariant = uploadResult.result.variants?.find(Boolean) ?? null;
    const url = firstVariant || buildCloudflareDeliveryUrl(cloudflareAccountHash, imageId);

    if (!url) {
      return json({ error: 'Cloudflare Images did not return a delivery URL.' }, 502);
    }

    return json({
      url,
      imageId,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Image upload failed.' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function isSmartCardImageType(value: string): value is SmartCardImageType {
  return value === 'logo' || value === 'cover' || value === 'gallery';
}

function buildCloudflareDeliveryUrl(accountHash: string, imageId: string): string | null {
  if (!accountHash) {
    return null;
  }

  return `https://imagedelivery.net/${accountHash}/${imageId}/public`;
}

function parseJson(value: string): CloudflareImagesUploadResult | null {
  try {
    return JSON.parse(value) as CloudflareImagesUploadResult;
  } catch {
    return null;
  }
}
