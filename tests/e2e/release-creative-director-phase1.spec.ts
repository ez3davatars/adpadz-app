import { expect, test, type Locator, type Page } from '@playwright/test';

const password = 'AdpadzDemo!2026';
const owner = 'owner@adpadz-demo.test';
const campaignId = '30000000-0000-4000-8000-000000000001';
const creativeRoute = `/app/business/campaigns/${campaignId}/creative`;
const conceptIds = ['editorial', 'cinematic', 'impact'] as const;

async function signInToCreativeDirector(page: Page) {
  await page.goto(`/auth?next=${encodeURIComponent(creativeRoute)}`);
  await page.getByLabel('Email').fill(owner);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page).toHaveURL(new RegExp(`${campaignId}/creative`));
  await expect(page.getByTestId('creative-director-workspace')).toBeVisible();
}

async function openGuidedWorkspace(page: Page) {
  await page.goto(creativeRoute);
  const workspace = page.getByTestId('creative-director-workspace');
  await expect(workspace).toBeVisible();
  await expect(
    workspace
      .getByTestId('creative-director-preview-scale')
      .getByTestId('creative-preview-canvas'),
  ).toBeVisible();
  return workspace;
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    return {
      clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
      offenders: [...document.querySelectorAll<HTMLElement>('*')]
        .filter(element => element.getBoundingClientRect().right > clientWidth + 1)
        .slice(0, 10)
        .map(element => ({
          tag: element.tagName,
          className: String(element.className),
          right: Math.round(element.getBoundingClientRect().right),
          width: Math.round(element.getBoundingClientRect().width),
        })),
    };
  });

  expect.soft(
    metrics.documentWidth,
    `${label} document overflow: ${JSON.stringify(metrics.offenders)}`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect.soft(metrics.bodyWidth, `${label} body overflow`).toBeLessThanOrEqual(
    metrics.clientWidth + 1,
  );
}

function conceptRadio(concepts: Locator, conceptId: string) {
  return concepts.locator(`[role="radio"][data-concept="${conceptId}"]`);
}

