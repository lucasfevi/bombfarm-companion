import { test, expect, type Locator, type Page } from '@playwright/test';
import { importedRoster, seedLocalStorage, selectSavedHero, type SeededState } from './fixtures/seed';

async function openPointsTab(page: Page, lang: 'pt' | 'en' = 'pt') {
  await page.getByRole('tab', { name: lang === 'en' ? /^points$/i : /^pontos$/i }).click();
}

/**
 * The panel's mode select is `@bombfarm/ui`'s `Select` — a Base UI listbox (trigger + popup),
 * not a native `<select>`. `getByRole('combobox', …)` finds the trigger; reading/choosing a
 * value means reading the trigger's own text and opening the popup for `role="option"`
 * elements, the same interaction `team-plan-scope.spec.ts`'s `pickScope` helper already uses
 * for this repo's other Base UI selects.
 */
function nextPointCombobox(page: Page, lang: 'pt' | 'en' = 'pt') {
  return page.getByRole('combobox', { name: lang === 'en' ? /^next point$/i : /^próximo ponto$/i });
}

async function pickMode(combobox: Locator, page: Page, optionName: RegExp) {
  await combobox.click();
  await page.getByRole('option', { name: optionName }).click();
}

/** A seeded state with no `account` at all — the fresh-profile shape `hydrateAccount` falls
 *  back to `DEFAULT_ACCOUNT()` for. */
function noAccountSeed(): SeededState {
  return {
    ...importedRoster,
    account: undefined,
  };
}

/** Seeds the roster via the normal typed path, then overwrites `bf-hp-account-v1` with a raw
 *  JSON string carrying an arbitrary rankMode value — a retired or junk value cannot be
 *  expressed through `SeededState`'s typed `RankMode` field, the same reason the domain/web
 *  unit suites reach for a raw JSON string here (storage-rank-mode-compat.test.ts). This is
 *  what a hand-edited or pre-migration localStorage record actually looks like on disk. */
async function seedWithRawRankMode(page: Page, rawRankMode: string): Promise<void> {
  await seedLocalStorage(page, importedRoster);
  const account = importedRoster.account!;
  const rawAccount = {
    ...account,
    context: { ...account.context, rankMode: rawRankMode },
  };
  await page.addInitScript((json) => {
    localStorage.setItem('bf-hp-account-v1', json);
  }, JSON.stringify(rawAccount));
}

test.describe('next-point ranking mode — default, options, persistence', () => {
  test('a fresh profile with no stored account lands on Farm mode', async ({ page }) => {
    await seedLocalStorage(page, noAccountSeed());
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    await expect(nextPointCombobox(page)).toHaveText(/^Farm$/i);
  });

  test('the select offers exactly two options, and neither is the retired one-shot mode', async ({ page }) => {
    await seedLocalStorage(page, importedRoster);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    await nextPointCombobox(page).click();
    const options = page.getByRole('option');
    await expect(options).toHaveCount(2);
    const names = await options.allTextContents();
    expect(names.map((name) => name.trim()).sort()).toEqual(['DPS', 'Farm']);
    await expect(page.getByRole('option', { name: /oneshot/i })).toHaveCount(0);
    await page.keyboard.press('Escape');
  });

  test('switching to DPS persists across a reload; switching back to Farm persists too', async ({ page }) => {
    // NOT page.reload(): seedLocalStorage's addInitScript deterministically re-applies its
    // payload on EVERY navigation in this page, including a literal reload — that would re-run
    // the ORIGINAL seed and erase the switch just made, not exercise persistence. Reading the
    // actual write back and re-seeding with it (the farm-ranking.spec.ts precedent) is what
    // proves hydration honours a stored value on load, rather than proving nothing.
    await seedLocalStorage(page, noAccountSeed());
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    const combobox = nextPointCombobox(page);
    await expect(combobox).toHaveText(/^Farm$/i);

    await pickMode(combobox, page, /^DPS$/i);
    await expect(combobox).toHaveText(/^DPS$/i);
    // The autosave debounce (AUTOSAVE_MS) must settle before reading the write back.
    await page.waitForTimeout(900);
    const afterDps = await page.evaluate(() => localStorage.getItem('bf-hp-account-v1'));
    expect(afterDps).not.toBeNull();
    expect(JSON.parse(afterDps!).context.rankMode).toBe('dps');

    await seedLocalStorage(page, { ...importedRoster, account: JSON.parse(afterDps!) });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);
    await expect(nextPointCombobox(page)).toHaveText(/^DPS$/i);

    await pickMode(nextPointCombobox(page), page, /^Farm$/i);
    await page.waitForTimeout(900);
    const afterFarm = await page.evaluate(() => localStorage.getItem('bf-hp-account-v1'));
    expect(JSON.parse(afterFarm!).context.rankMode).toBe('farm');

    await seedLocalStorage(page, { ...importedRoster, account: JSON.parse(afterFarm!) });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);
    await expect(nextPointCombobox(page)).toHaveText(/^Farm$/i);
  });

  test('a profile seeded with the retired "oneshot" rankMode loads on Farm', async ({ page }) => {
    await seedWithRawRankMode(page, 'oneshot');
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    await expect(nextPointCombobox(page)).toHaveText(/^Farm$/i);
  });

  test('a profile seeded with "dps" loads on DPS — a deliberate past choice is respected', async ({ page }) => {
    await seedWithRawRankMode(page, 'dps');
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page);

    await expect(nextPointCombobox(page)).toHaveText(/^DPS$/i);
  });
});
