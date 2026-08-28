import { test, expect } from '@playwright/test';
import { seedLocalStorage } from './fixtures/seed';

/** The guide no longer asks anyone to reset
 *  in-game before exporting, and step 2 describes the full sync including removal. */
test.describe('guide copy', () => {
  test('PT: step 1 drops the mandatory reset; step 2 drops "tick the heroes you want"', async ({
    page,
  }) => {
    await seedLocalStorage(page, { heroes: [], lang: 'pt', guideHidden: false });
    await page.goto('/');

    const guide = page.getByRole('region', { name: /guia rápido/i });
    await expect(guide).toBeVisible();

    await expect(guide.getByText(/zere os pontos/i)).toHaveCount(0);
    await expect(guide.getByText(/marque os her/i)).toHaveCount(0);

    await expect(guide.getByText(/não precisa zerar os pontos antes/i)).toBeVisible();
    await expect(guide.getByText(/se um reset realmente valer a pena, o app avisa/i)).toBeVisible();
    await expect(guide.getByText(/todo herói do seu save é sincronizado/i)).toBeVisible();
    await expect(guide.getByText(/heróis que saíram do save são removidos/i)).toBeVisible();
  });

  test('EN: step 1 drops the mandatory reset; step 2 drops "tick the heroes you want"', async ({
    page,
  }) => {
    await seedLocalStorage(page, { heroes: [], lang: 'en', guideHidden: false });
    await page.goto('/');

    const guide = page.getByRole('region', { name: /quick guide/i });
    await expect(guide).toBeVisible();

    await expect(guide.getByText(/reset each hero.s stat points in-game first/i)).toHaveCount(0);
    await expect(guide.getByText(/tick the heroes you want/i)).toHaveCount(0);

    await expect(guide.getByText(/no need to reset points first/i)).toBeVisible();
    await expect(guide.getByText(/if a reset is actually worth it, the app tells you/i)).toBeVisible();
    await expect(guide.getByText(/every hero in your save syncs/i)).toBeVisible();
    await expect(guide.getByText(/heroes no longer in the save are removed/i)).toBeVisible();
  });
});
