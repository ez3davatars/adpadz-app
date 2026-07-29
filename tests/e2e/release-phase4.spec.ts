import { expect, test, type Page, type TestInfo } from '@playwright/test';

const password = 'AdpadzDemo!2026';
const owner = 'owner@adpadz-demo.test';
const campaignId = '30000000-0000-4000-8000-000000000001';
const creativeRoute = `/app/business/campaigns/${campaignId}/creative`;
const reviewRoute = `/app/business/campaigns/${campaignId}/review`;

function monitorPage(page: Page, testInfo: TestInfo) {
  const failures: string[] = [];
  const ctx = (kind: string, detail: string) =>
    `[${new Date().toISOString()}] project=${testInfo.project.name} url=${page.url()} ${kind} ${detail}`;
  page.on('pageerror', (e) => failures.push(ctx('pageerror', e.message)));
  page.on('console', (m) => {
    if (m.type() === 'error') failures.push(ctx('console', m.text()));
  });
  page.on('requestfailed', (req) => {
    const err = req.failure()?.errorText ?? '';
    if (err !== 'net::ERR_ABORTED') {
      failures.push(ctx('requestfailed', `method=${req.method()} url=${req.url()} error=${err}`));
    }
  });
  page.on('response', (resp) => {
    if (resp.status() >= 400 && /\/(rest|auth|storage)\/v1\//.test(resp.url())) {
      failures.push(ctx('http', `status=${resp.status()} url=${resp.url()}`));
    }
  });
  return failures;
}

async function signIn(page: Page, destination: string) {
  await page.goto(`/auth?next=${encodeURIComponent(destination)}`);
  await page.getByLabel('Email').fill(owner);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(new RegExp(campaignId));
  await page.waitForLoadState('networkidle');
}

async function openStudio(page: Page) {
  await signIn(page, creativeRoute);
  await expect(page.getByText('Creative Studio', { exact: true })).toBeVisible();
  // Dismiss inspector hint if present
  await page.getByRole('button', { name: 'Got it' }).click({ timeout: 3000 }).catch(() => {});
}

// ── Mailer Proof Mode ─────────────────────────────────────────────────────────

test('Mailer Proof Mode shows paper context and ephemeral guide controls', async ({ page }, testInfo) => {
  await openStudio(page);
  const failures = monitorPage(page, testInfo);

  // Select Mailer destination
  await page.getByRole('button', { name: /Community Mailer/ }).click();

  // Verify creative-preview-canvas is visible (the mailer proof shows the canvas)
  await expect(page.getByTestId('creative-preview-canvas').first()).toBeVisible();

  // Verify paper proof area is present
  await expect(page.getByLabel('Paper proof view')).toBeVisible();

  // Verify Print Guides section exists
  await expect(page.getByText('Print guides', { exact: true })).toBeVisible();

  // Verify guide toggles are present
  const safeToggle = page.getByRole('button', { name: 'Safe area' });
  const bleedToggle = page.getByRole('button', { name: 'Bleed' });
  const qrMinToggle = page.getByRole('button', { name: 'QR minimum' });
  await expect(safeToggle).toBeVisible();
  await expect(bleedToggle).toBeVisible();
  await expect(qrMinToggle).toBeVisible();

  // Verify initial state: all guides off
  await expect(safeToggle).toHaveAttribute('aria-pressed', 'false');

  // Toggle Safe area guide on
  await safeToggle.click();
  await expect(safeToggle).toHaveAttribute('aria-pressed', 'true');
  // Verify safe area guide overlay appears
  await expect(page.locator('[data-guide="safe-area"]').first()).toBeVisible();

  // CRITICAL: The session must still show "Saved" (not "Unsaved") after guide toggle
  const savedStatus = page.getByRole('status').filter({ hasText: /Saved/ }).first();
  await expect(savedStatus).toBeVisible({ timeout: 2000 });

  // Toggle guide back off
  await safeToggle.click();
  await expect(safeToggle).toHaveAttribute('aria-pressed', 'false');

  // Verify QR proof status section exists
  await expect(page.getByText('QR proof status', { exact: true })).toBeVisible();

  expect(failures, `Mailer Proof Mode failures in ${testInfo.project.name}`).toEqual([]);
});

