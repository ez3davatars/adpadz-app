import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTH_ERROR, isAuthRateLimitError, mapAuthError } from './authErrors';

describe('auth error mapper', () => {
  it.each([
    ['Invalid login credentials', 'Check your email and password, then try again.'],
    ['User already registered', 'An account already exists for this email.'],
    ['Signups not allowed for this instance', 'New account signup is currently unavailable. Please contact Adpadz support.'],
    ['Email not confirmed', 'Confirm your email before signing in. You can resend the email below.'],
    ['Password should be at least 8 characters', 'Choose a stronger password with at least 8 characters, including a number and a letter.'],
    ['Invalid email', 'Enter a valid email address and try again.'],
    ['Email rate limit exceeded', 'Too many attempts were sent. Please wait a moment before trying again.'],
    ['Token has expired', 'This link has expired. Request a new reset link and try again.'],
    ['Invalid OTP', 'This link is invalid or expired. Request a new one and try again.'],
    ['Database error saving new user', 'We could not finish creating your account. Please try again or contact Adpadz support.'],
    ['Error sending confirmation email', 'We could not deliver the email. Please try again shortly or contact Adpadz support.'],
    ['Failed to fetch', 'Check your connection and try again.'],
  ])('maps %s', (message, expected) => {
    expect(mapAuthError(new Error(message))).toBe(expected);
  });

  it.each([
    [{ code: 'invalid_credentials', status: 400 }, 'Check your email and password, then try again.'],
    [{ code: 'email_not_confirmed', status: 400 }, 'Confirm your email before signing in. You can resend the email below.'],
    [{ code: 'user_already_exists', status: 422 }, 'An account already exists for this email.'],
    [{ code: 'email_exists', status: 422 }, 'An account already exists for this email.'],
    [{ code: 'over_request_rate_limit', status: 429 }, 'Too many attempts were sent. Please wait a moment before trying again.'],
    [{ code: 'over_email_send_rate_limit', status: 429 }, 'Too many attempts were sent. Please wait a moment before trying again.'],
  ])('maps Supabase code $code', (error, expected) => {
    expect(mapAuthError(error)).toBe(expected);
  });

  it('recognizes rate limiting by status or Supabase code', () => {
    expect(isAuthRateLimitError({ status: 429 })).toBe(true);
    expect(isAuthRateLimitError({ code: 'over_request_rate_limit' })).toBe(true);
    expect(isAuthRateLimitError({ code: 'invalid_credentials', status: 400 })).toBe(false);
  });

  it('uses the required safe fallback for unexpected errors', () => {
    expect(mapAuthError(new Error('internal detail'))).toBe(DEFAULT_AUTH_ERROR);
  });
});
