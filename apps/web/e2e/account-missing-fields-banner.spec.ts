import { test, expect } from '@playwright/test';
import { importedRoster, seedLocalStorage, type SeededState } from './fixtures/seed';

/**
 * Farm is checked alongside the planner because that is where the harm lands: a missing furthest
 * phase lets the Respec Advisor recommend spending real gold toward an unreachable phase.
 */
function seedWith(missingRequiredFields?: string[]): SeededState {
  const account = { ...importedRoster.account!, maxPhase: 122 } as SeededState['account'];
  return {
    ...importedRoster,
    lang: 'en',
    account: missingRequiredFields
      ? ({ ...account, missingRequiredFields } as SeededState['account'])
      : account,
  };
}

test.describe('missing required save fields', () => {
  test('names the fields under the header, on the planner and on Farm alike', async ({ page }) => {
    await seedLocalStorage(page, seedWith(['houseLevel', 'maxPhase']));
    await page.goto('/');

    const banner = page.getByTestId('account-missing-fields-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('House level');
    await expect(banner).toContainText('Furthest phase');
    await expect(banner).not.toContainText('Current phase');

    const headerBox = await page.locator('header').boundingBox();
    const bannerBox = await banner.boundingBox();
    expect(bannerBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);

    await page
      .getByRole('navigation', { name: 'Main sections' })
      .getByRole('link', { name: /^Farm$/i })
      .click();
    await expect(page).toHaveURL(/\/farm$/);
    await expect(page.getByTestId('account-missing-fields-banner')).toBeVisible();
  });

  test('stays silent for an account stored before the rule existed', async ({ page }) => {
    await seedLocalStorage(page, seedWith());
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();

    await expect(page.getByTestId('account-missing-fields-banner')).toHaveCount(0);
  });

  test('stays silent after an import that carried every required field', async ({ page }) => {
    await seedLocalStorage(page, seedWith([]));
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();

    await expect(page.getByTestId('account-missing-fields-banner')).toHaveCount(0);
  });
});