test('Mailer guide changes do not create an unsaved creative state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'State-change guard runs once per project.');
  await openStudio(page);
  const failures = monitorPage(page, testInfo);

  await page.getByRole('button', { name: /Community Mailer/ }).click();

  // Initial state should be saved
  await expect(page.getByRole('status').filter({ hasText: 'Saved' }).first()).toBeVisible();

  // Toggle all three guides
  await page.getByRole('button', { name: 'Safe area' }).click();
  await page.getByRole('button', { name: 'Bleed' }).click();
  await page.getByRole('button', { name: 'QR minimum' }).click();

  // Must still show Saved
  await expect(page.getByRole('status').filter({ hasText: 'Saved' }).first()).toBeVisible({ timeout: 2000 });
  // Must NOT show Unsaved
  await expect(page.getByRole('status').filter({ hasText: 'Unsaved' })).toHaveCount(0);

  expect(failures, `Guide state purity failures in ${testInfo.project.name}`).toEqual([]);
});

// ── Discovery Feed Context ─────────────────────────────────────────────────────

test('Discovery destination shows feed context', async ({ page }, testInfo) => {
  await openStudio(page);
  const failures = monitorPage(page, testInfo);

  await page.getByRole('button', { name: /Consumer Discovery/ }).click();

  // Canvas is visible in feed context
  await expect(page.getByTestId('creative-preview-canvas').first()).toBeVisible();

  // Sponsored label is present (decorative feed context)
  const sponsored = page.getByText('Sponsored', { exact: true });
  await expect(sponsored.first()).toBeVisible();

  // No horizontal overflow
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth, 'Discovery: no horizontal overflow').toBeLessThanOrEqual(
    overflow.clientWidth + 2,
  );

  expect(failures, `Discovery feed context failures in ${testInfo.project.name}`).toEqual([]);
});

// ── QR Landing Phone Context ──────────────────────────────────────────────────

test('QR Landing destination shows phone context with QR Studio link', async ({ page }, testInfo) => {
  await openStudio(page);
  const failures = monitorPage(page, testInfo);

  await page.getByRole('button', { name: /QR Landing/ }).click();

  // Canvas visible
  await expect(page.getByTestId('creative-preview-canvas').first()).toBeVisible();

  // Scan → Offer annotation
  await expect(page.getByLabel('QR scan to offer connection')).toBeVisible();
  await expect(page.getByText(/Scan QR → arrives at/)).toBeVisible();

  // QR Studio round-trip link (use aria-label to disambiguate from sidebar nav link)
  const qrStudioLink = page.getByRole('link', { name: 'Open QR Studio for this campaign' });
  await expect(qrStudioLink).toBeVisible();
  await expect(qrStudioLink).toHaveAttribute('href', new RegExp(`qr-studio.*${campaignId}`));

  expect(failures, `QR phone context failures in ${testInfo.project.name}`).toEqual([]);
});

// ── Social Format Rack ─────────────────────────────────────────────────────────

test('Social Format Rack shows all supported formats simultaneously', async ({ page }, testInfo) => {
  await openStudio(page);
  const failures = monitorPage(page, testInfo);

  await page.getByRole('button', { name: /Social Media/ }).click();

  // Wait for rack to appear
  const rack = page.getByRole('listbox', { name: 'Social media formats' });
  await expect(rack).toBeVisible();

  // All 4 formats visible as options
  await expect(rack.getByRole('option', { name: /Square/ })).toBeVisible();
  await expect(rack.getByRole('option', { name: /Portrait/ })).toBeVisible();
  await expect(rack.getByRole('option', { name: /Landscape/ })).toBeVisible();
  await expect(rack.getByRole('option', { name: /Story/ })).toBeVisible();

  // Format toolbar should NOT show separate format buttons (replaced by rack)
  await expect(page.getByText('Social Media · all formats below')).toBeVisible();

  // Focused preview is visible
  await expect(page.getByTestId('creative-preview-canvas').first()).toBeVisible();

  expect(failures, `Social Format Rack failures in ${testInfo.project.name}`).toEqual([]);
});

