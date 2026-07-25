export function isPublicStandaloneRoute(pathname: string): boolean {
  return pathname === '/'
    || pathname === '/examples'
    || pathname.startsWith('/demo')
    || pathname === '/privacy'
    || pathname === '/terms'
    || /^\/(?:q|c|business|community-cards|ad|redeem)\/[^/]+\/?$/.test(pathname)
    || pathname === '/feed';
}