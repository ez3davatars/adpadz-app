type QrDatabaseError = {
  code?: unknown;
  constraint?: unknown;
  message?: unknown;
};

export function isQrSlugConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as QrDatabaseError;
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const constraint = typeof candidate.constraint === 'string' ? candidate.constraint : '';
  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : '';

  return (code === '23505' && (!constraint || constraint === 'qr_links_slug_key'))
    || constraint === 'qr_links_slug_key'
    || message.includes('qr_links_slug_key');
}