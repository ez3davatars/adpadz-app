import { expect, test, type APIRequestContext, type Locator, type Page, type TestInfo } from '@playwright/test';

const password = 'AdpadzDemo!2026';
const owner = 'owner@adpadz-demo.test';
const secondOwner = 'second-owner@adpadz-demo.test';
const admin = 'admin@adpadz-demo.test';
const campaignId = '30000000-0000-4000-8000-000000000001';
const mailerId = '50000000-0000-4000-8000-000000000001';
const terminalMailerId = '50000000-0000-4000-8000-000000000002';
const terminalMailerSlotId = '52000000-0000-4000-8000-000000000001';
const creativeRoute = `/app/business/campaigns/${campaignId}/creative`;

type OwnerApi = {
  url: string;
  anonKey: string;
  token: string;
};

type MailerBoundaryState = {
  campaignUpdatedAt: string;
  mailerOutputUpdatedAt: string;
  mailerOutputMetadata: unknown;
};

type CandidateBinding = {
  id: string;
  layoutRevision: number;
  productionVersion: number;
  fingerprint: string;
  exportKind: string;
};

type MailerProductionLifecycleState = {
  layoutRevision: number;
  productionVersion: number;
  status: string;
  layoutLocked: boolean;
  salesOpen: boolean;
  isPublished: boolean;
  updatedAt: string;
  postalAreaConfirmed: boolean;
  postalAreaConfirmationRevision: number | null;
  printerSpecsConfirmed: boolean;
  printerSpecsConfirmationRevision: number | null;
  colorProfileConfirmed: boolean;
  colorProfileConfirmationRevision: number | null;
  preflightFingerprint: string | null;
  preflightLayoutRevision: number | null;
  preflightCompletedAt: string | null;
  printedAt: string | null;
  mailedAt: string | null;
  digitalPublishedAt: string | null;
  currentPreflightRunId: string | null;
  currentCandidate: CandidateBinding | null;
  candidateBindings: CandidateBinding[];
  snapshotCreativeVersionIds: string[];
};

type HistorySecurityRow = {
  id: string;
  destination: string;
  scope: string;
  format_key: string;
  settings_snapshot: Record<string, unknown>;
};

