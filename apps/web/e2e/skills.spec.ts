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
  });
});
