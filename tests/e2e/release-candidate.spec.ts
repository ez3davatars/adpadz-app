import { createHash } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

const password = 'AdpadzDemo!2026';
const ownerA = 'owner@adpadz-demo.test';
const ownerB = 'second-owner@adpadz-demo.test';
const admin = 'admin@adpadz-demo.test';
const campaignId = '30000000-0000-4000-8000-000000000001';
const mailerAId = '50000000-0000-4000-8000-000000000001';
const mailerBId = '50000000-0000-4000-8000-000000000002';

function monitorReleasePage(page: Page, testInfo: TestInfo) {
  const failures: string[] = [];
  const context = (kind: string, detail: string) => `[${new Date().toISOString()}] project=${testInfo.project.name} navigation=${page.url()} ${kind} ${detail}`;
  page.on('pageerror', error => failures.push(context('pageerror', error.message)));
  page.on('console', message => {
    if (message.type() === 'error') failures.push(context('console', message.text()));
  });
  page.on('requestfailed', request => {
    const errorText = request.failure()?.errorText ?? '';
    if (errorText !== 'net::ERR_ABORTED') {
      failures.push(context('requestfailed', `method=${request.method()} resource=${request.resourceType()} url=${request.url()} error=${errorText}`));
    }
  });
  page.on('response', response => {
    if (response.status() >= 400 && /\/(rest|auth|storage)\/v1\//.test(response.url())) {
      failures.push(context('http', `status=${response.status()} method=${response.request().method()} resource=${response.request().resourceType()} url=${response.url()}`));
    }
  });
  return failures;
}
async function signIn(page: Page, email: string, destination = '/app/business/dashboard') {
  await page.goto(`/auth?next=${encodeURIComponent(destination)}`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(/\/app\/business\/dashboard/);
  await expect(page.getByText('Business Hub', { exact: true }).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  if (destination !== '/app/business/dashboard') await page.goto(destination);
}

async function adminSignIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(admin);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
  await expect(page.getByRole('heading', { name: 'Operations dashboard' })).toBeVisible();
  await page.waitForLoadState('networkidle');
}

async function assertResponsive(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
    offenders: [...document.querySelectorAll<HTMLElement>('*')]
      .filter(element => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 10)
      .map(element => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width })),
  }));
  expect.soft(metrics.scrollWidth, `${label} document overflow: ${JSON.stringify(metrics.offenders)}`).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect.soft(metrics.bodyWidth, `${label} body overflow`).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function authToken(request: APIRequestContext, email: string) {
  const url = process.env.RC_SUPABASE_URL;
  const anonKey = process.env.RC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('RC Supabase environment is unavailable.');
  const response = await request.post(`${url}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  const body = await response.json() as { access_token: string };
  return { url, anonKey, token: body.access_token };
}

function apiHeaders(anonKey: string, token?: string) {
  return { apikey: anonKey, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function recordSecurityResult(testInfo: TestInfo, results: Record<string, number | string>) {
  await testInfo.attach('authorization-status-codes.json', {
    body: Buffer.from(JSON.stringify(results, null, 2)),
    contentType: 'application/json',
  });
}

test('Business Owner release workflow covers dashboard, readiness, distribution, social export, and assignment visibility', async ({ page, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'desktop', 'Owner workflow is viewport independent.');
  await signIn(page, ownerA);
  const failures = monitorReleasePage(page, testInfo);
  await expect(page.getByText('Business Hub', { exact: true }).first()).toBeVisible();

  await page.goto('/app/business/create-ad');
  await expect(page.getByRole('heading', { name: 'Create Campaign' })).toBeVisible();
  await expect(page.getByText('Campaign readiness')).toBeVisible();

  await page.goto(`/app/business/campaigns/${campaignId}/content`);
  await expect(page.getByText('Campaign readiness')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Campaign package.' })).toBeVisible();

  await page.goto(`/app/business/campaigns/${campaignId}/distribution`);
  await expect(page.getByRole('heading', { name: 'Complete Approved Published Campaign' })).toBeVisible();
  await expect(page.getByText('Social Media')).toBeVisible();

  await page.goto(`/app/business/campaigns/${campaignId}/distribution/social`);
  await expect(page.getByRole('heading', { name: 'Complete Approved Published Campaign' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download image' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);

  await page.goto('/app/business/community-campaigns');
  await expect(page.getByRole('heading', { name: 'Community Campaigns' })).toBeVisible();
  await expect(page.getByText('Complete Approved Published Campaign').first()).toBeVisible();
  await expect(page.getByText(/Assigned Campaign:/).first()).toBeVisible();

  expect(failures, `Owner workflow browser failures in ${testInfo.project.name}`).toEqual([]);
});

test('Mailer reservation creates a tenant-owned pending checkout hold', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'State-changing reservation runs once against the seeded database.');
  await signIn(page, ownerA);
  const failures = monitorReleasePage(page, testInfo);
  await page.goto('/community-cards/fixture-south-6x11');
  await expect(page.getByRole('heading', { name: 'Demo City South 6x11' })).toBeVisible();
  await page.getByRole('tab', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'Back available: Available' }).click();
  await page.getByRole('button', { name: 'Continue to checkout' }).click();
  await expect(page.getByRole('status')).toContainText('Your space is held.');
  expect(failures, 'Mailer reservation browser failures').toEqual([]);
});

test('responsive launch surfaces match visual baselines without horizontal overflow', async ({ page }, testInfo) => {
  await signIn(page, ownerA);
  const failures = monitorReleasePage(page, testInfo);
  const ownerSurfaces = [
    ['business-dashboard.png', '/app/business/dashboard', 'Evergreen Outdoor Living Company'],
    ['campaign-studio.png', '/app/business/create-ad', 'Create Campaign'],
    ['creative-workshop.png', `/app/business/campaigns/${campaignId}/creative`, 'Complete Approved Published Campaign'],
    ['campaign-readiness.png', `/app/business/campaigns/${campaignId}/content`, 'Campaign package.'],
    ['campaign-distribution.png', `/app/business/campaigns/${campaignId}/distribution`, 'Complete Approved Published Campaign'],
    ['community-mailer.png', '/app/business/community-campaigns', 'Community Campaigns'],
  ] as const;
  for (const [name, route, heading] of ownerSurfaces) {
    if (new URL(page.url()).pathname !== route) await page.goto(route);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await assertResponsive(page, name);
    await expect(page).toHaveScreenshot(name, { fullPage: true });
  }

  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await adminSignIn(page);
  await page.goto('/admin/community-mailers');
  await expect(page.getByRole('heading', { name: 'Community Mailers' })).toBeVisible();
  await assertResponsive(page, 'mission-control.png');
  await expect(page).toHaveScreenshot('mission-control.png', { fullPage: true });
  await page.goto(`/admin/community-mailers/${mailerAId}`);
  await expect(page.getByRole('heading', { name: 'Production Candidate', exact: true })).toBeVisible();
  await assertResponsive(page, 'production-candidate.png');
  await expect(page).toHaveScreenshot('production-candidate.png', { fullPage: true });

  expect(failures, `Responsive browser failures in ${testInfo.project.name}`).toEqual([]);
});

test('tenant, anonymous, admin, and private Storage authorization are server enforced', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Authorization matrix is viewport independent.');
  const a = await authToken(request, ownerA);
  const b = await authToken(request, ownerB);
  const administrator = await authToken(request, admin);
  const results: Record<string, number | string> = {};

  const ownerAOtherCampaign = await request.get(`${a.url}/rest/v1/campaigns?select=id&id=eq.30000000-0000-4000-8000-000000000006`, { headers: apiHeaders(a.anonKey, a.token) });
  results.ownerA_businessB_campaigns = ownerAOtherCampaign.status();
  expect(ownerAOtherCampaign.status()).toBe(200);
  expect(await ownerAOtherCampaign.json()).toEqual([]);

  const ownerBOtherCampaign = await request.get(`${b.url}/rest/v1/campaigns?select=id&id=eq.30000000-0000-4000-8000-000000000002`, { headers: apiHeaders(b.anonKey, b.token) });
  results.ownerB_businessA_campaigns = ownerBOtherCampaign.status();
  expect(ownerBOtherCampaign.status()).toBe(200);
  expect(await ownerBOtherCampaign.json()).toEqual([]);

  const ownerAdminRpc = await request.post(`${a.url}/rest/v1/rpc/get_admin_community_mailers`, { headers: apiHeaders(a.anonKey, a.token), data: {} });
  results.ownerA_mission_control = ownerAdminRpc.status();
  expect(ownerAdminRpc.status()).toBe(200);
  expect(await ownerAdminRpc.json()).toEqual([]);

  const ownerStorage = await request.post(`${a.url}/storage/v1/object/list/community-mailer-production`, { headers: { ...apiHeaders(a.anonKey, a.token), 'Content-Type': 'application/json' }, data: { prefix: '', limit: 10 } });
  results.ownerA_private_storage = ownerStorage.status();
  expect(ownerStorage.status()).toBe(200);
  expect(await ownerStorage.json()).toEqual([]);

  const anonymousAdmin = await request.post(`${a.url}/rest/v1/rpc/get_admin_community_mailers`, { headers: apiHeaders(a.anonKey), data: {} });
  results.anonymous_mission_control = anonymousAdmin.status();
  expect(anonymousAdmin.status()).toBe(401);

  const anonymousExports = await request.get(`${a.url}/rest/v1/community_mailer_exports?select=id`, { headers: apiHeaders(a.anonKey) });
  results.anonymous_exports = anonymousExports.status();
  expect(anonymousExports.status()).toBeGreaterThanOrEqual(400);

  const adminRpc = await request.post(`${administrator.url}/rest/v1/rpc/get_admin_community_mailers`, { headers: apiHeaders(administrator.anonKey, administrator.token), data: {} });
  results.admin_mission_control = adminRpc.status();
  expect(adminRpc.status()).toBe(200);
  expect((await adminRpc.json() as unknown[]).length).toBeGreaterThanOrEqual(5);

  await recordSecurityResult(testInfo, results);
});

test('stored Production Candidate package has the complete revision-bound contract', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Package contract is viewport independent.');
  test.setTimeout(120_000);
  await adminSignIn(page);
  await page.goto(`/admin/community-mailers/${mailerAId}`);
  const generate = page.getByRole('button', { name: 'Generate Production Candidate' });
  const current = page.getByRole('button', { name: 'Candidate current' });
  await expect(generate.or(current)).toBeVisible();
  if (await current.count() === 0) {
    await generate.click();
    await expect(current).toBeVisible({ timeout: 90_000 });
  }
  const administrator = await authToken(request, admin);
  const prefix = `community-mailers/${mailerAId}/revisions/10/production-candidate/`;
  const list = await request.post(`${administrator.url}/storage/v1/object/list/community-mailer-production`, {
    headers: { ...apiHeaders(administrator.anonKey, administrator.token), 'Content-Type': 'application/json' },
    data: { prefix, limit: 100, sortBy: { column: 'name', order: 'asc' } },
  });
  expect(list.status()).toBe(200);
  const listed = await list.json() as Array<{ name: string }>;
  const expectedNames = [
    'advertiser-manifest.csv', 'back.pdf', 'back.png', 'confirmation-record.json', 'front.pdf',
    'front.png', 'placement-manifest.csv', 'preflight-report.json', 'production-manifest.json', 'qr-manifest.json',
  ];
  expect(listed.map(item => item.name).sort()).toEqual(expectedNames);

  const files = new Map<string, Buffer>();
  for (const name of expectedNames) {
    const response = await request.get(`${administrator.url}/storage/v1/object/authenticated/community-mailer-production/${prefix}${name}`, { headers: apiHeaders(administrator.anonKey, administrator.token) });
    expect(response.status(), name).toBe(200);
    files.set(name, Buffer.from(await response.body()));
  }
  for (const name of ['front.pdf', 'back.pdf']) {
    const pdf = await PDFDocument.load(files.get(name)!);
    expect(pdf.getPageCount(), name).toBe(1);
    const size = pdf.getPage(0).getSize();
    expect(size.width, name).toBeCloseTo(12.25 * 72, 1);
    expect(size.height, name).toBeCloseTo(9.25 * 72, 1);
  }
  for (const name of ['front.png', 'back.png']) {
    const png = files.get(name)!;
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16), `${name} width`).toBe(918);
    expect(png.readUInt32BE(20), `${name} height`).toBe(693);
  }
  const manifest = JSON.parse(files.get('production-manifest.json')!.toString('utf8')) as Record<string, unknown>;
  expect(manifest.layoutRevision).toBe(10);
  expect(manifest.classification).toBe('Production Candidate');
  const qrManifest = JSON.parse(files.get('qr-manifest.json')!.toString('utf8')) as unknown[];
  expect(qrManifest.length).toBeGreaterThan(0);
  expect(files.get('placement-manifest.csv')!.toString('utf8')).toContain('snapshot_fingerprint');
  expect(files.get('advertiser-manifest.csv')!.toString('utf8')).toContain('business_name');
  const checksums = Object.fromEntries([...files].map(([name, bytes]) => [name, createHash('sha256').update(bytes).digest('hex')]));
  await testInfo.attach('production-candidate-checksums.json', { body: Buffer.from(JSON.stringify(checksums, null, 2)), contentType: 'application/json' });
});

test('Mission Control exposes supported fixture lifecycle states and blocks invalid production', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Mission Control fixture validation is viewport independent.');
  await adminSignIn(page);
  const failures = monitorReleasePage(page, testInfo);
  await page.goto('/admin/community-mailers');
  for (const title of ['Demo City North 9x12', 'Demo City South 6x11', 'Mailer C - Printer Certified', 'Mailer D - Printed', 'Mailer E - Published']) {
    await expect(page.getByText(title)).toBeVisible();
  }
  await page.goto(`/admin/community-mailers/${mailerBId}`);
  await expect(page.getByText('Current preflight is blocked.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate Production Candidate' })).toBeDisabled();
  await expect(page.getByText('Historical candidate exists for an older revision.')).toBeVisible();
  expect(failures, `Mission Control browser failures in ${testInfo.project.name}`).toEqual([]);
});
test('Creative Workshop preserves destination overrides and saved distribution state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'State-changing creative save runs once against fixture data.');
  await signIn(page, ownerA, `/app/business/campaigns/${campaignId}/creative`);
  const failures = monitorReleasePage(page, testInfo);
  await expect(page.getByRole('heading', { name: 'Complete Approved Published Campaign' })).toBeVisible();
  await page.getByRole('button', { name: /Social Media/ }).click();
  await page.getByRole('button', { name: 'Social Media', exact: true }).click();
  await page.getByRole('button', { name: /Offer First/ }).click();
  await page.getByRole('button', { name: 'Overlay' }).click();
  await page.getByLabel('Opacity').press('ArrowRight');
  await page.getByRole('button', { name: 'QR', exact: true }).click();
  const qrOptions = page.getByRole('option');
  if (await qrOptions.count()) await qrOptions.first().click();
  await page.getByRole('button', { name: 'Print Safety' }).click();
  await page.getByLabel('Safe area overlay').check();
  await page.getByRole('button', { name: 'Save Creative' }).click();
  await expect(page.getByText('Creative saved.')).toBeVisible();
  await page.getByRole('button', { name: /Community Mailer/ }).click();
  await page.getByRole('button', { name: 'Template' }).click();
  await expect(page.getByRole('button', { name: /Hero Visual/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: 'Continue to Distribution' }).click();
  await expect(page.getByRole('heading', { name: 'Complete Approved Published Campaign' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Creative Workshop' })).toBeVisible();
  expect(failures, 'Creative Workshop browser failures').toEqual([]);
});
