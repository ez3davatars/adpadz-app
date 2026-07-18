import { expect, test, type Page, type Route } from '@playwright/test';

type MockAuthOptions = {
  delayMs?: number;
  responses?: Array<{ status: number; body: Record<string, unknown> }>;
};

async function mockPasswordAuth(page: Page, options: MockAuthOptions = {}) {
  let requestCount = 0;
  await page.route('**/auth/v1/token?grant_type=password', async (route: Route) => {
    requestCount += 1;
    if (options.delayMs) await new Promise(resolve => setTimeout(resolve, options.delayMs));
    const response = options.responses?.[Math.min(requestCount - 1, options.responses.length - 1)] ?? {
      status: 400,
      body: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    };
    await route.fulfill({ status: response.status, contentType: 'application/json', body: JSON.stringify(response.body) });
  });
  return () => requestCount;
}

async function fillSignIn(page: Page) {
  await page.goto('/auth');
  await page.getByLabel('Email').fill('  OWNER@Example.COM ');
  await page.getByLabel('Password', { exact: true }).fill('WrongPassword9!');
}

test.describe('authentication request discipline', () => {
  test('one click produces one request and a rerender does not resubmit', async ({ page }) => {
    const requestCount = await mockPasswordAuth(page);
    await fillSignIn(page);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByRole('alert')).toContainText('Check your email and password, then try again.');
    await expect(page.getByLabel('Email')).toHaveValue('owner@example.com');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword9!');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForTimeout(100);
    expect(requestCount()).toBe(1);
  });

  test('pressing Enter produces exactly one request', async ({ page }) => {
    const requestCount = await mockPasswordAuth(page);
    await fillSignIn(page);
    await page.getByLabel('Password', { exact: true }).press('Enter');

    await expect(page.getByRole('alert')).toBeVisible();
    expect(requestCount()).toBe(1);
  });

  test('rapid double clicking in React StrictMode produces one request', async ({ page }) => {
    const requestCount = await mockPasswordAuth(page, { delayMs: 100 });
    await fillSignIn(page);
    await page.getByRole('button', { name: 'Sign In' }).evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });

    await expect(page.getByRole('alert')).toBeVisible();
    expect(requestCount()).toBe(1);
  });

  test('signup uses one authoritative form submission', async ({ page }) => {
    const signupRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/auth/v1/signup')) signupRequests.push(request.url());
    });
    await page.route('**/auth/v1/signup', async route => {
      await new Promise(resolve => setTimeout(resolve, 75));
      await route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'email_exists', message: 'A user with this email address has already been registered' }),
      });
    });
    await page.goto('/auth');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await page.getByLabel('Full name').fill('Owner Example');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password', { exact: true }).fill('StrongPassword9!');
    await page.getByRole('button', { name: 'Create Account' }).evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });

    await expect(page.getByRole('alert')).toContainText('An account already exists for this email.');
    expect(signupRequests).toHaveLength(1);
  });

  test('429 starts a visible cooldown and blocks requests until it expires', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-07-18T12:00:00Z') });
    const requestCount = await mockPasswordAuth(page, {
      responses: [
        { status: 429, body: { code: 'over_request_rate_limit', message: 'Too many requests' } },
        { status: 400, body: { code: 'invalid_credentials', message: 'Invalid login credentials' } },
      ],
    });
    await fillSignIn(page);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.getByRole('alert')).toContainText('Too many attempts were sent. Please wait a moment before trying again.');
    await expect(page.getByRole('status')).toContainText('Authentication is paused for');
    await expect(page.getByRole('button', { name: /Try again in/ })).toBeDisabled();
    await page.getByLabel('Password', { exact: true }).fill('WrongPassword9!');
    await page.getByLabel('Password', { exact: true }).press('Enter');
    expect(requestCount()).toBe(1);

    await page.clock.fastForward(31_000);
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeEnabled();
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByRole('alert')).toContainText('Check your email and password, then try again.');
    expect(requestCount()).toBe(2);
  });
});