const CACHE_PREFIX = 'adpadz-';
const CACHE_VERSION = 'v1';
const APP_SHELL_CACHE = `${CACHE_PREFIX}app-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `${CACHE_PREFIX}static-${CACHE_VERSION}`;
const MAX_RUNTIME_ENTRIES = 100;
const APP_SHELL_URLS = ['/manifest.json', '/icons/favicon.svg'];
const STATIC_DESTINATIONS = new Set(['font', 'image', 'script', 'style', 'worker']);
const API_PATH_PREFIXES = [
  '/api',
  '/auth/v1',
  '/functions/v1',
  '/graphql',
  '/realtime/v1',
  '/rest/v1',
  '/rpc',
  '/storage/v1',
  '/supabase',
];

function isCacheableResponse(response) {
  if (!response.ok || !['basic', 'default'].includes(response.type)) return false;

  const cacheControl = response.headers.get('cache-control')?.toLowerCase() ?? '';
  return !cacheControl.includes('no-store') && !cacheControl.includes('private');
}

function isApiRequest(request, url) {
  if (request.headers.has('authorization')) return true;
  if (url.hostname.includes('supabase')) return true;
  if (url.pathname.endsWith('.php')) return true;
  return API_PATH_PREFIXES.some(prefix => (
    url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  ));
}

function shouldHandle(request, url) {
  return request.method === 'GET'
    && url.origin === self.location.origin
    && !isApiRequest(request, url);
}

function isStaticAsset(request, url) {
  return STATIC_DESTINATIONS.has(request.destination)
    || url.pathname === '/manifest.json'
    || url.pathname.startsWith('/assets/');
}

function getLinkedStaticUrls(html) {
  const linkedUrls = [];
  const attributePattern = /(?:href|src)=["']([^"']+)["']/gi;

  for (const match of html.matchAll(attributePattern)) {
    try {
      const url = new URL(match[1], self.location.origin);
      const looksStatic = url.pathname.startsWith('/assets/')
        || /\.(?:avif|css|gif|ico|jpe?g|js|png|svg|webp|woff2?)$/i.test(url.pathname);

      if (url.origin === self.location.origin && looksStatic) {
        linkedUrls.push(url.href);
      }
    } catch {
      // Ignore malformed or non-URL attributes in the app shell.
    }
  }

  return [...new Set(linkedUrls)];
}

async function fetchAndCache(cache, request) {
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return null;
  }
}

async function cacheLinkedStaticAssets(cache, response) {
  const linkedUrls = getLinkedStaticUrls(await response.clone().text());
  await Promise.all(linkedUrls.map(url => fetchAndCache(cache, new Request(url, {
    cache: 'reload',
    credentials: 'same-origin',
  }))));
}

async function precacheAppShell() {
  const cache = await caches.open(APP_SHELL_CACHE);
  const shellRequest = new Request('/', { cache: 'reload', credentials: 'same-origin' });
  const shellResponse = await fetchAndCache(cache, shellRequest);

  if (shellResponse && isCacheableResponse(shellResponse)) {
    await cache.put('/index.html', shellResponse.clone());
    await cacheLinkedStaticAssets(cache, shellResponse);
  }

  await Promise.all(APP_SHELL_URLS.map(url => fetchAndCache(cache, new Request(url, {
    cache: 'reload',
    credentials: 'same-origin',
  }))));
}

async function updateCachedAppShell(request) {
  const response = await fetch(request);
  const contentType = response.headers.get('content-type') ?? '';

  if (isCacheableResponse(response) && contentType.includes('text/html')) {
    const cache = await caches.open(APP_SHELL_CACHE);
    await cacheLinkedStaticAssets(cache, response);
    await Promise.all([
      cache.put('/', response.clone()),
      cache.put('/index.html', response.clone()),
    ]);
  }

  return response;
}

async function appShellFirst(request, event) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cachedShell = await cache.match('/') ?? await cache.match('/index.html');

  if (cachedShell) {
    event.waitUntil(updateCachedAppShell(request).catch(() => undefined));
    return cachedShell;
  }

  try {
    return await updateCachedAppShell(request);
  } catch {
    return new Response(
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AdPadz offline</title></head><body><main><h1>You are offline</h1><p>Reconnect once to make AdPadz available offline.</p></main></body></html>',
      { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } },
    );
  }
}

async function cacheRuntimeAsset(request, response) {
  const cache = await caches.open(STATIC_CACHE);
  await cache.put(request, response);

  const keys = await cache.keys();
  const staleKeys = keys.slice(0, Math.max(0, keys.length - MAX_RUNTIME_ENTRIES));
  await Promise.all(staleKeys.map(key => cache.delete(key)));
}

async function cacheFirst(request, event) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (isCacheableResponse(response)) {
    event.waitUntil(cacheRuntimeAsset(request, response.clone()));
  }

  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(cacheName => cacheName.startsWith(CACHE_PREFIX))
        .filter(cacheName => ![APP_SHELL_CACHE, STATIC_CACHE].includes(cacheName))
        .map(cacheName => caches.delete(cacheName)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!shouldHandle(request, url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(appShellFirst(request, event));
    return;
  }

  if (isStaticAsset(request, url)) {
    event.respondWith(cacheFirst(request, event));
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
