import path from 'node:path';
import { test, expect } from '@playwright/test';

const sampleSave = path.join(process.cwd(), 'e2e/fixtures/sample-save.json');

async function importSampleSave(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /importar seu save/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(sampleSave);
  await expect(page.getByRole('dialog').getByText('Cora')).toBeVisible();
  await page.getByRole('button', { name: /importar \d+ herói/i }).click();
}

/** PW-05: core client flow — sole chromium project (color-independent). */
test.describe('core client flow', () => {
  test('footer shows a stable app version label on every route', async ({ page }) => {
    await page.goto('/');

    const version = page.getByTestId('app-version');
    await expect(version).toBeVisible();
    await expect(version).toHaveText(/^v\d+\.\d+\.\d+/);

    const footer = page.locator('footer');
    const coffee = footer.getByRole('link', { name: /coffee|café/i });
    const versionBox = await version.boundingBox();
    const coffeeBox = await coffee.boundingBox();
    const footerBox = await footer.boundingBox();
    expect(versionBox).toBeTruthy();
    expect(coffeeBox).toBeTruthy();
    expect(footerBox).toBeTruthy();
    expect(versionBox!.x + versionBox!.width).toBeLessThanOrEqual(coffeeBox!.x + 4);
    expect(footerBox!.height).toBeLessThan(120);
  });

  test('import → select → level/stars → DPS updates → explain toggle', async ({ page }) => {
    await page.goto('/');

    // PW-05.1 — empty workspace visible; hero strip metrics hidden
    const empty = page.getByRole('region', { name: /nenhum herói adicionado/i });
    await expect(empty).toBeVisible();
    const sustainedLabel = page.getByText('DPS efetivo', { exact: true });
    await expect(sustainedLabel).toBeHidden();

    // PW-05.2 — real import path
    await importSampleSave(page);

    await expect(empty).toBeHidden();
    await expect(sustainedLabel).toBeVisible();

    const heroStrip = page.getByRole('region', { name: /herói atual/i });
    await expect(heroStrip).toBeVisible();
    await expect(heroStrip.getByText('Cora')).toBeVisible();

    // PW-05.3 — switch hero via picker, capture Sustained, level-up + stars, assert value changed
    await heroStrip.getByRole('button', { name: /trocar herói/i }).click();
    const picker = page.getByRole('dialog', { name: /trocar herói/i });
    await expect(picker).toBeVisible();
    // Avatar, not the row centre — the gear / ability icon buttons in the wide
    // columns stopPropagation and would swallow the row click.
    await picker.getByRole('row', { name: /Cora/i }).getByRole('img', { name: 'Cora' }).click();
    await expect(picker).toBeHidden();
    await expect(heroStrip.getByText('Cora')).toBeVisible();

    const sustainedValue = sustainedLabel.locator('xpath=../strong');
    const before = (await sustainedValue.textContent())?.trim() ?? '';
    expect(before.length).toBeGreaterThan(0);

    await page.getByRole('button', { name: /^subir nível$/i }).click();
    await page.getByRole('button', { name: /^subir estrela$/i }).click();

    await expect(sustainedValue).not.toHaveText(before);

    // PW-05.4 — explain disclosure open/close (Collapsible trigger button, ui-accordion)
    const explainTrigger = page.getByRole('button', { name: /como calculamos tudo/i });
    // The footer carries a permanent wiki art-credit link with the same accessible
    // name, so page-wide visibility is always true. Count instead: the disclosure
    // mounts its own link only while open.
    const wikiLinks = page.getByRole('link', { name: /wiki\.bombfarm\.net/i });

    await expect(wikiLinks).toHaveCount(1);
    await explainTrigger.click();
    await expect(wikiLinks).toHaveCount(2);
    await explainTrigger.click();
    await expect(wikiLinks).toHaveCount(1);
  });

  /**
   * PW-05.5 negative check (discrimination):
   * Feeding invalid JSON shows the invalid-JSON error and does NOT create roster rows.
   * Sabotage that would make the happy path fail: skip confirm / use bad file → no Cora row.
   */
  test('invalid import does not create roster rows', async ({ page }) => {
    await page.goto('/');
    const empty = page.getByRole('region', { name: /nenhum herói adicionado/i });
    await expect(empty).toBeVisible();

    await page.getByRole('button', { name: /importar seu save/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'broken.json',
      mimeType: 'application/json',
      buffer: Buffer.from('not-valid-json{{{'),
    });

    await expect(
      page.getByText(/não foi possível ler esse arquivo como json/i),
    ).toBeVisible();

    // Dismiss dialog — no heroes imported
    await page.getByRole('button', { name: /fechar/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await expect(empty).toBeVisible();
    await expect(page.getByRole('region', { name: /herói atual/i })).toBeHidden();
  });

  test('hero picker gear column shows eight slot icons', async ({ page }) => {
    await page.goto('/');
    await importSampleSave(page);

    const heroStrip = page.getByRole('region', { name: /herói atual/i });
    await heroStrip.getByRole('button', { name: /trocar herói/i }).click();
    const picker = page.getByRole('dialog', { name: /trocar herói/i });
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('columnheader', { name: /^Equip\./i })).toBeVisible();

    const gearCell = picker.locator('tbody tr').first().locator('td[data-roster-wrap]').first();
    await expect(gearCell.getByRole('button')).toHaveCount(8);
  });
});
