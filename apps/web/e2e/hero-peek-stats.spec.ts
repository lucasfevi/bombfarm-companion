import { test, expect, type Page } from '@playwright/test';
import { rosterBoard, seedLocalStorage } from './fixtures/seed';

/**
 * A hero's hover card prints the same sheet as the leaderboard row and the hero panel's Total —
 * spent points included — and never the record's stored import-time sheet, which leaves them out.
 * The seed's stored sheet is a placeholder that no composition produces, so a card still reading
 * it prints a figure the row does not.
 */
function compactEn(value: number): string {
  const oneDecimal = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace(/[.,]0+$/, '');
  if (Math.abs(value) >= 1_000) return `${oneDecimal(value / 1_000)}k`;
  return Number.isInteger(value) ? String(value) : oneDecimal(value);
}

async function openCardFor(page: Page, heroId: string) {
  const portrait = page.getByTestId(`heroes-leaderboard-row-${heroId}`).locator('[data-peek="hero"]');
  await portrait.hover();
  await page.mouse.move(0, 0, { steps: 1 });
  await portrait.hover({ position: { x: 4, y: 4 } });
  const card = page.locator('[data-peek-card="hero"]');
  await expect(card).toBeVisible();
  return card;
}

test('the hero card’s Attack is the leaderboard row’s Attack', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedLocalStorage(page, { ...rosterBoard, lang: 'en' });
  await page.goto('/heroes');
  await page.getByRole('button', { name: /^Leaderboard$/i }).click();

  const rowAttack = page.getByTestId('heroes-leaderboard-row-board-ayla').getByTestId('heroes-leaderboard-stat-attack');
  await expect(rowAttack).toHaveText(/\d/);
  const attack = Number((await rowAttack.innerText()).replace(/,/g, ''));
  expect(attack).toBeGreaterThan(500);

  const card = await openCardFor(page, 'board-ayla');
  await expect(card).toContainText('Ayla');
  await expect(card.locator('div', { hasText: /^Attack/ }).locator('b').first()).toHaveText(compactEn(attack));
});
