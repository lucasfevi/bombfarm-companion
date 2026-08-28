import { test, expect, type Page } from '@playwright/test';
import { REFERRAL_CODE } from '../src/shared/referral';

/**
 * These specs deliberately do NOT call `seedLocalStorage`: it re-writes its keys through
 * `addInitScript` on every navigation, which would restore the not-yet-dismissed flag on the
 * reload the first test is built to check. A fresh context is the real first-run state anyway.
 */
async function openFirstRun(page: Page) {
  await page.addInitScript(() => localStorage.setItem('bf_lang', 'en'));
  await page.goto('/');
}

test.describe('first-run referral notice', () => {
  test('shows below the topbar, and stays dismissed across a reload', async ({ page }) => {
    await openFirstRun(page);

    const notice = page.getByTestId('referral-notice');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText(REFERRAL_CODE);

    const headerBox = await page.locator('header').boundingBox();
    const noticeBox = await notice.boundingBox();
    expect(headerBox).toBeTruthy();
    expect(noticeBox).toBeTruthy();
    expect(noticeBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);

    // Half the app's own width, centered — narrow enough to read as a notice rather than
    // a second header bar.
    const maxWidth = await page.evaluate(() =>
      Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--maxw')),
    );
    // Centered inside the body's box, not the viewport's: a scrollbar makes the two differ.
    const bodyBox = await page.locator('body').boundingBox();
    expect(noticeBox!.width).toBeCloseTo(maxWidth / 2, -1);
    expect(
      Math.abs(noticeBox!.x + noticeBox!.width / 2 - (bodyBox!.x + bodyBox!.width / 2)),
    ).toBeLessThanOrEqual(1);

    // Both controls sit on one row below the copy, not beside it.
    const copyBox = await page.getByTestId('referral-notice-copy').boundingBox();
    const dismissBox = await page.getByRole('button', { name: /^got it$/i }).boundingBox();
    const middleY = (box: { y: number; height: number }) => box.y + box.height / 2;
    expect(Math.abs(middleY(copyBox!) - middleY(dismissBox!))).toBeLessThanOrEqual(1);
    expect(copyBox!.y).toBeGreaterThan(noticeBox!.y + noticeBox!.height / 2);

    await page.getByRole('button', { name: /^got it$/i }).click();
    await expect(notice).toBeHidden();

    await page.reload();
    await expect(page.locator('header')).toBeVisible();
    await expect(notice).toBeHidden();
  });

  test('is gone from a second route once dismissed, and the topbar chip remains', async ({ page }) => {
    await openFirstRun(page);
    await page.getByRole('button', { name: /^got it$/i }).click();

    await page.getByRole('navigation', { name: 'Main sections' }).getByRole('link', { name: /^Farm$/i }).click();
    await expect(page).toHaveURL(/\/farm$/);
    await expect(page.getByTestId('referral-notice')).toBeHidden();
    await expect(page.getByTestId('referral-topbar')).toBeVisible();
  });

  test('copying the code puts it on the clipboard, confirms, and closes the notice', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openFirstRun(page);

    await page.getByTestId('referral-notice-copy').click();

    await expect(page.getByText(/referral code copied/i)).toBeVisible();
    await expect(page.getByTestId('referral-notice')).toBeHidden();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(REFERRAL_CODE);

    await page.reload();
    await expect(page.locator('header')).toBeVisible();
    await expect(page.getByTestId('referral-notice')).toBeHidden();
  });
});
