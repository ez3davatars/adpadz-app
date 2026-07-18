const BUSINESS_DASHBOARD = "/app/business/dashboard";

export function getSafeAuthDestination(search: string) {
  const destination = new URLSearchParams(search).get("next");
  return destination?.startsWith("/") && !destination.startsWith("//")
    ? destination
    : BUSINESS_DASHBOARD;
}
