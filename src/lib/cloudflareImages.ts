import { supabase } from './supabase';

export type SmartCardImageType = 'logo' | 'cover' | 'gallery';

export type SmartCardImageUploadResult = {
  imageId: string;
  imageUrl: string;
};

type SmartCardImageUploadResponse = Partial<SmartCardImageUploadResult> & {
  url?: unknown;
  imageUrl?: unknown;
  image_url?: unknown;
  publicUrl?: unknown;
  public_url?: unknown;
  imageId?: unknown;
  image_id?: unknown;
};

export type UploadProgress = {
  percentage: number;
  label: string;
};

export const SMART_CARD_IMAGE_LIMITS = {
  free: 2,
  pro: 10,
  campaign: 20,
} as const;

export const DEFAULT_SMART_CARD_IMAGE_PLAN: keyof typeof SMART_CARD_IMAGE_LIMITS = 'pro';
export const DEFAULT_SMART_CARD_IMAGE_LIMIT = SMART_CARD_IMAGE_LIMITS[DEFAULT_SMART_CARD_IMAGE_PLAN];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES: Record<SmartCardImageType, number> = {
  logo: 2 * 1024 * 1024,
  cover: 5 * 1024 * 1024,
  gallery: 5 * 1024 * 1024,
};

export function validateSmartCardImageFile(file: File, imageType: SmartCardImageType): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return 'Use a JPEG, PNG, or WebP image. GIF, SVG, HEIC, BMP, and TIFF files are not supported.';
  }

  if (file.size > MAX_IMAGE_BYTES[imageType]) {
    const maxMb = MAX_IMAGE_BYTES[imageType] / 1024 / 1024;
    return `${imageType === 'logo' ? 'Logo' : 'Image'} uploads must be ${maxMb} MB or smaller.`;
  }

  return null;
}

export function validateSmartCardImageLimit(currentImageCount: number): string | null {
  if (currentImageCount >= DEFAULT_SMART_CARD_IMAGE_LIMIT) {
    return `This plan supports up to ${DEFAULT_SMART_CARD_IMAGE_LIMIT} images per Smart Card.`;
  }

  return null;
}

export async function uploadSmartCardImage({
  file,
  cardId,
  imageType,
  onProgress,
}: {
  file: File;
  cardId: string;
  imageType: SmartCardImageType;
  onProgress?: (progress: UploadProgress) => void;
}): Promise<SmartCardImageUploadResult> {
  const validationError = validateSmartCardImageFile(file, imageType);
  if (validationError) {
    throw new Error(validationError);
  }

  onProgress?.({ percentage: 12, label: 'Validating image' });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('card_id', cardId);
  formData.append('image_type', imageType);

  onProgress?.({ percentage: 45, label: 'Uploading to Cloudflare Images' });

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Your login session is not available for uploads. Sign out, sign back in, then try again.');
  }

  const invokePromise = supabase.functions.invoke('upload-smart-card-image', {
    body: formData,
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
  });
  const { data, error } = await withUploadTimeout(invokePromise);

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  const result = data as SmartCardImageUploadResponse | null;
  const imageUrl = getImageUrlFromUploadResponse(result);
  const imageId = getStringValue(result?.imageId) ?? getStringValue(result?.image_id);

  if (!imageUrl || !imageId) {
    console.error('Smart Card image upload returned an unexpected response payload.', result);
    throw new Error('The image uploaded, but Adpadz could not read the hosted image response. Please try again.');
  }

  onProgress?.({ percentage: 100, label: 'Image ready' });

  return {
    imageId,
    imageUrl,
  };
}

function getImageUrlFromUploadResponse(result: SmartCardImageUploadResponse | null): string | null {
  return (
    getStringValue(result?.url) ??
    getStringValue(result?.imageUrl) ??
    getStringValue(result?.image_url) ??
    getStringValue(result?.publicUrl) ??
    getStringValue(result?.public_url)
  );
}

function getStringValue(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function withUploadTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error('The image upload service did not respond. Check that the Supabase Edge Function is deployed and configured.'));
    }, 45000);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error && error.message ? error.message : 'Image upload failed.';
  const context = typeof error === 'object' && error !== null && 'context' in error ? (error as { context?: unknown }).context : null;

  if (context instanceof Response) {
    try {
      const payload = await context.clone().json() as { error?: unknown; message?: unknown };
      if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
      if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
    } catch {
      try {
        const text = await context.clone().text();
        if (text.trim()) return text.trim();
      } catch {
        return fallback;
      }
    }
  }

  if (/authentication failed/i.test(fallback)) {
    return 'Supabase rejected the upload login token. Sign out of Adpadz, clear this localhost site data if needed, sign back in to the current Supabase project, then try again. If it still fails, redeploy the upload-smart-card-image function with the current project linked.';
  }

  return fallback;
}
