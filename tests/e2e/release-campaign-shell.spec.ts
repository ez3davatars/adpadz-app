import { expect, test, type Page, type TestInfo } from '@playwright/test';

const password = 'AdpadzDemo!2026';
const owner = 'owner@adpadz-demo.test';
const campaignId = '30000000-0000-4000-8000-000000000001';
const setupRoute = `/app/business/campaigns/${campaignId}/setup`;

function monitorPage(page: Page, testInfo: TestInfo) {
  const failures: string[] = [];
  const context = (kind: string, detail: string) =>
    `[${new Date().toISOString()}] project=${testInfo.project.name} navigation=${page.url()} ${kind} ${detail}`;

  page.on('pageerror', error => failures.push(context('pageerror', error.message)));
  page.on('console', message => {
    if (message.type() === 'error') failures.push(context('console', message.text()));
  });
  page.on('requestfailed', request => {
    const errorText = request.failure()?.errorText ?? '';
    if (errorText !== 'net::ERR_ABORTED') {
      failures.push(context('requestfailed', `url=${request.url()} error=${errorText}`));
    }
  });
  page.on('response', response => {
    if (response.status() >= 400 && /\/(rest|auth|storage)\/v1\//.test(response.url())) {
      failures.push(context('http', `status=${response.status()} url=${response.url()}`));
    }
  });

  return failures;
}

async function signIn(page: Page, next: string) {
  await page.goto(`/auth?next=${encodeURIComponent(next)}`);
  await page.getByLabel('Email').fill(owner);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth, `${label} horizontal overflow`).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test('Campaign shell carries one workflow across Setup, Studio, Review, and Publish', async ({ page }, testInfo) => {
  const failures = monitorPage(page, testInfo);

  // Authentication returns the user to the requested Campaign stage.
  await signIn(page, setupRoute);
  await expect(page).toHaveURL(new RegExp(`${campaignId}/setup`));

  const workflow = page.getByRole('navigation', { name: 'Campaign workflow' });
  await expect(workflow).toBeVisible();
  const campaignTitle = (await page.locator('h1').first().innerText()).trim();
  expect(campaignTitle.length).toBeGreaterThan(0);
  await expect(workflow.getByRole('link', { name: /Setup/ })).toHaveAttribute('aria-current', 'step');
  await assertNoHorizontalOverflow(page, `${testInfo.project.name} setup`);

  // The Setup stage owns campaign content, never creative authoring.
  await expect(page.getByText('Reset image framing')).toHaveCount(0);
  await expect(page.getByText('Live destination previews')).toHaveCount(0);

  // Setup → Studio, with one persistent campaign header.
  await workflow.getByRole('link', { name: /Studio/ }).click();
  await expect(page).toHaveURL(new RegExp(`${campaignId}/creative`));
  await expect(page.getByTestId('creative-preview-canvas').first()).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Creative destinations' })).toBeVisible();
  await assertNoHorizontalOverflow(page, `${testInfo.project.name} studio`);

  // History remains a Studio tool rather than a workflow stage.
  await expect(workflow.getByRole('link', { name: /History/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open Creative History' })).toBeVisible();

  // Studio → Review: read-only, cross-destination, TV planned only.
  await workflow.getByRole('link', { name: /Review/ }).click();
  await expect(page).toHaveURL(new RegExp(`${campaignId}/review`));
  await expect(page.getByRole('heading', { name: 'Review every destination' })).toBeVisible();
  for (const destination of ['Community Mailer', 'Consumer Discovery', 'QR Landing', 'Social Media']) {
    await expect(page.getByRole('heading', { name: destination, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Adpadz TV' })).toBeVisible();
  await expect(page.getByText('Coming Later', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Creative' })).toHaveCount(0);
  await assertNoHorizontalOverflow(page, `${testInfo.project.name} review`);

  // Review → Publish reuses Campaign Distribution.
  await page.getByRole('link', { name: 'Continue to Publish' }).click();
  await expect(page).toHaveURL(new RegExp(`${campaignId}/distribution`));
  await expect(page.getByTestId('saved-distribution-creative')).toBeVisible();
  await expect(page.getByRole('link', { name: /Open Creative Workshop/ })).toBeVisible();
  await expect(workflow.getByRole('link', { name: /Publish/ })).toHaveAttribute('aria-current', 'step');
  await assertNoHorizontalOverflow(page, `${testInfo.project.name} publish`);

  expect(failures, `${testInfo.project.name} campaign shell failures`).toEqual([]);
});

test('Legacy campaign deep links redirect into the shell without losing context', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Redirect behavior is viewport independent.');
  const failures = monitorPage(page, testInfo);

  await signIn(page, `/app/business/campaigns/${campaignId}/edit?section=media`);
  await expect(page).toHaveURL(new RegExp(`${campaignId}/setup\\?section=media`));
  await expect(page.getByRole('navigation', { name: 'Campaign workflow' })).toBeVisible();

  expect(failures, 'legacy deep link failures').toEqual([]);
});

test('QR Studio keeps campaign context and returns to the originating stage', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'QR round-trip is viewport independent.');
  const failures = monitorPage(page, testInfo);

  await signIn(page, `/app/business/qr-studio?campaign=${campaignId}&return=creative`);
  await expect(page).toHaveURL(/qr-studio/);
  const back = page.getByRole('link', { name: 'Back to Campaign' });
  await expect(back).toBeVisible();
  await back.click();
  await expect(page).toHaveURL(new RegExp(`${campaignId}/creative`));
  await expect(page.getByTestId('creative-preview-canvas').first()).toBeVisible();

  expect(failures, 'QR round-trip failures').toEqual([]);
});

test('Campaigns list and sidebar expose one campaign destination each', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Navigation uniqueness is viewport independent.');
  const failures = monitorPage(page, testInfo);

  await signIn(page, '/app/business/campaigns');
  await expect(page).toHaveURL(/\/app\/business\/campaigns$/);

  const sidebar = page.getByRole('navigation', { name: 'Business workspace' });
  await expect(sidebar.getByRole('link', { name: 'Campaigns', exact: true })).toHaveCount(1);
  await expect(sidebar.getByRole('link', { name: 'Campaign Distribution' })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'Campaign Studio' })).toHaveCount(0);
  await expect(sidebar.getByRole('link', { name: 'QR Studio' })).toHaveCount(1);

  const stageNav = page.getByRole('navigation', { name: /stages$/ }).first();
  await expect(stageNav.getByRole('link', { name: 'Studio', exact: true })).toBeVisible();
  await stageNav.getByRole('link', { name: 'Review', exact: true }).click();
  await expect(page).toHaveURL(/\/review$/);

  expect(failures, 'campaign list navigation failures').toEqual([]);
});
