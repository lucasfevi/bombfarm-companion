import { test, expect, type Page } from '@playwright/test';
import {
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
    await page.getByRole('tab', { name: /^account$|^conta$/i }).click();

    const account = accountPanel(page, 'en');
    await expect(account.getByRole('heading', { name: /^Account$/i, level: 2 })).toBeVisible();
    await expect(account.getByText(/^Account-wide$/i)).toHaveCount(0);
    await expect(account.getByText(/^Da conta$/i)).toHaveCount(0);
  });

  test('tree ×1 does not show required chrome or Account tab warning', async ({ page }) => {
    await seedLocalStorage(page, treeDefaultState('en'));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    await expect(page.getByRole('tab', { name: /^Account$/i }).locator('[data-tab-badge]')).toHaveCount(
      0,
    );

    await page.getByRole('tab', { name: /^account$|^conta$/i }).click();
    const account = accountPanel(page, 'en');
    await expect(account.getByText(/^required$/i)).toHaveCount(0);
    await expect(page.locator('[data-tab-status-banner]')).toHaveCount(0);
  });

  test('stack rows share height across House / Skill Tree / Team Buffs', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await page.getByRole('tab', { name: /^account$|^conta$/i }).click();

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

  test('Skill Tree numeric totals are plain text (no inputs)', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await page.getByRole('tab', { name: /^account$|^conta$/i }).click();

    const account = accountPanel(page, 'en');
    const treeRows = account.locator('label').filter({
      has: page.locator('[data-account-tree-value]'),
    });

    await expect(account.locator('[data-account-tree-value]')).toHaveCount(6);
    await expect(treeRows).toHaveCount(6);
    await expect(treeRows.locator('[data-num]')).toHaveCount(0);
    await expect(treeRows.locator('input')).toHaveCount(0);
    await expect(account.locator('[data-keystone-control]')).toHaveCount(2);
  });

  test('PT: Conta panel has no Da conta chip; no obrigatório at tree ×1', async ({ page }) => {
    await seedLocalStorage(page, treeDefaultState('pt'));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await page.getByRole('tab', { name: /^account$|^conta$/i }).click();

    const account = accountPanel(page, 'pt');
    await expect(account.getByRole('heading', { name: /^Conta$/i, level: 2 })).toBeVisible();
    await expect(account.getByText(/^Da conta$/i)).toHaveCount(0);
    await expect(account.getByText(/^obrigatório$/i)).toHaveCount(0);
  });
});
