export function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function createSlugFromTitle(title: string): string {
  const normalized = normalizeSlug(title);
  return normalized || `adpadz-${Date.now().toString(36)}`;
}

export function validateHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || Array.from(trimmed).some(character => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  })) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isLocalhostHost(hostname: string | undefined | null): boolean {
  const host = hostname?.trim().toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

export function isLocalhostUrl(value: string | undefined | null): boolean {
  if (!value) return false;

  try {
    return isLocalhostHost(new URL(value).hostname);
  } catch {
    const normalized = value.toLowerCase();
    return normalized.includes('localhost') || normalized.includes('127.0.0.1');
  }
}

export function getPublicAppUrl(): string {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  const browserOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://adpadz.co';
  const browserHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const isBrowserLocal = isLocalhostHost(browserHost);
  const configuredIsLocal = isLocalhostUrl(configured);

  if (configured && !(configuredIsLocal && !isBrowserLocal)) {
    return configured.replace(/\/+$/g, '');
  }

  return browserOrigin.replace(/\/+$/g, '');
}

export function getDefaultAppUrl(): string {
  return getPublicAppUrl();
}

export function buildShortUrl(slug: string, baseUrl = getPublicAppUrl()): string {
  const normalizedSlug = normalizeSlug(slug) || 'demo';
  return `${baseUrl.replace(/\/+$/g, '')}/q/${normalizedSlug}`;
}

export function shortUrlUsesLocalhostInProduction(shortUrl: string): boolean {
  if (typeof window === 'undefined' || isLocalhostHost(window.location.hostname)) {
    return false;
  }

  return isLocalhostUrl(shortUrl);
}

export function parseTags(value: string): string[] {
  return value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function formatDateTime(value: string | null): string {
  if (!value) return '--';

  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function makeDownloadFilename(slug: string, extension: 'svg' | 'png'): string {
  const safeSlug = normalizeSlug(slug) || 'adpadz-qr';
  return `${safeSlug}-pad-qr.${extension}`;
}

export function downloadSvgElementAsSvg(svgElement: SVGSVGElement, filename: string): void {
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const svgText = new XMLSerializer().serializeToString(clonedSvg);
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function downloadSvgElementAsPng(svgElement: SVGSVGElement, filename: string, scale = 2): void {
  const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
  clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const svgText = new XMLSerializer().serializeToString(clonedSvg);
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  const image = new Image();

  image.onload = () => {
    const width = Number(svgElement.getAttribute('width')) || 1000;
    const height = Number(svgElement.getAttribute('height')) || 1000;
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const context = canvas.getContext('2d');
    if (!context) {
      URL.revokeObjectURL(svgUrl);
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngUrl = canvas.toDataURL('image/png');
    triggerDownload(pngUrl, filename);
    URL.revokeObjectURL(svgUrl);
  };

  image.onerror = () => URL.revokeObjectURL(svgUrl);
  image.src = svgUrl;
}

function triggerDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
