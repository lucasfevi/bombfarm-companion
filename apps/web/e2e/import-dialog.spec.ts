import path from 'node:path';
import { test, expect } from '@playwright/test';
import { importedRoster, seedLocalStorage } from './fixtures/seed';

const sampleSave = path.join(process.cwd(), 'e2e/fixtures/sample-save.json');

async function openImportDialog(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /importar seu save/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/**
 * `AD-BSP-26`/`BSP-49`/`AC-31` — the dialog reviews a full roster sync; it no longer curates
 * a selection. `BSP-48`/`AC-33`/`DEC-08` — confirming removes any existing hero absent from
 * the save's own sourceId set, in the same write.
 */
test.describe('import dialog reviews, does not curate (BSPW6-07)', () => {
  test.skip('has no selection checkboxes; status switches are read-only (AC-31)', async ({ page }) => {
    await page.goto('/');
    await openImportDialog(page);
    await page.locator('input[type="file"]').setInputFiles(sampleSave);
    await expect(page.getByRole('dialog').getByText('Cora')).toBeVisible();

    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('input[type="checkbox"]:not([disabled])')).toHaveCount(0);
    await expect(dialog.getByRole('checkbox', { disabled: false })).toHaveCount(0);
    await expect(dialog.locator('input[type="checkbox"][disabled]')).toHaveCount(3);
  });

  test('confirm is enabled with no selection action required (AC-31)', async ({ page }) => {
    await page.goto('/');
    await openImportDialog(page);
    await page.locator('input[type="file"]').setInputFiles(sampleSave);

    const confirm = page.getByRole('button', { name: /importar \d+ herói/i });
    await expect(confirm).toBeVisible();
    await expect(confirm).toBeEnabled();
    // 3 candidates in sample-save.json (Cora, Lorne, Brenna) -> the {count} is the candidate
    // count, not a selected count.
    await expect(confirm).toHaveText(/importar 3 herói/i);
  });

  test.skip('importing a save that omits a previously-imported hero removes exactly that hero (BSP-48, AC-33, DEC-08)', async ({
    page,
  }) => {
    // seed-orphan's sourceId (9999) is absent from sample-save.json's three heroes
    // (1001/1002/1004) -- confirming the sync should remove it.
    const seeded = {
      ...importedRoster,
      heroes: [
        ...importedRoster.heroes,
        {
          ...importedRoster.heroes[0],
          id: 'seed-orphan',
          name: 'Orphan',
          sourceId: '9999',
        },
      ],
    };
    await seedLocalStorage(page, seeded);
    await page.goto('/');

    const heroStrip = page.getByRole('region', { name: /herói atual/i });
    await heroStrip.getByRole('button', { name: /trocar herói/i }).click();
    const picker = page.getByRole('dialog', { name: /trocar herói/i });
    await expect(picker.getByText('Orphan')).toBeVisible();
    await page.keyboard.press('Escape');

    // The roster is non-empty here — open via the shell header's own Import button, not the
    // empty-workspace CTA `openImportDialog` uses.
    await page.getByRole('button', { name: /^Importar$/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(sampleSave);
    await expect(page.getByRole('dialog').getByText('Cora')).toBeVisible();
    await page.getByRole('button', { name: /importar \d+ herói/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await heroStrip.getByRole('button', { name: /trocar herói/i }).click();
    const pickerAfter = page.getByRole('dialog', { name: /trocar herói/i });
    await expect(pickerAfter.getByText('Cora')).toBeVisible();
    await expect(pickerAfter.getByText('Orphan')).toHaveCount(0);
  });

  /**
   * NARROWED (2026-08-25) from a created/updated/removed assertion. That breakdown was
   * bookkeeping from when an import was a merge the player curated — the save is the source of
   * truth now, so the split between created and updated is not a decision they make. What is left
   * is the part they cannot undo, and it must appear ONLY when something is actually leaving,
   * which is what the second case pins.
   */
  test('a hero leaving the roster is called out; nothing else is (AC-34)', async ({ page }) => {
    // The orphan (9999) is absent from sample-save.json, so it is the one being removed.
    const seeded = {
      ...importedRoster,
      heroes: [
        importedRoster.heroes[0],
        { ...importedRoster.heroes[0], id: 'seed-orphan', name: 'Orphan', sourceId: '9999' },
      ],
    };
    await seedLocalStorage(page, seeded);
    await page.goto('/');
    await page.getByRole('button', { name: /^Importar$/i }).click();
    await page.locator('input[type="file"]').setInputFiles(sampleSave);
    await expect(page.getByRole('dialog').getByText('Cora').first()).toBeVisible();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/não estão nesse save não existem mais no jogo/i)).toBeVisible();
    await expect(dialog.getByText(/criados \d/i)).toHaveCount(0);
    await expect(dialog.getByText(/atualizados \d/i)).toHaveCount(0);
  });

  test('no removal, no note — the warning is not permanent chrome', async ({ page }) => {
    // Seeded roster is exactly sample-save.json's own heroes, so nothing leaves.
    await seedLocalStorage(page, importedRoster);
    await page.goto('/');
    await page.getByRole('button', { name: /^Importar$/i }).click();
    await page.locator('input[type="file"]').setInputFiles(sampleSave);
    await expect(page.getByRole('dialog').getByText('Cora').first()).toBeVisible();

    await expect(
      page.getByRole('dialog').getByText(/não estão nesse save não existem mais no jogo/i),
    ).toHaveCount(0);
  });

  test('a rejected save shows the rejection reason, not "no heroes found" (BSP-06, AC-36)', async ({
    page,
  }) => {
    await page.goto('/');
    await openImportDialog(page);
    await page.locator('input[type="file"]').setInputFiles({
      name: 'no-birth-stats.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          heroes: [{ name: 'SemNascimento', id: '1' }],
          // MP5 F4 (MSG-11..13): the post-update key gate runs before missingBirthStats, so this
          // fixture carries the three post-patch keys it needs to clear that gate — the point of
          // this test is the birth-stats rejection specifically, not the shape rejection.
          skills: { refunds: {}, totals: { vagas_campo: 0, bag_tabs_bonus: 0 } },
        }),
      ),
    });

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/está sem os stats de nascimento/i)).toBeVisible();
    await expect(dialog.getByText('SemNascimento')).toBeVisible();
    await expect(dialog.getByText(/nenhum herói encontrado/i)).toHaveCount(0);
  });
});