function monitorWorkshopPage(page: Page, testInfo: TestInfo) {
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

async function signIn(page: Page) {
  await page.goto(`/auth?next=${encodeURIComponent(creativeRoute)}`);
  await page.getByLabel('Email').fill(owner);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await expect(page).toHaveURL(new RegExp(`${campaignId}/creative`));
  await expect(page.getByText('Campaign Creative Workshop', { exact: true })).toBeVisible();
  await expect(page.getByTestId('creative-preview-canvas').first()).toBeVisible();
}

async function authenticatedApi(request: APIRequestContext, email: string): Promise<OwnerApi> {
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

function apiHeaders(api: OwnerApi) {
  return { apikey: api.anonKey, Authorization: `Bearer ${api.token}` };
}

async function readMailerBoundaryState(request: APIRequestContext, api: OwnerApi): Promise<MailerBoundaryState> {
  const [campaignResponse, outputResponse] = await Promise.all([
    request.get(`${api.url}/rest/v1/campaigns?select=updated_at&id=eq.${campaignId}`, {
      headers: apiHeaders(api),
    }),
    request.get(`${api.url}/rest/v1/campaign_outputs?select=updated_at,metadata&campaign_id=eq.${campaignId}&output_type=eq.community_mailer`, {
      headers: apiHeaders(api),
    }),
  ]);
  expect(campaignResponse.status()).toBe(200);
  expect(outputResponse.status()).toBe(200);

  const campaigns = await campaignResponse.json() as Array<{ updated_at: string }>;
  const outputs = await outputResponse.json() as Array<{ updated_at: string; metadata: unknown }>;
  expect(campaigns).toHaveLength(1);
  expect(outputs).toHaveLength(1);
  return {
    campaignUpdatedAt: campaigns[0].updated_at,
    mailerOutputUpdatedAt: outputs[0].updated_at,
    mailerOutputMetadata: outputs[0].metadata,
  };
}

async function readMailerProductionLifecycleState(
  request: APIRequestContext,
  adminApi: OwnerApi,
  targetMailerId = mailerId,
): Promise<MailerProductionLifecycleState> {
  const [detailResponse, productionResponse] = await Promise.all([
    request.post(`${adminApi.url}/rest/v1/rpc/get_admin_community_mailer`, {
      headers: apiHeaders(adminApi),
      data: { p_mailer_id: targetMailerId },
    }),
    request.post(`${adminApi.url}/rest/v1/rpc/get_admin_community_mailer_production`, {
      headers: apiHeaders(adminApi),
      data: { p_mailer_id: targetMailerId },
    }),
  ]);
  expect(detailResponse.status()).toBe(200);
  expect(productionResponse.status()).toBe(200);

  const detail = await detailResponse.json() as {
    mailer: {
      layout_revision: number;
      production_version: number;
      status: string;
      layout_locked: boolean;
      sales_open: boolean;
      is_published: boolean;
      updated_at: string;
      postal_area_confirmed: boolean;
      postal_area_confirmation_revision: number | null;
      printer_specs_confirmed: boolean;
      printer_specs_confirmation_revision: number | null;
      color_profile_confirmed: boolean;
      color_profile_confirmation_revision: number | null;
      preflight_fingerprint: string | null;
      preflight_layout_revision: number | null;
      preflight_completed_at: string | null;
      printed_at: string | null;
      mailed_at: string | null;
      digital_published_at: string | null;
    };
  };
  const production = await productionResponse.json() as {
    current_preflight_run_id: string | null;
    exports: Array<{
      id: string;
      layout_revision: number;
      production_version: number;
      fingerprint: string;
      export_kind: string;
    }>;
    snapshots: Array<{ creative_version_id?: string | null }>;
  };
  const mailer = detail.mailer;
  const candidateBindings = production.exports
    .filter(({ export_kind }) => export_kind === 'production_candidate' || export_kind === 'printer_certified')
    .map(({ id, layout_revision, production_version, fingerprint, export_kind }) => ({
      id,
      layoutRevision: Number(layout_revision),
      productionVersion: Number(production_version),
      fingerprint,
      exportKind: export_kind,
    }));
  const currentCandidate = mailer.preflight_fingerprint
    ? candidateBindings.find(candidate =>
        candidate.layoutRevision === Number(mailer.layout_revision)
        && candidate.productionVersion === Number(mailer.production_version)
        && candidate.fingerprint === mailer.preflight_fingerprint,
      ) ?? null
    : null;

  return {
    layoutRevision: Number(mailer.layout_revision),
    productionVersion: Number(mailer.production_version),
    status: mailer.status,
    layoutLocked: mailer.layout_locked,
    salesOpen: mailer.sales_open,
    isPublished: mailer.is_published,
    updatedAt: mailer.updated_at,
    postalAreaConfirmed: mailer.postal_area_confirmed,
    postalAreaConfirmationRevision: mailer.postal_area_confirmation_revision === null
      ? null
      : Number(mailer.postal_area_confirmation_revision),
    printerSpecsConfirmed: mailer.printer_specs_confirmed,
    printerSpecsConfirmationRevision: mailer.printer_specs_confirmation_revision === null
      ? null
      : Number(mailer.printer_specs_confirmation_revision),
    colorProfileConfirmed: mailer.color_profile_confirmed,
    colorProfileConfirmationRevision: mailer.color_profile_confirmation_revision === null
      ? null
      : Number(mailer.color_profile_confirmation_revision),
    preflightFingerprint: mailer.preflight_fingerprint,
    preflightLayoutRevision: mailer.preflight_layout_revision === null
      ? null
      : Number(mailer.preflight_layout_revision),
    preflightCompletedAt: mailer.preflight_completed_at,
    printedAt: mailer.printed_at,
    mailedAt: mailer.mailed_at,
    digitalPublishedAt: mailer.digital_published_at,
    currentPreflightRunId: production.current_preflight_run_id,
    currentCandidate,
    candidateBindings,
    snapshotCreativeVersionIds: production.snapshots
      .map(snapshot => snapshot.creative_version_id)
      .filter((id): id is string => typeof id === 'string'),
  };
}

async function expectAdminRpc(
  request: APIRequestContext,
  api: OwnerApi,
  functionName: string,
  data: Record<string, unknown>,
) {
  const response = await request.post(`${api.url}/rest/v1/rpc/${functionName}`, {
    headers: apiHeaders(api),
    data,
  });
  expect(response.status(), functionName).toBeGreaterThanOrEqual(200);
  expect(response.status(), functionName).toBeLessThan(300);
}

async function prepareArchivedCampaignMailerFixture(
  request: APIRequestContext,
  adminApi: OwnerApi,
) {
  await expectAdminRpc(request, adminApi, 'update_admin_community_mailer', {
    p_mailer_id: terminalMailerId,
    p_changes: { layout_locked: false },
  });
  await expectAdminRpc(request, adminApi, 'update_admin_community_placement', {
    p_placement_id: terminalMailerSlotId,
    p_changes: { is_locked: false },
  });
  await expectAdminRpc(request, adminApi, 'assign_admin_community_mailer_campaign', {
    p_placement_id: terminalMailerSlotId,
    p_campaign_id: campaignId,
    p_override_reason: null,
  });
  await expectAdminRpc(request, adminApi, 'update_admin_community_mailer', {
    p_mailer_id: terminalMailerId,
    p_changes: { layout_locked: true },
  });
  await expectAdminRpc(request, adminApi, 'transition_admin_community_mailer_production', {
    p_mailer_id: terminalMailerId,
    p_to_status: 'archived',
    p_details: { fixture: 'creative-terminal-invalidation' },
  });
}

async function readLatestCreativeVersion(request: APIRequestContext, api: OwnerApi) {
  const response = await request.get(
    `${api.url}/rest/v1/campaign_creative_versions?select=destination,scope,affects_print,created_override&campaign_id=eq.${campaignId}&order=created_at.desc&limit=1`,
    { headers: apiHeaders(api) },
  );
  expect(response.status()).toBe(200);
  const versions = await response.json() as Array<{
    destination: string;
    scope: string;
    affects_print: boolean;
    created_override: boolean;
  }>;
  expect(versions).toHaveLength(1);
  return versions[0];
}

async function readOwnerHistoryRows(request: APIRequestContext, api: OwnerApi): Promise<HistorySecurityRow[]> {
  const response = await request.get(
    `${api.url}/rest/v1/campaign_creative_versions?select=id,destination,scope,format_key,settings_snapshot&campaign_id=eq.${campaignId}&order=created_at.desc&limit=1`,
    { headers: apiHeaders(api) },
  );
  expect(response.status()).toBe(200);
  return await response.json() as HistorySecurityRow[];
}

async function readMailerHistoryCount(request: APIRequestContext, api: OwnerApi) {
  const response = await request.get(
    `${api.url}/rest/v1/campaign_creative_versions?select=id&campaign_id=eq.${campaignId}&destination=eq.mailer`,
    { headers: apiHeaders(api) },
  );
  expect(response.status()).toBe(200);
  return (await response.json() as Array<{ id: string }>).length;
}

async function readCreativeVersionIds(
  request: APIRequestContext,
  api: OwnerApi,
  destination?: string,
) {
  const destinationFilter = destination ? `&destination=eq.${destination}` : '';
  const response = await request.get(
    `${api.url}/rest/v1/campaign_creative_versions?select=id&campaign_id=eq.${campaignId}${destinationFilter}&order=created_at.desc`,
    { headers: apiHeaders(api) },
  );
  expect(response.status()).toBe(200);
  return await response.json() as Array<{ id: string }>;
}

async function readCurrentWorkshopSnapshot(
  request: APIRequestContext,
  api: OwnerApi,
): Promise<Record<string, unknown>> {
  const response = await request.get(
    `${api.url}/rest/v1/campaign_outputs?select=metadata&campaign_id=eq.${campaignId}&output_type=eq.interactive_ad`,
    { headers: apiHeaders(api) },
  );
  expect(response.status()).toBe(200);
  const outputs = await response.json() as Array<{ metadata: Record<string, unknown> }>;
  expect(outputs).toHaveLength(1);
  const metadata = outputs[0].metadata ?? {};
  const storedWorkshop = metadata.creative_workshop;
  if (storedWorkshop && typeof storedWorkshop === 'object' && !Array.isArray(storedWorkshop)) {
    return structuredClone(storedWorkshop as Record<string, unknown>);
  }
  const storedTemplate = metadata.template_settings;
  const global = storedTemplate && typeof storedTemplate === 'object' && !Array.isArray(storedTemplate)
    ? { ...(storedTemplate as Record<string, unknown>), version: 1 }
    : { version: 1, template: 'hero-visual' };
  return {
    version: 1,
    global,
    overrides: {},
    formats: { mailer: 'standard', discovery: 'card', qr: 'hero', social: 'square' },
  };
}

async function ensureOwnerHistoryRow(request: APIRequestContext, api: OwnerApi): Promise<HistorySecurityRow> {
  let rows = await readOwnerHistoryRows(request, api);
  if (rows.length > 0) return rows[0];

  const outputResponse = await request.get(
    `${api.url}/rest/v1/campaign_outputs?select=metadata&campaign_id=eq.${campaignId}&output_type=eq.interactive_ad`,
    { headers: apiHeaders(api) },
  );
  expect(outputResponse.status()).toBe(200);
  const outputs = await outputResponse.json() as Array<{ metadata: Record<string, unknown> }>;
  expect(outputs).toHaveLength(1);
  const metadata = outputs[0].metadata ?? {};
  const storedWorkshop = metadata.creative_workshop;
  const storedTemplate = metadata.template_settings;
  const templateSettings = storedTemplate && typeof storedTemplate === 'object' && !Array.isArray(storedTemplate)
    ? storedTemplate as Record<string, unknown>
    : { template: 'hero-visual' };
  const snapshot = storedWorkshop && typeof storedWorkshop === 'object' && !Array.isArray(storedWorkshop)
    ? storedWorkshop
    : {
        version: 1,
        global: { ...templateSettings, template: typeof templateSettings.template === 'string' ? templateSettings.template : 'hero-visual' },
        overrides: {},
        formats: { mailer: 'standard', discovery: 'card', qr: 'hero', social: 'square' },
      };
  const saveResponse = await request.post(`${api.url}/rest/v1/rpc/save_campaign_creative_version`, {
    headers: apiHeaders(api),
    data: {
      p_campaign_id: campaignId,
      p_destination: 'mailer',
      p_format_key: 'standard',
      p_settings_snapshot: snapshot,
      p_change_summary: ['Authorization fixture'],
      p_affects_print: false,
      p_created_override: false,
      p_scope: 'global',
    },
  });
  expect(saveResponse.status()).toBe(200);
  rows = await readOwnerHistoryRows(request, api);
  expect(rows).toHaveLength(1);
  return rows[0];
}

async function saveCreative(page: Page) {
  const save = page.getByRole('button', { name: 'Save Creative', exact: true }).first();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0);
  await expect(page.locator('[role="status"]:visible').filter({ hasText: /^Creative saved/ }).first()).toBeVisible();
}

async function nudgeRange(input: Locator) {
  const original = await input.inputValue();
  const current = Number(original);
  const maximum = Number(await input.getAttribute('max'));
  await input.press(current < maximum ? 'ArrowRight' : 'ArrowLeft');
  await expect.poll(() => input.inputValue()).not.toBe(original);
}

function uniqueColor(seed: number, offset: number) {
  return `#${((seed + offset) % 0xffffff).toString(16).padStart(6, '0')}`;
}

async function openHistory(page: Page) {
  await page.getByRole('button', { name: 'Open Creative History' }).click();
  const history = page.getByRole('dialog', { name: 'Creative History' });
  await expect(history).toBeVisible();
  await expect(history.getByRole('list', { name: 'Creative versions' })).toBeVisible();
  return history;
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
    offenders: [...document.querySelectorAll<HTMLElement>('*')]
      .filter(element => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
      .slice(0, 10)
      .map(element => ({
        tag: element.tagName,
        className: element.className,
        right: element.getBoundingClientRect().right,
        width: element.getBoundingClientRect().width,
      })),
  }));
  expect.soft(metrics.scrollWidth, `${label} document overflow: ${JSON.stringify(metrics.offenders)}`).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect.soft(metrics.bodyWidth, `${label} body overflow`).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test('Advanced Creative Workshop selects direct elements, versions edits, restores safely, and isolates Social from Mailer print state', async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'State-changing history coverage runs once against the seeded owner Campaign.');
  test.setTimeout(120_000);

  await signIn(page);
  const failures = monitorWorkshopPage(page, testInfo);
  const [api, adminApi] = await Promise.all([
    authenticatedApi(request, owner),
    authenticatedApi(request, admin),
  ]);
  const runColorSeed = 0x13579b;

  const inspectorHint = page.getByRole('button', { name: 'Got it' });
  if (await inspectorHint.isVisible()) await inspectorHint.click();

  await page.getByRole('button', { name: 'Edit image' }).click();
  await expect(page.locator('#inspector-image')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Creative inspector').getByText(/Selected:\s*Image/).filter({ visible: true }).first()).toBeVisible();
  await expect(page.locator('[data-creative-element="image"][data-selected="true"]')).toBeVisible();
  const previewStage = page.getByTestId('creative-preview-stage');
  await previewStage.scrollIntoViewIfNeeded();
  await previewStage.click({ position: { x: 4, y: 260 } });
  await expect(page.locator('[data-selected="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit image' }).click();

  const assetPicker = page.getByRole('listbox', { name: 'Replace creative image from Asset Library' });
  const assetOptions = assetPicker.getByRole('option');
  expect(await assetOptions.count()).toBeGreaterThan(1);
  await assetOptions.nth(1).click();
  await expect(assetOptions.nth(1)).toHaveAttribute('aria-selected', 'true');
  await nudgeRange(page.getByLabel('Horizontal position'));
  await page.locator('#inspector-overlay').click();
  await page.getByLabel('Overlay color').fill(uniqueColor(runColorSeed, 0));
  await page.getByTestId('creative-overlay-hit-target').click();
  await expect(page.locator('[data-creative-element="overlay"][data-selected="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Before / After', exact: true }).click();
  await expect(page.locator('[data-selected="true"]')).toHaveCount(0);
  await expect(page.locator('p.sr-only[role="status"]')).toContainText(
    'Overlay selection cleared because it is hidden in this preview.',
  );
  await page.getByRole('button', { name: 'Showing before', exact: true }).click();

  await page.locator('#inspector-qr').click();
  const qrPicker = page.getByRole('listbox', { name: 'Choose from QR Studio' });
  const qrOptions = qrPicker.locator('[role="option"]:not(:disabled)');
  expect(await qrOptions.count()).toBeGreaterThan(0);
  await qrOptions.first().click();
  await expect(page.getByRole('button', { name: 'Edit QR code' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit QR code' }).click();
  await expect(page.locator('#inspector-qr')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByLabel('Creative inspector').getByText(/Selected:\s*QR Code/).filter({ visible: true }).first()).toBeVisible();

  const beforeAfter = page.getByRole('button', { name: 'Before / After', exact: true }).first();
  await beforeAfter.click();
  await expect(page.getByTestId('creative-preview-canvas').first()).toHaveAttribute('data-original-treatment', 'true');
  await page.getByRole('button', { name: 'Showing before', exact: true }).click();
  await expect(page.getByTestId('creative-preview-canvas').first()).toHaveAttribute('data-original-treatment', 'false');

  const lifecycleBeforePrintSave = await readMailerProductionLifecycleState(request, adminApi);
  expect(lifecycleBeforePrintSave).toMatchObject({
    status: 'ready_for_print',
    layoutLocked: true,
    postalAreaConfirmed: true,
    postalAreaConfirmationRevision: lifecycleBeforePrintSave.layoutRevision,
    printerSpecsConfirmed: true,
    printerSpecsConfirmationRevision: lifecycleBeforePrintSave.layoutRevision,
    colorProfileConfirmed: true,
    colorProfileConfirmationRevision: lifecycleBeforePrintSave.layoutRevision,
    preflightLayoutRevision: lifecycleBeforePrintSave.layoutRevision,
  });
  expect(lifecycleBeforePrintSave.preflightFingerprint).not.toBeNull();
  expect(lifecycleBeforePrintSave.currentPreflightRunId).not.toBeNull();
  expect(lifecycleBeforePrintSave.currentCandidate).toMatchObject({
    layoutRevision: lifecycleBeforePrintSave.layoutRevision,
    productionVersion: lifecycleBeforePrintSave.productionVersion,
    fingerprint: lifecycleBeforePrintSave.preflightFingerprint,
  });
  const currentCandidateBeforePrintSave = lifecycleBeforePrintSave.currentCandidate!;

  await saveCreative(page);

  await expect.poll(
    async () => (await readMailerProductionLifecycleState(request, adminApi)).layoutRevision,
    { message: 'A print-affecting Mailer save must advance the seeded Community Mailer revision.' },
  ).toBe(lifecycleBeforePrintSave.layoutRevision + 1);
  const lifecycleAfterPrintSave = await readMailerProductionLifecycleState(request, adminApi);
  expect(lifecycleAfterPrintSave).toMatchObject({
    layoutRevision: lifecycleBeforePrintSave.layoutRevision + 1,
    productionVersion: lifecycleBeforePrintSave.productionVersion + 1,
    status: 'review',
    layoutLocked: true,
    postalAreaConfirmed: false,
    postalAreaConfirmationRevision: null,
    printerSpecsConfirmed: false,
    printerSpecsConfirmationRevision: null,
    colorProfileConfirmed: false,
    colorProfileConfirmationRevision: null,
    preflightFingerprint: null,
    preflightLayoutRevision: null,
    preflightCompletedAt: null,
    currentPreflightRunId: null,
    currentCandidate: null,
  });
  expect(lifecycleAfterPrintSave.candidateBindings).toContainEqual(currentCandidateBeforePrintSave);
  expect(currentCandidateBeforePrintSave.layoutRevision).toBeLessThan(lifecycleAfterPrintSave.layoutRevision);

  let history = await openHistory(page);
  await history.getByRole('button', { name: 'Preview' }).first().click();
  const previewDialog = page.getByRole('dialog').filter({ hasText: 'Creative History preview' });
  await expect(previewDialog).toBeVisible();
  await expect(previewDialog.getByTestId('creative-preview-canvas')).toBeVisible();
  await previewDialog.getByRole('button', { name: /^Close Saved/ }).click();

  await page.getByRole('button', { name: 'Edit image' }).click();
  await nudgeRange(page.getByLabel('Contrast'));
  await page.locator('#inspector-overlay').click();
  await page.getByLabel('Overlay color').fill(uniqueColor(runColorSeed, 1));

  history = await openHistory(page);
  await history.getByRole('button', { name: 'Compare' }).first().click();
  const unsavedCompareDialog = page.getByRole('dialog', { name: 'Compare creative versions' });
  const savedVsUnsaved = unsavedCompareDialog.getByRole('button', { name: 'Saved vs. unsaved' });
  await expect(savedVsUnsaved).toBeEnabled();
  await savedVsUnsaved.click();
  await expect(unsavedCompareDialog.getByText('Current Mailer saved', { exact: true })).toBeVisible();
  await expect(unsavedCompareDialog.getByText('Current Mailer unsaved', { exact: true })).toBeVisible();
  await unsavedCompareDialog.getByRole('button', { name: 'Close Compare creative versions' }).click();

  await saveCreative(page);

  history = await openHistory(page);
  await history.getByRole('button', { name: 'Compare' }).first().click();
  const compareDialog = page.getByRole('dialog', { name: 'Compare creative versions' });
  await expect(compareDialog).toBeVisible();
  await expect(compareDialog.getByTestId('creative-compare-view')).toBeVisible();
  await expect(compareDialog.getByRole('button', { name: 'History vs. session' })).toHaveAttribute('aria-pressed', 'true');
  await expect(compareDialog.getByRole('button', { name: 'History vs. saved' })).toBeEnabled();
  await expect(compareDialog.getByRole('button', { name: 'Saved vs. unsaved' })).toBeDisabled();
  await expect(compareDialog.getByText('Current Mailer saved', { exact: true })).toBeVisible();
  await compareDialog.getByRole('button', { name: 'Close Compare creative versions' }).click();

  history = await openHistory(page);
  const versions = history.getByRole('listitem');
  expect(await versions.count()).toBeGreaterThan(1);
  const mailerHistoryBeforeRestore = await readMailerHistoryCount(request, api);
  await versions.nth(1).getByRole('button', { name: 'Restore' }).click();
  const restoreDialog = page.getByRole('dialog', { name: 'Restore this creative version?' });
  await expect(restoreDialog).toBeVisible();
  await restoreDialog.getByRole('button', { name: 'Load as unsaved' }).click();
  await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
  await expect(page.getByText(/Historical creative loaded as unsaved changes/)).toBeVisible();
  await saveCreative(page);
  await expect(page.getByText('Saved', { exact: true }).first()).toBeVisible();
  await expect.poll(
    () => readMailerHistoryCount(request, api),
    { message: 'Restoring A after B must append a new Mailer history event.' },
  ).toBe(mailerHistoryBeforeRestore + 1);

  const campaignTitle = (await page.locator('h1').innerText()).trim();
  await page.getByRole('button', { name: 'Open full-screen preview' }).click();
  const fullScreen = page.getByRole('dialog', { name: campaignTitle, exact: true });
  await expect(fullScreen).toBeVisible();
  await expect(fullScreen.getByText(/exact current saved state/)).toBeVisible();
  await expect(fullScreen.getByTestId('creative-preview-canvas')).toBeVisible();
  await fullScreen.getByRole('button', { name: 'Exit full screen' }).click();
  await expect(fullScreen).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('creative-preview-canvas').first()).toBeVisible();
  const [mailerBeforeSocial, lifecycleBeforeSocial] = await Promise.all([
    readMailerBoundaryState(request, api),
    readMailerProductionLifecycleState(request, adminApi),
  ]);

  const destinationNav = page.getByRole('navigation', { name: 'Creative destinations' });
  await destinationNav.getByRole('button', { name: /Social Media/ }).click();
  await page.getByRole('button', { name: 'Social', exact: true }).click();
  await page.getByRole('button', { name: 'Edit image' }).click();
  await nudgeRange(page.getByLabel('Rotation'));
  await page.locator('#inspector-overlay').click();
  await page.getByLabel('Overlay color').fill(uniqueColor(runColorSeed, 2));
  await expect(page.getByText('Social-only override · print remains current', { exact: true })).toBeVisible();
  await saveCreative(page);

  const [mailerAfterSocial, lifecycleAfterSocial] = await Promise.all([
    readMailerBoundaryState(request, api),
    readMailerProductionLifecycleState(request, adminApi),
  ]);
  expect(mailerAfterSocial).toEqual(mailerBeforeSocial);
  expect(lifecycleAfterSocial).toEqual(lifecycleBeforeSocial);
  const latestVersion = await readLatestCreativeVersion(request, api);
  expect(latestVersion).toMatchObject({
    destination: 'social',
    scope: 'destination',
    affects_print: false,
  });

  await testInfo.attach('social-mailer-isolation.json', {
    body: Buffer.from(JSON.stringify({
      mailerBoundaryBefore: mailerBeforeSocial,
      mailerBoundaryAfter: mailerAfterSocial,
      lifecycleBeforePrintSave,
      lifecycleAfterPrintSave,
      lifecycleBeforeSocial,
      lifecycleAfterSocial,
      latestVersion,
    }, null, 2)),
    contentType: 'application/json',
  });
  expect(failures, 'Advanced Creative Workshop browser failures').toEqual([]);
});

test('Advanced Creative Workshop keeps direct editing and modal controls usable without viewport overflow', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'Desktop receives the complete state-changing workflow.');

  await signIn(page);
  const failures = monitorWorkshopPage(page, testInfo);
  const inspectorHint = page.getByRole('button', { name: 'Got it' });
  if (await inspectorHint.isVisible()) await inspectorHint.click();

  await assertNoHorizontalOverflow(page, `${testInfo.project.name} workshop`);
  const imageTarget = page.getByRole('button', { name: 'Edit image' });
  await imageTarget.focus();
  await imageTarget.press('Enter');
  const inspector = page.getByLabel('Creative inspector');
  await expect(inspector.getByText(/Selected:\s*Image/).filter({ visible: true }).first()).toBeVisible();
  await expect(page.locator('#inspector-image')).toHaveAttribute('aria-expanded', 'true');
  await assertNoHorizontalOverflow(page, `${testInfo.project.name} image inspector`);
  await page.getByRole('button', { name: 'Close creative inspector' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-selected="true"]')).toHaveCount(0);

  const campaignTitle = (await page.locator('h1').innerText()).trim();
  await page.getByRole('button', { name: 'Open full-screen preview' }).click();
  const fullScreen = page.getByRole('dialog', { name: campaignTitle, exact: true });
  await expect(fullScreen.getByTestId('creative-preview-canvas')).toBeVisible();
  await expect(fullScreen.getByLabel('Full-screen format')).toBeVisible();
  await assertNoHorizontalOverflow(page, `${testInfo.project.name} full-screen preview`);
  await fullScreen.getByRole('button', { name: 'Exit full screen' }).click();

  await page.getByRole('button', { name: 'Open Creative History' }).click();
  const history = page.getByRole('dialog', { name: 'Creative History' });
  await expect(history).toBeVisible();
  await assertNoHorizontalOverflow(page, `${testInfo.project.name} creative history`);
  const compareAction = history.getByRole('button', { name: 'Compare' }).first();
  if (testInfo.project.name === 'mobile' && await compareAction.count()) {
    await compareAction.click();
    const compare = page.getByRole('dialog', { name: 'Compare creative versions' });
    await expect(compare.getByRole('button', { name: 'Toggle' })).toHaveAttribute('aria-pressed', 'true');
    await compare.getByRole('button', { name: 'Close Compare creative versions' }).click();
  } else {
    await history.getByRole('button', { name: 'Close Creative History' }).click();
  }

  expect(failures, `${testInfo.project.name} Advanced Creative Workshop browser failures`).toEqual([]);
});
test('Creative History enforces tenant ownership, immutability, and narrow Mission Control inspection', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Creative History authorization is viewport independent.');

  const [ownerAApi, ownerBApi, adminApi] = await Promise.all([
    authenticatedApi(request, owner),
    authenticatedApi(request, secondOwner),
    authenticatedApi(request, admin),
  ]);
  const historyRow = await ensureOwnerHistoryRow(request, ownerAApi);
  const statuses: Record<string, number> = {};

  const ownerBRead = await request.get(
    `${ownerBApi.url}/rest/v1/campaign_creative_versions?select=id&campaign_id=eq.${campaignId}`,
    { headers: apiHeaders(ownerBApi) },
  );
  statuses.ownerB_direct_read = ownerBRead.status();
  expect(ownerBRead.status()).toBe(200);
  expect(await ownerBRead.json()).toEqual([]);

  const ownerBSave = await request.post(`${ownerBApi.url}/rest/v1/rpc/save_campaign_creative_version`, {
    headers: apiHeaders(ownerBApi),
    data: {
      p_campaign_id: campaignId,
      p_destination: historyRow.destination,
      p_format_key: historyRow.format_key,
      p_settings_snapshot: historyRow.settings_snapshot,
      p_change_summary: ['Cross-tenant save must fail'],
      p_affects_print: false,
      p_created_override: false,
      p_scope: historyRow.scope,
    },
  });
  statuses.ownerB_save_rpc = ownerBSave.status();
  expect(ownerBSave.status()).toBeGreaterThanOrEqual(400);
  expect(ownerBSave.status()).toBeLessThan(500);
  expect(await ownerBSave.text()).toContain('Campaign owner access required');

  const ownerAPatch = await request.patch(
    `${ownerAApi.url}/rest/v1/campaign_creative_versions?id=eq.${historyRow.id}`,
    { headers: apiHeaders(ownerAApi), data: { change_summary: ['Direct mutation must fail'] } },
  );
  statuses.ownerA_direct_patch = ownerAPatch.status();
  expect(ownerAPatch.status()).toBeGreaterThanOrEqual(400);
  expect(ownerAPatch.status()).toBeLessThan(500);
  expect(await ownerAPatch.text()).toMatch(/permission denied|immutable/i);

  const ownerADelete = await request.delete(
    `${ownerAApi.url}/rest/v1/campaign_creative_versions?id=eq.${historyRow.id}`,
    { headers: apiHeaders(ownerAApi) },
  );
  statuses.ownerA_direct_delete = ownerADelete.status();
  expect(ownerADelete.status()).toBeGreaterThanOrEqual(400);
  expect(ownerADelete.status()).toBeLessThan(500);
  expect(await ownerADelete.text()).toMatch(/permission denied/i);
  expect((await readOwnerHistoryRows(request, ownerAApi))[0]?.id).toBe(historyRow.id);

  const ownerAAdminRpc = await request.post(`${ownerAApi.url}/rest/v1/rpc/get_admin_campaign_creative_versions`, {
    headers: apiHeaders(ownerAApi),
    data: { p_campaign_id: campaignId, p_limit: 25, p_before: null },
  });
  statuses.ownerA_admin_rpc = ownerAAdminRpc.status();
  expect(ownerAAdminRpc.status()).toBeGreaterThanOrEqual(400);
  expect(ownerAAdminRpc.status()).toBeLessThan(500);
  expect(await ownerAAdminRpc.text()).toContain('Mission Control administrator access required');

  const adminRpc = await request.post(`${adminApi.url}/rest/v1/rpc/get_admin_campaign_creative_versions`, {
    headers: apiHeaders(adminApi),
    data: { p_campaign_id: campaignId, p_limit: 25, p_before: null },
  });
  statuses.admin_history_rpc = adminRpc.status();
  expect(adminRpc.status()).toBe(200);
  const adminRows = await adminRpc.json() as Array<{ id: string; campaign_id: string }>;
  expect(adminRows).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: historyRow.id, campaign_id: campaignId }),
  ]));

  const adminDirectRead = await request.get(
    `${adminApi.url}/rest/v1/campaign_creative_versions?select=id&campaign_id=eq.${campaignId}`,
    { headers: apiHeaders(adminApi) },
  );
  statuses.admin_direct_read = adminDirectRead.status();
  expect(adminDirectRead.status()).toBe(200);
  expect(await adminDirectRead.json()).toEqual([]);

  await testInfo.attach('creative-history-authorization-statuses.json', {
    body: Buffer.from(JSON.stringify(statuses, null, 2)),
    contentType: 'application/json',
  });
});
test('Mailer creative save rejects low-contrast QR artwork without mutating production', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'The protected creative-save boundary is viewport independent.');

  const [ownerApi, adminApi] = await Promise.all([
    authenticatedApi(request, owner),
    authenticatedApi(request, admin),
  ]);
  const originalSnapshot = await readCurrentWorkshopSnapshot(request, ownerApi);
  const globalSettings = originalSnapshot.global as Record<string, unknown>;
  const overrides = originalSnapshot.overrides as Record<string, unknown>;
  const mailerOverride = overrides.mailer && typeof overrides.mailer === 'object' && !Array.isArray(overrides.mailer)
    ? overrides.mailer as Record<string, unknown>
    : null;
  const mailerSettings = mailerOverride ?? globalSettings;
  const qrId = mailerSettings.qrId;
  expect(typeof qrId).toBe('string');

  const qrResponse = await request.get(
    `${ownerApi.url}/rest/v1/qr_links?select=foreground_color,inner_field_color&id=eq.${qrId}`,
    { headers: apiHeaders(ownerApi) },
  );
  expect(qrResponse.status()).toBe(200);
  const qrRows = await qrResponse.json() as Array<{
    foreground_color: string;
    inner_field_color: string;
  }>;
  expect(qrRows).toHaveLength(1);
  const originalQrColors = qrRows[0];
  const historyBefore = await readCreativeVersionIds(request, ownerApi);
  const productionBefore = await readMailerProductionLifecycleState(request, adminApi);

  try {
    const lowContrastPatch = await request.patch(
      `${ownerApi.url}/rest/v1/qr_links?id=eq.${qrId}`,
      {
        headers: apiHeaders(ownerApi),
        data: { foreground_color: '#777777', inner_field_color: '#ffffff' },
      },
    );
    expect(lowContrastPatch.status()).toBe(204);

    const attemptedSnapshot = structuredClone(originalSnapshot);
    const attemptedOverrides = attemptedSnapshot.overrides as Record<string, unknown>;
    const attemptedGlobal = attemptedSnapshot.global as Record<string, unknown>;
    const attemptedMailer = mailerOverride
      ? attemptedOverrides.mailer as Record<string, unknown>
      : attemptedGlobal;
    const opacity = Number(attemptedMailer.overlayOpacity ?? 55);
    attemptedMailer.overlayOpacity = opacity >= 100 ? 99 : opacity + 1;
    const formats = attemptedSnapshot.formats as Record<string, unknown>;

    const blockedSave = await request.post(
      `${ownerApi.url}/rest/v1/rpc/save_campaign_creative_version`,
      {
        headers: apiHeaders(ownerApi),
        data: {
          p_campaign_id: campaignId,
          p_destination: 'mailer',
          p_format_key: typeof formats.mailer === 'string' ? formats.mailer : 'standard',
          p_settings_snapshot: attemptedSnapshot,
          p_change_summary: ['Low contrast must fail'],
          p_affects_print: true,
          p_created_override: false,
          p_scope: mailerOverride ? 'destination' : 'global',
        },
      },
    );
    expect(blockedSave.status()).toBeGreaterThanOrEqual(400);
    expect(blockedSave.status()).toBeLessThan(500);
    expect(await blockedSave.text()).toContain('4.5:1 contrast');
    expect(await readCreativeVersionIds(request, ownerApi)).toEqual(historyBefore);
    expect(await readCurrentWorkshopSnapshot(request, ownerApi)).toEqual(originalSnapshot);
    expect(await readMailerProductionLifecycleState(request, adminApi)).toEqual(productionBefore);
  } finally {
    const restoreQr = await request.patch(
      `${ownerApi.url}/rest/v1/qr_links?id=eq.${qrId}`,
      { headers: apiHeaders(ownerApi), data: originalQrColors },
    );
    expect(restoreQr.status()).toBe(204);
  }
});

