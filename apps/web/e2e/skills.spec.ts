import { test, expect } from '@playwright/test';
import { gotoSkillsPage, importedRoster, seedLocalStorage } from './fixtures/seed';

function skillsRoster() {
  return {
    ...importedRoster,
    lang: 'en' as const,
    account: {
      ...importedRoster.account!,
      skillTree: {
        levels: { D01: 5, H01: 5 },
        refunds: {},
        gold: 50_000_000,
      },
    },
  };
}

test.describe('Skill Tree page', () => {
  test('asks for a re-import when the stored account has totals but no nodes', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/heroes');
    await gotoSkillsPage(page);

    await expect(page.getByTestId('skills-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Import a save to see your skill tree' })).toBeVisible();
    await expect(page.getByTestId('skill-tree-screen')).toHaveCount(0);
  });

  test('draws the tree and the next-to-buy ranking from the imported levels', async ({ page }) => {
    await seedLocalStorage(page, skillsRoster());
    await page.goto('/heroes');
    await gotoSkillsPage(page);

    const screen = page.getByTestId('skill-tree-screen');
    await expect(screen).toBeVisible();
    await expect(page.getByTestId('skill-tree-canvas')).toBeVisible();
    await expect(page.getByTestId('skill-tree-next-to-buy')).toBeVisible();
    await expect(page.getByTestId('skill-tree-wallet')).toContainText('50,000,000');
    await expect(page.getByRole('link', { name: /^Skill Tree$/i })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('button', { name: 'Gold/h' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gate' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PVP' })).toHaveCount(0);

    const row = page.locator('[data-testid^="skill-tree-recommendation-"]:not([data-testid*="detail"])').first();
    await expect(row).toBeVisible();
    await row.click();
    await expect(row).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid^="skill-tree-recommendation-detail-"]')).toBeVisible();
  });

  test('the gate objective prices on a gate picked from the gate-only phase list', async ({ page }) => {
    await seedLocalStorage(page, skillsRoster());
    await page.goto('/heroes');
    await gotoSkillsPage(page);

    await page.getByRole('button', { name: 'Gate' }).click();
    await expect(page.getByTestId('skill-tree-gate-phase')).toBeVisible();
    await expect(page.locator('[data-testid^="skill-tree-recommendation-"]:not([data-testid*="detail"])').first()).toBeVisible();
  });
});