/**
 * A hero the planner cannot rebuild used to be dimmed and nothing else, which reads as a
 * rendering glitch rather than an explanation — the player cannot act on it and cannot tell
 * whether their account is damaged. The dialog now names which heroes, why, and what to do.
 *
 * The save is built inline rather than committed: the only real captures that exhibit this are
 * pre-2026-08-18 and are on their way out, so a committed one would take the test with it.
 * `Impossivel`'s `stats.dmg` is inflated to 100,000, which no allocation its level-5 budget can
 * reach; `Normal` is left alone and must still import.
 */
test.describe('a hero the planner cannot rebuild explains itself', () => {
  const birth = {
    dmg: 100,
    energia: 150,
    speed: 45,
    crit_chance: 0.05,
    crit_dmg: 1.5,
    penetration: 0.5,
    cooldown_reduction: 0.01,
    luck: 0.02,
  };

  const mixedSave = () =>
    Buffer.from(
      JSON.stringify({
        export_version: 1,
        generated_at: '2026-08-25T00:00:00Z',
        heroes: [
          {
            id: '7001',
            name: 'Normal',
            level: 5,
            rarity: 1,
            stars: 0,
            battle_allowed: true,
            abilities: [],
            stat_points_available: 0,
            birth_stats: birth,
            stats: { ...birth },
          },
          {
            id: '7002',
            name: 'Impossivel',
            level: 5,
            rarity: 1,
            stars: 0,
            battle_allowed: true,
            abilities: [],
            stat_points_available: 0,
            birth_stats: birth,
            stats: { ...birth, dmg: 100_000 },
          },
        ],
        items: [],
        skills: { refunds: {}, totals: { vagas_campo: 0, bag_tabs_bonus: 0 }, levels: {} },
        casa: { active_casa: 1, cycle_secs: 1000, levels: [1, 0, 0, 0, 0], slots: 1 },
      }),
    );

  async function loadMixed(page: import('@playwright/test').Page) {
    await page.goto('/');
    await openImportDialog(page);
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: 'mixed.json', mimeType: 'application/json', buffer: mixedSave() });
  }

  test('names the hero, both causes, and what to do about each', async ({ page }) => {
    await loadMixed(page);

    const notice = page.getByRole('dialog').getByTestId('import-blocked-notice');
    await expect(notice).toBeVisible();
    // The count, so the notice cannot silently describe a different number of heroes than it lists.
    await expect(notice).toContainText(/1 herói/i);
    await expect(notice).toContainText('Impossivel');
    // Cause 1 and its action.
    await expect(notice).toContainText(/exporte um save novo/i);
    // Cause 2 and its reassurance — the half a dimmed row can never convey.
    await expect(notice).toContainText(/atualização está a caminho/i);
    await expect(notice).toContainText(/nada de errado com a sua conta/i);
  });

  test('marks the row itself, and leaves the importable hero alone', async ({ page }) => {
    await loadMixed(page);

    const dialog = page.getByRole('dialog');
    // Exactly one row carries the marker — the count is what stops it becoming a banner that
    // fires on every row, or on none.
    await expect(dialog.getByTestId('import-blocked-badge')).toHaveCount(1);

    // And it is on the RIGHT row. Scoping by row also keeps the assertion off the notice above,
    // which names the same hero.
    const blockedRow = dialog.getByRole('row').filter({ hasText: 'Impossivel' });
    await expect(blockedRow).toHaveCount(1);
    await expect(blockedRow.getByTestId('import-blocked-badge')).toContainText(/não importável/i);

    // Both heroes are still LISTED — a blocked hero that simply vanished would be a worse
    // explanation than a dimmed one — and the importable one is untouched.
    const okRow = dialog.getByRole('row').filter({ hasText: 'Normal' });
    await expect(okRow).toHaveCount(1);
    await expect(okRow.getByTestId('import-blocked-badge')).toHaveCount(0);
  });
});
