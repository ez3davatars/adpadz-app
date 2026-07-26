const BUSINESS_DASHBOARD = "/app/business/dashboard";
const AUTH_REDIRECT_VALIDATION_ORIGIN = "https://adpadz.invalid";
const ENCODED_UNSAFE_PATH_CHARACTERS = /%(?:0[0-9a-f]|1[0-9a-f]|5c|7f)/i;

function hasUnsafePathCharacter(value: string) {
  return Array.from(value).some(character => {
    const code = character.charCodeAt(0);
    return character === "\\" || code <= 31 || code === 127;
  });
}

function isSafeInternalDestination(destination: string | null): destination is string {
  if (
    !destination
    || !destination.startsWith("/")
    || destination.startsWith("//")
    || hasUnsafePathCharacter(destination)
    || ENCODED_UNSAFE_PATH_CHARACTERS.test(destination)
  ) return false;

  try {
    const parsed = new URL(destination, AUTH_REDIRECT_VALIDATION_ORIGIN);
    return parsed.origin === AUTH_REDIRECT_VALIDATION_ORIGIN
      && parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
}

export function getSafeAuthDestination(search: string) {
  const destination = new URLSearchParams(search).get("next");
  return isSafeInternalDestination(destination)
    ? destination
    : BUSINESS_DASHBOARD;
}

export function getAuthSignInPath(destination: string) {
  const safeDestination = isSafeInternalDestination(destination)
    ? destination
    : BUSINESS_DASHBOARD;
  return `/auth?next=${encodeURIComponent(safeDestination)}`;
}

export function isRecoveryRequest(search: string, hash = '') {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  return query.get('recovery') === '1' || fragment.get('type') === 'recovery';
}
