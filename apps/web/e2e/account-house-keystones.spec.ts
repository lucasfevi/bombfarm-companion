import { test, expect, type Page } from '@playwright/test';
import { importedRoster, seedLocalStorage, selectSavedHero } from './fixtures/seed';

function accountPanel(page: Page, lang: 'pt' | 'en' = 'pt') {
  const title = lang === 'en' ? /^Account$/i : /^Conta$/i;
  return page.locator('section').filter({ has: page.getByRole('heading', { name: title, level: 2 }) });
}

function restParts(houseIdx: number, houseLevel: number): { minutes: number; seconds: number } {
  const houses = [
    { minutesLvl1: 19, minutesLvl20: 17 },
    { minutesLvl1: 16, minutesLvl20: 14 },
    { minutesLvl1: 13, minutesLvl20: 11 },
    { minutesLvl1: 10, minutesLvl20: 8 },
    { minutesLvl1: 7, minutesLvl20: 5 },
  ] as const;
  const h = houses[houseIdx] ?? houses[0];
  const mins = h.minutesLvl1 + ((h.minutesLvl20 - h.minutesLvl1) * (houseLevel - 1)) / 19;
  const totalSec = Math.round(mins * 60);
  return { minutes: Math.floor(totalSec / 60), seconds: totalSec % 60 };
}

function restHint(lang: 'pt' | 'en', houseIdx: number, houseLevel: number): RegExp {
  const { minutes, seconds } = restParts(houseIdx, houseLevel);
  const label = lang === 'en' ? 'Rest' : 'Descanso';
  return new RegExp(`${label} ${minutes} min ${seconds} s`, 'i');
}

const HOUSE_LABELS_PT = [
  'Casa I (Incomum)',
  'Casa II (Raro)',
  'Casa III (Épico)',
  'Casa IV (Lendária)',
  'Casa V (Mítico)',
] as const;

const HOUSE_LABELS_EN = [
  'House I (Uncommon)',
  'House II (Rare)',
  'House III (Epic)',
  'House IV (Legendary)',
  'House V (Mythic)',
] as const;

test.describe('account house fields and keystone toggles (AHK)', () => {
  test('shows House subsection above Skill Tree with live rest hint', async ({ page }) => {
    await seedLocalStorage(page, importedRoster);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await page.getByRole('tab', { name: /^account$|^conta$/i }).click();

    const account = accountPanel(page);
    const houseHeading = account.getByRole('heading', { name: /^Casa$/i, level: 3 });
    const treeHeading = account.getByRole('heading', { name: /Árvore de habilidades/i, level: 3 });

    await expect(houseHeading).toBeVisible();
    await expect(treeHeading).toBeVisible();
    expect((await houseHeading.boundingBox())!.y).toBeLessThan((await treeHeading.boundingBox())!.y);

    await expect(account.getByText(restHint('pt', 2, 6))).toBeVisible();

    const levelRow = account.locator('label').filter({ hasText: /Nível da casa/i });
    for (let i = 0; i < 6; i++) {
      await levelRow.getByRole('button', { name: /Decrement/i }).click();
    }
    await expect(account.getByText(restHint('pt', 2, 0))).toBeVisible();
  });

  test('House select shows full house labels; level Num matches Select width', async ({ page }) => {
    await seedLocalStorage(page, importedRoster);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await page.getByRole('tab', { name: /^account$|^conta$/i }).click();

    const account = accountPanel(page);
    const houseBlock = account.locator('div').filter({
      has: page.getByRole('heading', { name: /^Casa$/i, level: 3 }),
    }).first();
    const select = houseBlock.locator('[data-select]');
    await expect(select).toContainText(HOUSE_LABELS_PT[2]);

    const longest = HOUSE_LABELS_PT.reduce((a, b) => (a.length >= b.length ? a : b));
    await select.click();
    await page.getByRole('option', { name: longest }).click();
    await expect(select).toContainText(longest);

    const selectBox = await select.boundingBox();
    expect(selectBox).toBeTruthy();
    const overflow = await select.evaluate((el) => {
      const value = el.querySelector('[class*="truncate"], [class*="flex-1"]') ?? el;
      return {
        clientWidth: (value as HTMLElement).clientWidth,
        scrollWidth: (value as HTMLElement).scrollWidth,
      };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

    const levelRow = houseBlock.locator('label').filter({ hasText: /Nível da casa/i });
    const num = levelRow.locator('[data-num]');
    const numBox = await num.boundingBox();
    expect(numBox).toBeTruthy();
    expect(Math.abs(selectBox!.width - numBox!.width)).toBeLessThan(2);
  });

  test('keystones use Switch with On/Off status; no visible checkboxes', async ({ page }) => {
    await seedLocalStorage(page, importedRoster);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await page.getByRole('tab', { name: /^account$|^conta$/i }).click();

    const account = accountPanel(page);
    await expect(account.getByRole('checkbox')).toHaveCount(0);
    await expect(account.locator('[data-switch]')).toHaveCount(3);

    const glass = account.getByRole('switch', { name: /Glass Cannon/i });
    await glass.scrollIntoViewIfNeeded();
    await expect(glass).toHaveAttribute('aria-checked', 'false');
    await expect(glass.locator('xpath=ancestor::label[1]//div[@data-keystone-control]')).toContainText(
      'Não',
    );
    await glass.click();
    await expect(glass).toHaveAttribute('aria-checked', 'true');
    await expect(glass.locator('xpath=ancestor::label[1]//div[@data-keystone-control]')).toContainText(
      'Sim',
    );

    const tempo = account.getByRole('switch', { name: /Tempo Dobrado/i });
    await tempo.scrollIntoViewIfNeeded();
    await expect(tempo).toHaveAttribute('aria-checked', 'false');
    await tempo.click();
    await expect(tempo).toHaveAttribute('aria-checked', 'true');
  });

  test('advice column has no Context panel heading', async ({ page }) => {
    await seedLocalStorage(page, importedRoster);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await page.getByRole('tab', { name: /^account$|^conta$/i }).click();

    await page.getByRole('tab', { name: /^pontos$/i }).click();
    const advice = page.locator('[data-slot="tabs-panel"][data-state="active"]');
    await expect(advice.getByRole('heading', { name: /^Contexto$/i })).toHaveCount(0);
    await expect(advice.getByRole('heading', { name: /^Context$/i })).toHaveCount(0);
  });

  test('EN chrome: House subsection and keystone Off labels', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await page.getByRole('tab', { name: /^account$|^conta$/i }).click();

    const account = accountPanel(page, 'en');
    await expect(account.getByRole('heading', { name: /^House$/i, level: 3 })).toBeVisible();
    await expect(account.getByText(restHint('en', 2, 6))).toBeVisible();

    const glass = account.getByRole('switch', { name: /Glass Cannon/i });
    await glass.scrollIntoViewIfNeeded();
    await expect(glass).toHaveAttribute('aria-checked', 'false');
    await expect(glass.locator('xpath=ancestor::label[1]//div[@data-keystone-control]')).toContainText(
      'Off',
    );

    const houseBlock = account.locator('div').filter({
      has: page.getByRole('heading', { name: /^House$/i, level: 3 }),
    }).first();
    await expect(houseBlock.locator('[data-select]')).toContainText(HOUSE_LABELS_EN[2]);
  });
});
