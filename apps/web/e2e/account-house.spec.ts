import { test, expect, type Page } from '@playwright/test';
import {
  gotoAccountPage,
  importedRoster,
  seedLocalStorage,
  selectSavedHero,
} from './fixtures/seed';

function accountPanel(page: Page, lang: 'pt' | 'en' = 'pt') {
  const title = lang === 'en' ? /^Account$/i : /^Conta$/i;
  return page.locator('section').filter({ has: page.getByRole('heading', { name: title, level: 2 }) });
}

function restParts(houseIdx: number, houseLevel: number): { minutes: number; seconds: number } {
  // Mirrors `HOUSES` — the wiki's `rotacao.casas[].cycle_secs_base`/`cycle_secs_max`.
  const houses = [
    { cycleSecsLvl1: 1200, cycleSecsLvl20: 1140 },
    { cycleSecsLvl1: 1080, cycleSecsLvl20: 1020 },
    { cycleSecsLvl1: 960, cycleSecsLvl20: 900 },
    { cycleSecsLvl1: 840, cycleSecsLvl20: 780 },
    { cycleSecsLvl1: 660, cycleSecsLvl20: 600 },
  ] as const;
  const h = houses[houseIdx] ?? houses[0];
  const totalSec = Math.round(
    h.cycleSecsLvl1 + ((h.cycleSecsLvl20 - h.cycleSecsLvl1) * (houseLevel - 1)) / 19,
  );
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

test.describe('account house fields (AHK)', () => {
  test('shows House subsection above Skill Tree with live rest hint', async ({ page }) => {
    await seedLocalStorage(page, importedRoster);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await gotoAccountPage(page);

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
    await gotoAccountPage(page);

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

  test('advice column has no Context panel heading', async ({ page }) => {
    await seedLocalStorage(page, importedRoster);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await page.getByRole('tab', { name: /^pontos$/i }).click();
    const advice = page.locator('[data-slot="tabs-panel"][data-state="active"]');
    await expect(advice.getByRole('heading', { name: /^Contexto$/i })).toHaveCount(0);
    await expect(advice.getByRole('heading', { name: /^Context$/i })).toHaveCount(0);
  });

  test('EN chrome: House subsection', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await gotoAccountPage(page);

    const account = accountPanel(page, 'en');
    await expect(account.getByRole('heading', { name: /^House$/i, level: 3 })).toBeVisible();
    await expect(account.getByText(restHint('en', 2, 6))).toBeVisible();

    const houseBlock = account.locator('div').filter({
      has: page.getByRole('heading', { name: /^House$/i, level: 3 }),
    }).first();
    await expect(houseBlock.locator('[data-select]')).toContainText(HOUSE_LABELS_EN[2]);
  });
});
