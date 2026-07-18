const BUSINESS_DASHBOARD = "/app/business/dashboard";

export function getSafeAuthDestination(search: string) {
  const destination = new URLSearchParams(search).get("next");
  return destination?.startsWith("/") && !destination.startsWith("//")
    ? destination
    : BUSINESS_DASHBOARD;
}

export function isRecoveryRequest(search: string, hash = '') {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  return query.get('recovery') === '1' || fragment.get('type') === 'recovery';
}
