export const DEFAULT_AUTH_ERROR =
  'We could not complete that request. Please try again. If the problem continues, contact Adpadz support.';

export type AuthErrorLike = { code?: string; message?: string; status?: number };

function authErrorText(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as AuthErrorLike).message ?? '');
  return String(error ?? '');
}

export function mapAuthError(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as AuthErrorLike).code ?? '') : '';
  const detail = `${code} ${authErrorText(error)}`.toLowerCase();
  if (/invalid login credentials|invalid_credentials/.test(detail)) return 'Check your email and password, then try again.';
  if (/already registered|already exists|user_already_exists|identity_already_exists/.test(detail)) return 'An account already exists for this email.';
  if (/signup.*disabled|signups?.*(disabled|not allowed)|signup_disabled/.test(detail)) return 'New account signup is currently unavailable. Please contact Adpadz support.';
  if (/email not confirmed|email_not_confirmed/.test(detail)) return 'Confirm your email before signing in. You can resend the email below.';
  if (/weak password|password.*(weak|short|characters)|weak_password/.test(detail)) return 'Choose a stronger password with at least 8 characters, including a number and a letter.';
  if (/invalid email|email.*invalid|validation_failed/.test(detail)) return 'Enter a valid email address and try again.';
  if (/rate limit|too many requests|security purposes|over_email_send_rate_limit/.test(detail)) return 'Too many attempts were made. Please wait a few minutes before trying again.';
  if (/expired.*(token|link)|token.*expired|refresh_token_not_found/.test(detail)) return 'This link has expired. Request a new reset link and try again.';
  if (/invalid.*(otp|token)|otp.*invalid|otp_expired/.test(detail)) return 'This link is invalid or expired. Request a new one and try again.';
  if (/database error saving new user|unexpected_failure|database.*user/.test(detail)) return 'We could not finish creating your account. Please try again or contact Adpadz support.';
  if (/email.*(delivery|send|smtp)|error sending|email_provider_disabled/.test(detail)) return 'We could not deliver the email. Please try again shortly or contact Adpadz support.';
  if (/failed to fetch|network|load failed|fetch_error/.test(detail)) return 'Check your connection and try again.';
  return DEFAULT_AUTH_ERROR;
}

export function logAuthError(scope: string, error: unknown) {
  if (!import.meta.env.DEV) return;
  const value = error && typeof error === 'object' ? (error as AuthErrorLike) : {};
  console.error(`[${scope}] authentication failed`, {
    code: value.code ?? 'unknown',
    status: value.status ?? null,
    message: mapAuthError(error),
  });
}
