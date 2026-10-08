import { test, expect, type Page } from '@playwright/test';
import { importedRoster, seedLocalStorage } from './fixtures/seed';

/** importedRoster's account with a known max phase, so the board draws its table and the toolbar
 *  above it — the same seed `farm-ranking.spec.ts` drives. */
const accountWithMaxPhase = { ...importedRoster.account!, maxPhase: 42 };

const optimizeButton = (page: Page) => page.getByTestId('farm-optimize');
const returnBonus = (page: Page) => page.getByTestId('farm-return-bonus');
const optimizerRegion = (page: Page) => page.getByRole('region', { name: /^(Optimizer|Otimizador)$/ });

test.describe('the Farm page’s Optimize button', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/farm');
    await expect(page.getByTestId('farm-ranking-table')).toBeVisible();
  });

  test("the button reads Optimize and sits on the filter row, on the return bonus's line and to its right", async ({ page }) => {
    await expect(optimizeButton(page)).toBeEnabled();
    await expect(optimizeButton(page)).toHaveText('Optimize');
    await expect(page.getByTestId('farm-respec-panel')).toHaveCount(0);

    const [button, field] = await Promise.all([
      optimizeButton(page).boundingBox(),
      returnBonus(page).boundingBox(),
    ]);
    if (!button || !field) throw new Error('button or return-bonus field not laid out');
    expect(button.x).toBeGreaterThan(field.x + field.width);
    expect(Math.abs(button.y + button.height - (field.y + field.height))).toBeLessThanOrEqual(1);
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
    await expect(optimizeButton(page)).toHaveText('Otimizar');

    await optimizeButton(page).click();
    await expect(page).toHaveURL(/\/optimizer\/?$/);
    await expect(optimizerRegion(page)).toBeVisible();
  });
});
