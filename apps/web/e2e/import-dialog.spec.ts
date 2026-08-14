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
  test('has no selection checkboxes; status switches are read-only (AC-31)', async ({ page }) => {
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

  test('importing a save that omits a previously-imported hero removes exactly that hero (BSP-48, AC-33, DEC-08)', async ({
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

  test('sync summary shows created / updated / removed before confirm (AC-32)', async ({ page }) => {
    // seed-cora shares sample-save.json's sourceId (1001) -> updated; Lorne/Brenna (1002/1004)
    // are new -> created; the orphan (9999) is absent from the save -> removed.
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
    await expect(page.getByRole('dialog').getByText('Cora')).toBeVisible();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/criados 2/i)).toBeVisible();
    await expect(dialog.getByText(/atualizados 1/i)).toBeVisible();
    await expect(dialog.getByText(/removidos 1/i)).toBeVisible();
    await expect(dialog.getByText(/não estão nesse save não existem mais no jogo/i)).toBeVisible();
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