test('Creative History retention preserves production pins and terminal Mailer lifecycle', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Retention runs last after all visual and stateful release coverage.');
  test.setTimeout(120_000);

  const [ownerApi, adminApi] = await Promise.all([
    authenticatedApi(request, owner),
    authenticatedApi(request, admin),
  ]);
  await prepareArchivedCampaignMailerFixture(request, adminApi);
  const [originalSnapshot, lifecycleBeforeRetention, terminalLifecycleBefore] = await Promise.all([
    readCurrentWorkshopSnapshot(request, ownerApi),
    readMailerProductionLifecycleState(request, adminApi),
    readMailerProductionLifecycleState(request, adminApi, terminalMailerId),
  ]);
  expect(terminalLifecycleBefore).toMatchObject({
    status: 'archived',
    layoutLocked: true,
  });
  let pinnedIdsBefore: string[] = [];
  let pinnedVersionId = '';
  let lifecycleAtProductionPin: MailerProductionLifecycleState | null = null;
  const globalSettings = originalSnapshot.global;
  const formats = originalSnapshot.formats;
  const initialOverrides = originalSnapshot.overrides;
  expect(globalSettings && typeof globalSettings === 'object' && !Array.isArray(globalSettings)).toBe(true);
  expect(formats && typeof formats === 'object' && !Array.isArray(formats)).toBe(true);
  expect(initialOverrides && typeof initialOverrides === 'object' && !Array.isArray(initialOverrides)).toBe(true);
  const mailerFormat = (formats as Record<string, unknown>).mailer;
  expect(typeof mailerFormat).toBe('string');

  let retentionSnapshot = structuredClone(originalSnapshot);
  for (let index = 0; index < 30; index += 1) {
    const overrides = retentionSnapshot.overrides as Record<string, unknown>;
    const existingMailer = overrides.mailer;
    const mailerSettings = existingMailer && typeof existingMailer === 'object' && !Array.isArray(existingMailer)
      ? existingMailer as Record<string, unknown>
      : globalSettings as Record<string, unknown>;
    retentionSnapshot = {
      ...retentionSnapshot,
      overrides: {
        ...overrides,
        mailer: {
          ...mailerSettings,
          overlayColor: uniqueColor(0xb10000, index),
        },
      },
    };
    const retentionSave = await request.post(`${ownerApi.url}/rest/v1/rpc/save_campaign_creative_version`, {
      headers: apiHeaders(ownerApi),
      data: {
        p_campaign_id: campaignId,
        p_destination: 'mailer',
        p_format_key: mailerFormat,
        p_settings_snapshot: retentionSnapshot,
        p_change_summary: [`Retention fixture ${index + 1}`],
        p_affects_print: false,
        p_created_override: true,
        p_scope: 'destination',
      },
    });
    expect(retentionSave.status(), `retention save ${index + 1}`).toBe(200);
    const saveRows = await retentionSave.json() as Array<{
      version_id: string;
      version_created: boolean;
    }>;
    expect(saveRows).toHaveLength(1);
    expect(saveRows[0].version_created, `retention save ${index + 1}`).toBe(true);

    if (index === 0) {
      pinnedVersionId = saveRows[0].version_id;
      const snapshotResponse = await request.post(
        `${adminApi.url}/rest/v1/rpc/create_admin_community_mailer_snapshots`,
        {
          headers: apiHeaders(adminApi),
          data: { p_mailer_id: mailerId },
        },
      );
      expect(snapshotResponse.status(), 'create production-pinning snapshot').toBe(200);
      const createdSnapshotCount = await snapshotResponse.json() as number;
      expect(
        createdSnapshotCount,
        'The current Mailer revision must create production snapshot evidence.',
      ).toBeGreaterThan(0);

      lifecycleAtProductionPin = await readMailerProductionLifecycleState(
        request,
        adminApi,
      );
      pinnedIdsBefore = [
        ...new Set(lifecycleAtProductionPin.snapshotCreativeVersionIds),
      ].sort();
      expect(
        pinnedIdsBefore.length,
        'Retention proof requires at least one non-null production Creative History pin.',
      ).toBeGreaterThan(0);
      expect(pinnedIdsBefore).toContain(pinnedVersionId);
    }
  }

  expect(lifecycleAtProductionPin).not.toBeNull();
  expect(pinnedVersionId).not.toBe('');

  const originalOverrides = originalSnapshot.overrides as Record<string, unknown>;
  const restoreSave = await request.post(`${ownerApi.url}/rest/v1/rpc/save_campaign_creative_version`, {
    headers: apiHeaders(ownerApi),
    data: {
      p_campaign_id: campaignId,
      p_destination: 'mailer',
      p_format_key: mailerFormat,
      p_settings_snapshot: originalSnapshot,
      p_change_summary: ['Restore canonical creative after retention fixture'],
      p_affects_print: false,
      p_created_override: Boolean(originalOverrides.mailer),
      p_scope: originalOverrides.mailer ? 'destination' : 'global',
    },
  });
  expect(restoreSave.status()).toBe(200);
  const restoreRows = await restoreSave.json() as Array<{ version_created: boolean }>;
  expect(restoreRows).toHaveLength(1);
  expect(restoreRows[0].version_created).toBe(true);

  const [
    restoredSnapshot,
    lifecycleAfterRetention,
    terminalLifecycleAfter,
    retainedMailerRows,
    allRetainedRows,
  ] = await Promise.all([
    readCurrentWorkshopSnapshot(request, ownerApi),
    readMailerProductionLifecycleState(request, adminApi),
    readMailerProductionLifecycleState(request, adminApi, terminalMailerId),
    readCreativeVersionIds(request, ownerApi, 'mailer'),
    readCreativeVersionIds(request, ownerApi),
  ]);
  expect(restoredSnapshot).toEqual(originalSnapshot);
  expect(lifecycleAfterRetention.layoutRevision).toBe(lifecycleBeforeRetention.layoutRevision + 31);
  expect(lifecycleAfterRetention.productionVersion).toBe(lifecycleBeforeRetention.productionVersion + 31);
  expect(terminalLifecycleAfter).toEqual(terminalLifecycleBefore);

  const pinnedIdsAfter = [...new Set(lifecycleAfterRetention.snapshotCreativeVersionIds)].sort();
  expect(pinnedIdsAfter).toEqual(pinnedIdsBefore);
  const retainedIds = new Set(allRetainedRows.map(row => row.id));
  expect(
    retainedIds.has(pinnedVersionId),
    `production-pinned Creative version ${pinnedVersionId}`,
  ).toBe(true);
  for (const pinnedId of pinnedIdsBefore) {
    expect(retainedIds.has(pinnedId), `production-pinned Creative version ${pinnedId}`).toBe(true);
  }
  const productionPinnedIds = new Set(pinnedIdsAfter);
  const unpinnedMailerRows = retainedMailerRows.filter(row => !productionPinnedIds.has(row.id));
  expect(unpinnedMailerRows.length, 'Retention leaves no more than 25 unpinned Mailer versions.').toBeLessThanOrEqual(25);

  await testInfo.attach('creative-history-retention.json', {
    body: Buffer.from(JSON.stringify({
      attemptedMaterialVersions: 30,
      restoredOriginal: true,
      mailerRowsRetained: retainedMailerRows.length,
      unpinnedMailerRowsRetained: unpinnedMailerRows.length,
      productionPinnedIdsBefore: pinnedIdsBefore,
      productionPinnedIdsAfter: pinnedIdsAfter,
      lifecycleBeforeRetention,
      lifecycleAtProductionPin,
      lifecycleAfterRetention,
      terminalLifecycleBefore,
      terminalLifecycleAfter,
    }, null, 2)),
    contentType: 'application/json',
  });
});
