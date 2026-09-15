import { test, expect, type Page } from '@playwright/test';
import { importedRoster, seedLocalStorage } from './fixtures/seed';

/** importedRoster's account with a known max phase, so the board draws its table and the toolbar
 *  above it — the same seed `farm-ranking.spec.ts` drives. */
const accountWithMaxPhase = { ...importedRoster.account!, maxPhase: 42 };

const toolbar = (page: Page) => page.getByTestId('farm-optimize-toolbar');
const optimizeButton = (page: Page) => page.getByTestId('farm-optimize');
const optimizerRegion = (page: Page) => page.getByRole('region', { name: /^(Optimizer|Otimizador)$/ });

test.describe('the Farm page’s Optimize button', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/farm');
    await expect(page.getByTestId('farm-ranking-table')).toBeVisible();
  });

  test('the toolbar is the button and nothing else — no figure, no panel, no switch', async ({ page }) => {
    await expect(toolbar(page)).toBeVisible();
    await expect(optimizeButton(page)).toBeEnabled();
    expect(((await toolbar(page).textContent()) ?? '').trim()).toBe('Optimize');
    await expect(toolbar(page).getByRole('button')).toHaveCount(1);
    await expect(toolbar(page).getByRole('switch')).toHaveCount(0);
    await expect(page.getByTestId('farm-respec-panel')).toHaveCount(0);
  });

  test('a click opens the Optimizer page, and Back returns to the Farm page', async ({ page }) => {
    await optimizeButton(page).click();
    await expect(page).toHaveURL(/\/optimizer\/?$/);
    await expect(optimizerRegion(page)).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/farm\/?$/);
    await expect(optimizeButton(page)).toBeVisible();
  });

  test('Enter on the focused button opens the Optimizer page too', async ({ page }) => {
    await optimizeButton(page).focus();
    await expect(optimizeButton(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/optimizer\/?$/);
    await expect(optimizerRegion(page)).toBeVisible();
  });

  test('renders in Portuguese with no EN leakage', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'pt' });
    await page.goto('/farm');
    await expect(toolbar(page)).toHaveText(/^\s*Otimizar\s*$/);

    await optimizeButton(page).click();
    await expect(page).toHaveURL(/\/optimizer\/?$/);
    await expect(optimizerRegion(page)).toBeVisible();
  });
});