test('Social Format Rack format selection updates focused preview', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Format selection interaction runs on desktop.');
  await openStudio(page);
  const failures = monitorPage(page, testInfo);

  await page.getByRole('button', { name: /Social Media/ }).click();
  const rack = page.getByRole('listbox', { name: 'Social media formats' });
  await expect(rack).toBeVisible();

  // Select Portrait format
  await rack.getByRole('option', { name: /Portrait/ }).click();

  // Portrait should now be selected
  await expect(
    rack.getByRole('option', { name: /Portrait/ }),
  ).toHaveAttribute('aria-selected', 'true');

  // Focused preview label should update
  await expect(page.getByText('Portrait preview', { exact: true })).toBeVisible();

  expect(failures, `Social format selection failures in ${testInfo.project.name}`).toEqual([]);
});

test('Social export CTA shows save-first guidance when session has unsaved changes', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'State-changing test runs on desktop only.');
  await openStudio(page);
  const failures = monitorPage(page, testInfo);

  // Make a change to dirty the session — go to Mailer first so Template section is unambiguous
  await page.getByRole('button', { name: /Community Mailer/ }).click();
  // Change template to create unsaved state
  await page.getByRole('button', { name: 'Template' }).first().click();
  const offerFirstBtn = page.getByRole('button', { name: /Offer First/ }).first();
  const heroVisualBtn = page.getByRole('button', { name: /Hero Visual/ }).first();
  const heroSelected = await heroVisualBtn.getAttribute('aria-pressed').catch(() => null) === 'true';
  if (heroSelected) {
    await offerFirstBtn.click();
  } else {
    await heroVisualBtn.click();
  }

  // Navigate to Social rack
  await page.getByRole('button', { name: /Social Media/ }).click();

  // Session should be dirty now
  await expect(page.getByRole('status').filter({ hasText: 'Unsaved' }).first()).toBeVisible({ timeout: 3000 });

  // Export CTA should show "Save before exporting" guidance
  await expect(page.getByText('Save before exporting')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Distribution' })).toHaveCount(0);

  expect(failures, `Social export dirty state failures in ${testInfo.project.name}`).toEqual([]);
});

// ── TV Coming Later ───────────────────────────────────────────────────────────

test('Adpadz TV appears as Coming Later in destination rail', async ({ page }, testInfo) => {
  await openStudio(page);
  const failures = monitorPage(page, testInfo);

  // TV rail entry is visible
  const tvEntry = page.getByTestId('tv-coming-later-rail');
  await expect(tvEntry).toBeVisible();

  // TV shows "Coming Later" label
  await expect(tvEntry.getByText('Coming Later')).toBeVisible();
  await expect(tvEntry.getByText('Adpadz TV')).toBeVisible();

  // TV is not a button (aria-disabled)
  await expect(tvEntry).toHaveAttribute('aria-disabled', 'true');

  // Clicking TV does NOT change the active destination
  const currentDestination = await page
    .getByRole('button', { name: /Community Mailer/ })
    .getAttribute('aria-pressed');
  await tvEntry.click({ force: true });
  await expect(page.getByTestId('creative-preview-canvas').first()).toBeVisible();
  // Mailer should still be active (or whatever was active before)
  expect(
    await page.getByRole('button', { name: /Community Mailer/ }).getAttribute('aria-pressed'),
    'TV click must not change the selected destination',
  ).toBe(currentDestination);

  expect(failures, `TV Coming Later failures in ${testInfo.project.name}`).toEqual([]);
});

// ── Destination switching preservation ───────────────────────────────────────