test.describe('Creative Director Phase 1', () => {
  test('desktop guided workflow exposes distinct concepts, keyboard switching, optimizer reset, and clean Advanced Edit access', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'The complete interaction contract runs once on desktop.',
    );

    await signInToCreativeDirector(page);
    let workspace = page.getByTestId('creative-director-workspace');

    await test.step('show the guided Creative Director regions and mailer preview', async () => {
      await expect(workspace.getByText('Creative Brief', { exact: true })).toBeVisible();
      await expect(workspace.getByText('Concept Workspace', { exact: true })).toBeVisible();
      await expect(workspace.getByText('Creative Optimizer', { exact: true })).toBeVisible();
      await expect(
        workspace.getByRole('combobox', { name: /Campaign destination/ }),
      ).toHaveValue('mailer');
      await expect(
        workspace.getByRole('combobox', { name: /Campaign goal/ }),
      ).toBeVisible();

      const preview = workspace
        .getByTestId('creative-director-preview-scale')
        .getByTestId('creative-preview-canvas');
      await expect(preview).toBeVisible();
      await expect(
        preview.locator('[data-guide="safe-area"][data-destination="mailer"]'),
      ).toBeVisible();
      await expect(
        workspace.getByText('Dashed line marks the print-safe boundary', {
          exact: true,
        }),
      ).toBeVisible();
    });

    await test.step('open Advanced Edit only from a clean saved state', async () => {
      await expect(
        workspace.getByText('Campaign Creative saved', { exact: true }),
      ).toBeVisible();
      await workspace
        .getByRole('button', { name: 'Advanced Edit', exact: true })
        .first()
        .click();

      await expect(page).toHaveURL(
        new RegExp(`${campaignId}/creative\\?mode=advanced$`),
      );
      await expect(page.getByText('Creative Studio', { exact: true })).toBeVisible();
      await expect(page.getByTestId('creative-preview-stage')).toBeVisible();

      workspace = await openGuidedWorkspace(page);
    });

    const concepts = workspace.getByRole('radiogroup', {
      name: 'Campaign creative concepts',
    });
    const radios = concepts.getByRole('radio');

    await test.step('render three meaningfully distinct concept recipes', async () => {
      await expect(radios).toHaveCount(3);
      for (const conceptId of conceptIds) {
        await expect(conceptRadio(concepts, conceptId)).toBeVisible();
      }

      const renderedTemplates = await radios.evaluateAll(elements =>
        elements.map(element =>
          element.querySelector('[data-template]')?.getAttribute('data-template'),
        ),
      );
      expect(renderedTemplates.every(Boolean)).toBe(true);
      expect(new Set(renderedTemplates).size).toBe(3);
    });

    await test.step('switch concepts with arrow keys and move focus with selection', async () => {
      const active = concepts.locator('[role="radio"][aria-checked="true"]');
      await expect(active).toHaveCount(1);
      const startingId = await active.getAttribute('data-concept');
      expect(conceptIds).toContain(startingId);

      const startingIndex = conceptIds.indexOf(
        startingId as (typeof conceptIds)[number],
      );
      const nextId = conceptIds[(startingIndex + 1) % conceptIds.length];
      const next = conceptRadio(concepts, nextId);

      await active.focus();
      await active.press('ArrowRight');
      await expect(next).toHaveAttribute('aria-checked', 'true');
      await expect(next).toBeFocused();

      const selectedTemplate = await next
        .locator('[data-template]')
        .getAttribute('data-template');
      expect(selectedTemplate).toBeTruthy();
      await expect(
        workspace
          .getByTestId('creative-director-preview-scale')
          .locator('[data-template]'),
      ).toHaveAttribute('data-template', selectedTemplate as string);

      await next.press('ArrowLeft');
      await expect(conceptRadio(concepts, startingId as string)).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await expect(conceptRadio(concepts, startingId as string)).toBeFocused();
    });

    await test.step('apply an optimizer preset and restore recipe defaults', async () => {
      const selectedConceptId = await concepts
        .locator('[role="radio"][aria-checked="true"]')
        .getAttribute('data-concept');
      const simplify = workspace.getByRole('button', {
        name: /Simplify/,
      });
      const reset = workspace.getByRole('button', {
        name: 'Reset Refinements',
        exact: true,
      });

      await expect(reset).toBeDisabled();
      await simplify.click();
      await expect(simplify).not.toHaveAttribute('aria-pressed', /.*/);
      await expect(reset).toBeEnabled();
      await expect(
        workspace
          .locator('[role="status"]:visible')
          .filter({ hasText: 'Simplify applied immediately.' }),
      ).toBeVisible();

      await reset.click();
      await expect(reset).toBeDisabled();
      await expect(
        conceptRadio(concepts, selectedConceptId as string),
      ).toHaveAttribute('aria-checked', 'true');
      await expect(
        workspace
          .locator('[role="status"]:visible')
          .filter({ hasText: 'Recipe defaults restored.' }),
      ).toBeVisible();
    });

    await assertNoHorizontalOverflow(page, 'desktop Creative Director');
    await testInfo.attach('creative-director-desktop.png', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });

  test('a missing Campaign QR has an in-workspace recovery path and never deadlocks Advanced Edit', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop',
      'The QR recovery workflow runs once on desktop.',
    );

    await page.route('**/rest/v1/qr_links*', async route => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      if (
        request.method() === 'GET'
        && pathname.endsWith('/rest/v1/qr_links')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '[]',
        });
        return;
      }
      await route.continue();
    });

    await signInToCreativeDirector(page);
    const workspace = page.getByTestId('creative-director-workspace');
    const qrSelect = workspace.getByLabel('Campaign QR');

    await expect(qrSelect).toBeDisabled();
    await expect(qrSelect).toContainText('No scan-ready Campaign QR available');
    await expect(
      workspace.getByRole('link', { name: 'Open QR Studio' }),
    ).toBeVisible();

    const concepts = workspace.getByRole('radiogroup', {
      name: 'Campaign creative concepts',
    });
    const activeId = await concepts
      .locator('[role="radio"][aria-checked="true"]')
      .getAttribute('data-concept');
    const targetId = activeId === 'editorial' ? 'impact' : 'editorial';
    await conceptRadio(concepts, targetId).click();

    await workspace
      .getByRole('button', { name: 'Save Campaign Creative', exact: true })
      .click();
    await expect(
      workspace.getByRole('alert').filter({
        hasText: 'Select a visible, scan-ready Campaign QR in the Creative Brief',
      }),
    ).toBeVisible();

    await workspace
      .getByRole('button', { name: 'Advanced Edit', exact: true })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Leave Creative Director?' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Leave without saving' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Keep current creative' }).click();
    await expect(page).toHaveURL(new RegExp(`${campaignId}/creative$`));
  });

  test('tablet and mobile keep the preview, concepts, optimizer actions, and primary action usable without page overflow', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name === 'desktop',
      'The stacked-layout smoke contract runs on tablet and mobile.',
    );

    await signInToCreativeDirector(page);
    const workspace = page.getByTestId('creative-director-workspace');
    const concepts = workspace.getByRole('radiogroup', {
      name: 'Campaign creative concepts',
    });

    await expect(
      workspace
        .getByTestId('creative-director-preview-scale')
        .getByTestId('creative-preview-canvas'),
    ).toBeVisible();
    await expect(concepts.getByRole('radio')).toHaveCount(3);

    const optimizerAction = workspace.getByRole('button', {
      name: /Improve QR Visibility/,
    });
    await optimizerAction.scrollIntoViewIfNeeded();
    await expect(optimizerAction).toBeVisible();

    const primaryActions = workspace.getByRole('button', {
      name: 'Continue to Distribution',
      exact: true,
    });
    await expect(primaryActions.last()).toBeVisible();
    await assertNoHorizontalOverflow(page, `${testInfo.project.name} Creative Director`);
    await testInfo.attach(`creative-director-${testInfo.project.name}.png`, {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });
  });
});
