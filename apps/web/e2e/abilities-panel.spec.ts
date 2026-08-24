import { test, expect } from '@playwright/test';
import { importedRoster, seedLocalStorage, selectSavedHero, type SeededState } from './fixtures/seed';

function heroWithAbilities(abilities: Record<string, number>): SeededState {
  return {
    ...importedRoster,
    heroes: importedRoster.heroes.map((h) =>
      h.id === 'seed-cora' ? { ...h, abilities } : h,
    ),
  };
}

async function openAbilitiesTab(page: import('@playwright/test').Page, lang: 'pt' | 'en' = 'pt') {
  await page.getByRole('tab', { name: lang === 'en' ? /^abilities$/i : /^habilidades$/i }).click();
}

test.describe('abilities panel (ABX residual)', () => {
  test('picker always visible on Hero tab; tip and grid shown', async ({ page }) => {
    await seedLocalStorage(page, importedRoster);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openAbilitiesTab(page);

    await expect(page.getByText(/Olho Clínico, Ponta de Diamante e Golpe Brutal alteram/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /\+1$/ }).first()).toBeVisible();
  });

  test('empty ability pool shows tip but no ability cards', async ({ page }) => {
    await seedLocalStorage(page, heroWithAbilities({}));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openAbilitiesTab(page);

    await expect(page.getByText(/Olho Clínico, Ponta de Diamante e Golpe Brutal alteram/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /\+1$/ })).toHaveCount(0);
  });

  test('hero omits duplicate quota; reset uses default button chrome', async ({ page }) => {
    await seedLocalStorage(page, importedRoster);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openAbilitiesTab(page);

    const heroPanel = page.locator('[data-slot="tabs-panel"][data-state="active"]');
    await expect(heroPanel.getByText(/\d+ habilidades · \d+ pontos/i)).toHaveCount(0);
    await expect(heroPanel.getByText(/\d+ \/ \d+ habilidades/i)).toBeVisible();
    await expect(heroPanel.getByText(/\d+ \/ \d+ pontos/i)).toBeVisible();

    const reset = heroPanel
      .getByRole('heading', { name: /^habilidades$/i })
      .locator('xpath=..')
      .getByRole('button', { name: /^Zerar$/i });
    await expect(reset).toBeVisible();
    await expect(reset).toHaveClass(/border-line/);

    await reset.click();
    await expect(page.getByText(/Olho Clínico, Ponta de Diamante e Golpe Brutal/i)).toBeVisible();
  });

  test('EN chrome for picker', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openAbilitiesTab(page, 'en');

    await expect(page.getByText(/Keen Eye, Diamond Tip and Brutal Strike/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Ability picker$/i })).toHaveCount(0);
  });

  test('granted vs spendable ability points (AC-38) — the Bram worked case: L49 -> 40 spendable, 9 dead', async ({
    page,
  }) => {
    const heroed = {
      ...importedRoster,
      lang: 'en' as const,
      heroes: importedRoster.heroes.map((h) =>
        h.id === 'seed-cora' ? { ...h, rarity: 'Incomum' as const, level: 49 } : h,
      ),
    };
    await seedLocalStorage(page, heroed);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openAbilitiesTab(page, 'en');

    const panel = page.locator('[data-slot="tabs-panel"][data-state="active"]');
    await expect(panel.getByText(/49 granted/i)).toBeVisible();
    await expect(panel.getByText(/40 spendable/i)).toBeVisible();
    await expect(panel.getByText(/9 granted but unusable/i)).toBeVisible();
  });

  test('granted-but-unusable note stays mounted but invisible when nothing is dead', async ({ page }) => {
    // Raro quota is 3 slots x 20 = 60 spendable; level 20 grants far less than that -> dead=0.
    const heroed = {
      ...importedRoster,
      lang: 'en' as const,
      heroes: importedRoster.heroes.map((h) =>
        h.id === 'seed-cora' ? { ...h, rarity: 'Raro' as const, level: 20 } : h,
      ),
    };
    await seedLocalStorage(page, heroed);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openAbilitiesTab(page, 'en');

    const panel = page.locator('[data-slot="tabs-panel"][data-state="active"]');
    // /\d+ granted but unusable/ (not the bare phrase) distinguishes this note from the
    // abilitiesTip paragraph, which also contains the same words in prose.
    const deadNote = panel.getByText(/\d+ granted but unusable/i);
    await expect(deadNote).toHaveCount(1);
    await expect(deadNote).not.toBeVisible();
    await expect(panel.getByText(/20 granted/i)).toBeVisible();
    await expect(panel.getByText(/20 spendable/i)).toBeVisible();
  });

  test('stepping a sheet crit-chance ability preserves the hero\'s own roll, not the rarity midpoint (DEC-04, BSP-31a)', async ({
    page,
  }) => {
    // Bellatrix's actual birth crit-chance roll (9.51) vs Raro's rarity midpoint (7) — the
    // same non-midpoint case gear.test.ts / naked-ability-rescale.test.ts discriminate.
    const naked = {
      attack: 200,
      energy: 300,
      speed: 50,
      critChance: 9.51,
      critDmg: 70,
      penetration: 5,
      cdr: 5,
      luck: 0,
    };
    const heroed = {
      ...importedRoster,
      lang: 'en' as const,
      heroes: importedRoster.heroes.map((h) =>
        h.id === 'seed-cora'
          ? {
              ...h,
              rarity: 'Raro' as const,
              stars: 0,
              naked,
              birth: naked,
              gearedOverride: naked,
              abilities: { olho_clinico: 0 },
            }
          : h,
      ),
    };
    await seedLocalStorage(page, heroed);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openAbilitiesTab(page, 'en');

    await page.getByRole('button', { name: /^Keen Eye \+1$/i }).click();

    await page.getByRole('tab', { name: /^Points$/i }).click();
    const stats = page.locator('[data-slot="tabs-panel"][data-state="active"]').locator('section').filter({
      has: page.getByRole('heading', { name: /^Stats$/i, level: 2 }),
    });
    const critRow = stats.locator('tr').filter({ hasText: /^Crit %/ });
    // RE-POINTED for the 2026-08-23 patch, which made Keen Eye a FLAT +2 crit points per rank
    // (see the `critChanceFlat` ability kind). That changes WHICH cell discriminates: a flat
    // addend is identical whether the hero's own roll or the rarity midpoint feeds it, so the
    // Δ ability cell can no longer tell the two apart on its own.
    //
    // The Stats table is birth→Total, and the discriminator is now the pair at either end of it:
    // Birth must be the hero's own roll (9.51, NOT the Raro midpoint 7.05), and Total must carry
    // that roll through (11.56, NOT the midpoint bug's ~9.06). The ability cell is still asserted
    // — as the constant it now is, so a regression that made it roll-dependent again would fail
    // here rather than pass quietly.
    await expect(critRow.locator('td').nth(1)).toHaveText('9.51');
    // The ability's own cell is now the SAME for every roll, so it is asserted as a constant
    // rather than as the discriminator it used to be.
    await expect(critRow.locator('td').nth(4)).toHaveText('+2.00');
    // The discriminator moved to Birth and Total: the midpoint bug would show 7.05 and a Total
    // near 9.06, where preserving Cora's own roll gives 9.51 and 11.56 (the extra 0.05 is her
    // skill-tree crit node, the row's other non-dash cell).
    await expect(critRow.locator('td').nth(8)).toHaveText('11.56');
    await expect(critRow).not.toContainText('7.05');
    await expect(critRow).not.toContainText('9.06');
  });

  test('imported hero identity lives in hero strip; tab is abilities-only', async ({ page }) => {
    await seedLocalStorage(page, importedRoster);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openAbilitiesTab(page);

    const heroStrip = page.getByRole('region', { name: /herói atual/i });
    // Stars render as an aria-hidden span inside the same <p>, so the node's
    // text is "Cora★★" — anchor the start only.
    await expect(heroStrip.getByText(/^Cora/)).toBeVisible();
    await expect(heroStrip.getByText(/Raro/i)).toBeVisible();

    const abilitiesPanel = page.locator('[data-slot="tabs-panel"][data-state="active"]');
    await expect(abilitiesPanel.locator('label').filter({ hasText: /^Raridade$/i })).toHaveCount(0);
    await expect(abilitiesPanel.getByRole('heading', { name: /^Seletor de habilidades$/i })).toHaveCount(0);
  });
});