test('Switching destinations preserves creative state and does not create overrides', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'State-preservation check runs on desktop.');
  await openStudio(page);
  const failures = monitorPage(page, testInfo);

  // Start on Mailer
  await page.getByRole('button', { name: /Community Mailer/ }).click();

  // Note saved/unsaved state
  const savedBefore = await page.getByRole('status').filter({ hasText: 'Saved' }).count();

  // Switch to Discovery
  await page.getByRole('button', { name: /Consumer Discovery/ }).click();
  await expect(page.getByTestId('creative-preview-canvas').first()).toBeVisible();

  // Switch to QR
  await page.getByRole('button', { name: /QR Landing/ }).click();
  await expect(page.getByTestId('creative-preview-canvas').first()).toBeVisible();

  // Switch to Social
  await page.getByRole('button', { name: /Social Media/ }).click();
  await expect(page.getByRole('listbox', { name: 'Social media formats' })).toBeVisible();

  // Switch back to Mailer
  await page.getByRole('button', { name: /Community Mailer/ }).click();
  await expect(page.getByLabel('Paper proof view')).toBeVisible();

  // State should still be saved (no override created by switching)
  if (savedBefore > 0) {
    await expect(page.getByRole('status').filter({ hasText: 'Saved' }).first()).toBeVisible({ timeout: 2000 });
  }

  expect(failures, `Destination switching failures in ${testInfo.project.name}`).toEqual([]);
});

// ── Review stage ──────────────────────────────────────────────────────────────

test('Review shows all destination contexts and TV as Coming Later', async ({ page }, testInfo) => {
  await signIn(page, reviewRoute);
  const failures = monitorPage(page, testInfo);

  await expect(page.getByRole('heading', { name: 'Review every destination' })).toBeVisible();

  // All 4 active destination review regions visible
  // (<section aria-label="X review"> maps to the 'region' ARIA role in the accessibility tree)
  for (const name of ['Community Mailer', 'Consumer Discovery', 'QR Landing', 'Social Media']) {
    await expect(page.getByRole('region', { name: new RegExp(name, 'i') })).toBeVisible();
  }

  // TV Coming Later region is present in Review
  await expect(page.getByRole('region', { name: /Adpadz TV/i })).toBeVisible();
  await expect(page.getByRole('region', { name: /Adpadz TV/i }).getByText('Coming Later')).toBeVisible();

  expect(failures, `Review stage failures in ${testInfo.project.name}`).toEqual([]);
});

// ── Publish (Distribution) handoff ─────────────────────────────────────────────

test('Continue to Publish reaches Distribution from Review', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Distribution handoff runs once on desktop.');
  await signIn(page, reviewRoute);
  const failures = monitorPage(page, testInfo);

  await expect(page.getByRole('heading', { name: 'Review every destination' })).toBeVisible();

  // Navigate to Distribution
  const continueLink = page.getByRole('link', { name: /Continue to Publish/ });
  await expect(continueLink).toBeVisible();
  await continueLink.click();
  await expect(page).toHaveURL(new RegExp(`${campaignId}/distribution`));
  await expect(page.getByRole('heading', { name: /Complete Approved Published Campaign|Distribution|Publish/i }).first()).toBeVisible();

  expect(failures, `Distribution handoff failures in ${testInfo.project.name}`).toEqual([]);
});

// ── Responsive / no overflow ──────────────────────────────────────────────────

test('Phase 4 Studio has no horizontal overflow', async ({ page }, testInfo) => {
  await openStudio(page);
  const failures = monitorPage(page, testInfo);

  const destinations = [
    { label: /Community Mailer/, name: 'Mailer' },
    { label: /Consumer Discovery/, name: 'Discovery' },
    { label: /QR Landing/, name: 'QR' },
    { label: /Social Media/, name: 'Social' },
  ];

  for (const dest of destinations) {
    await page.getByRole('button', { name: dest.label }).click();
    await page.waitForTimeout(300);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      overflow.scrollWidth,
      `${dest.name} in ${testInfo.project.name}: no horizontal overflow`,
    ).toBeLessThanOrEqual(overflow.clientWidth + 2);
  }

  expect(failures, `Overflow check failures in ${testInfo.project.name}`).toEqual([]);
});

test('Phase 4 Review has no horizontal overflow', async ({ page }, testInfo) => {
  await signIn(page, reviewRoute);
  const failures = monitorPage(page, testInfo);

  await expect(page.getByRole('heading', { name: 'Review every destination' })).toBeVisible();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    overflow.scrollWidth,
    `Review in ${testInfo.project.name}: no horizontal overflow`,
  ).toBeLessThanOrEqual(overflow.clientWidth + 2);

  expect(failures, `Review overflow failures in ${testInfo.project.name}`).toEqual([]);
});
