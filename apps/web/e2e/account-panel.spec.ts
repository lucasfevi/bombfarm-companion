import { test, expect, type Page } from '@playwright/test';
import {
  gotoAccountPage,
  importedRoster,
  seedLocalStorage,
  selectSavedHero,
  type SeededState,
} from './fixtures/seed';

function accountPanel(page: Page, lang: 'pt' | 'en' = 'en') {
  const title = lang === 'en' ? /^Account$/i : /^Conta$/i;
  return page.locator('section').filter({
    has: page.getByRole('heading', { name: title, level: 2 }),
  });
}

/** Tree damage at default ×1 — valid for new users (not a required warning). */
function treeDefaultState(lang: 'en' | 'pt'): SeededState {
  return {
    ...importedRoster,
    lang,
    account: {
      ...importedRoster.account!,
      tree: {
        ...importedRoster.account!.tree,
        danoTotal: 1,
      },
    },
  };
}

test.describe('account panel chrome', () => {
  test('has no Account-wide / Da conta chip', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await gotoAccountPage(page);

    const account = accountPanel(page, 'en');
    await expect(account.getByRole('heading', { name: /^Account$/i, level: 2 })).toBeVisible();
    await expect(account.getByText(/^Account-wide$/i)).toHaveCount(0);
    await expect(account.getByText(/^Da conta$/i)).toHaveCount(0);
  });

  test('tree ×1 shows no required chrome, and the planner has no Account tab at all', async ({
    page,
  }) => {
    await seedLocalStorage(page, treeDefaultState('en'));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    // Account is a nav route now — the tab it used to occupy is gone, badge and all.
    await expect(page.getByRole('tab', { name: /^Account$/i })).toHaveCount(0);

    await gotoAccountPage(page);
    const account = accountPanel(page, 'en');
    await expect(account.getByText(/^required$/i)).toHaveCount(0);
    await expect(page.locator('[data-tab-status-banner]')).toHaveCount(0);
  });

  test('stack rows share height across House / Skill Tree / Team Buffs', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await gotoAccountPage(page);

    const account = accountPanel(page, 'en');
    const houseBlock = account
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: /^House$/i, level: 3 }) })
      .first();
    const houseType = houseBlock.locator('label').nth(0);
    const houseLevel = houseBlock.locator('label').nth(1);
    const treeDano = account.locator('label').filter({ hasText: /Total damage/i }).first();
    const warCry = account.locator('label').filter({ hasText: /War Cry/i }).first();

    const boxes = await Promise.all([
      houseType.boundingBox(),
      houseLevel.boundingBox(),
      treeDano.boundingBox(),
      warCry.boundingBox(),
    ]);
    for (const box of boxes) expect(box).toBeTruthy();

    const heights = boxes.map((b) => b!.height);
    const max = Math.max(...heights);
    const min = Math.min(...heights);
    expect(max - min).toBeLessThan(2);
  });

  test('Skill Tree numeric totals are plain text and zero keystone controls exist (EN)', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await gotoAccountPage(page);

    const account = accountPanel(page, 'en');
    const treeRows = account.locator('label').filter({
      has: page.locator('[data-account-tree-value]'),
    });

    // MSC-02 — the Skill Tree subsection is readouts only.
    await expect(account.locator('[data-account-tree-value]')).toHaveCount(6);
    await expect(treeRows).toHaveCount(6);
    await expect(treeRows.locator('[data-num]')).toHaveCount(0);
    await expect(treeRows.locator('input')).toHaveCount(0);
    await expect(
      treeRows.locator('input, button, [role=switch], [role=checkbox], [data-switch]'),
    ).toHaveCount(0);

    // MSC-01 — zero keystone controls anywhere in the rendered Account panel.
    await expect(account.locator('[data-keystone-control]')).toHaveCount(0);
    await expect(account.getByRole('switch')).toHaveCount(0);
    await expect(account.getByRole('checkbox')).toHaveCount(0);
    await expect(account.locator('[data-switch]')).toHaveCount(0);
    for (const name of [/Abisso/i, /Glass Cannon/i, /Tempo Dobrado/i]) {
      await expect(account.getByLabel(name)).toHaveCount(0);
    }
  });

  test('PT: Skill Tree numeric totals are plain text and zero keystone controls exist', async ({
    page,
  }) => {
    await seedLocalStorage(page, importedRoster);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await gotoAccountPage(page);

    const account = accountPanel(page, 'pt');
    const treeRows = account.locator('label').filter({
      has: page.locator('[data-account-tree-value]'),
    });

    // MSC-02 — the Skill Tree subsection is readouts only.
    await expect(account.locator('[data-account-tree-value]')).toHaveCount(6);
    await expect(treeRows).toHaveCount(6);
    await expect(treeRows.locator('[data-num]')).toHaveCount(0);
    await expect(treeRows.locator('input')).toHaveCount(0);
    await expect(
      treeRows.locator('input, button, [role=switch], [role=checkbox], [data-switch]'),
    ).toHaveCount(0);

    // MSC-01 — zero keystone controls anywhere in the rendered Account panel, PT seed (the
    // web planner's default language — the more visible failure if a control survives).
    await expect(account.locator('[data-keystone-control]')).toHaveCount(0);
    await expect(account.getByRole('switch')).toHaveCount(0);
    await expect(account.getByRole('checkbox')).toHaveCount(0);
    await expect(account.locator('[data-switch]')).toHaveCount(0);
    for (const name of [/Abisso/i, /Glass Cannon/i, /Tempo Dobrado/i]) {
      await expect(account.getByLabel(name)).toHaveCount(0);
    }
  });

  test('From your save panel renders the account-wide values the tab never showed', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await gotoAccountPage(page);

    const save = page.locator('section').filter({
      has: page.getByRole('heading', { name: /^From your save$/i, level: 2 }),
    });
    await expect(save).toBeVisible();

    // The two slot counts are different game concepts and must both be readable here.
    const fieldSlots = save.locator('div').filter({ hasText: /^Field slots/ }).first();
    const casaSlots = save.locator('div').filter({ hasText: /^House recovery slots/ }).first();
    await expect(fieldSlots).toBeVisible();
    await expect(casaSlots).toBeVisible();

    await expect(save.getByText(/^Furthest phase reached$/i)).toBeVisible();
    await expect(save.getByText(/^House cycle in save$/i)).toBeVisible();
  });

  test('PT: Conta panel has no Da conta chip; no obrigatório at tree ×1', async ({ page }) => {
    await seedLocalStorage(page, treeDefaultState('pt'));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await gotoAccountPage(page);

    const account = accountPanel(page, 'pt');
    await expect(account.getByRole('heading', { name: /^Conta$/i, level: 2 })).toBeVisible();
    await expect(account.getByText(/^Da conta$/i)).toHaveCount(0);
    await expect(account.getByText(/^obrigatório$/i)).toHaveCount(0);
  });
});
