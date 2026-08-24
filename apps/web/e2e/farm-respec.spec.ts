import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { seedLocalStorage, type SeededState } from './fixtures/seed';

/**
 * The committed account-486 capture, imported through the shell's REAL import dialog — the same
 * flow `farm-ranking.spec.ts` scenario 11 drives. It carries an `account` block with a
 * `max_phase`, which is what makes the recommended-phase assertion reproducible;
 * `e2e/fixtures/sample-save.json` is a different, 3-hero account with no `max_phase` and cannot
 * stand in for it (`docs/fixture-corpus.md`). Not copied into `e2e/fixtures/` — that would be a
 * second copy of a scrubbed capture that drifts.
 *
 * SWAPPED to the 2026-08-23 capture. The 5-hero 2026-08-13 one drove every case here until that
 * patch restated the crit-chance abilities in points; under today's sheet math its best reachable
 * respec is worth 0.077%, far below `FARM_RESPEC_MIN_GAIN_PCT`, so the toolbar callout this whole
 * file drives never appears and there is no UI left to test. That account's flip to quiet is a
 * real behaviour change and is asserted where it belongs, in
 * `src/tests/farm-respec-fixture.test.ts`; this file needs an account with genuine headroom, and
 * the 2026-08-23 capture has it (3.66% lower bound, 11.09% solved) while also being the only
 * capture whose sheet math today's model reproduces.
 */
const account486 = path.join(process.cwd(), 'src/tests/fixtures/sheet-math/save-20260823-13heroes-crit-points.json');

const table = (page: Page) => page.locator('[data-testid="farm-ranking-table"]');
const rows = (page: Page) => table(page).locator('tbody tr');
const toolbar = (page: Page) => page.getByTestId('farm-respec-toolbar');
const headline = (page: Page) => page.getByTestId('farm-respec-headline');
const optimizeButton = (page: Page) => page.getByTestId('farm-respec-optimize');
const panel = (page: Page) => page.getByTestId('farm-respec-panel');
const heroGrid = (page: Page) => page.getByTestId('farm-respec-heroes');

async function importAccount486(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(account486);
  // Jon is one of the thirteen heroes in the committed capture.
  await expect(page.getByRole('dialog').getByText('Jon')).toBeVisible();
  await page.getByRole('button', { name: /import \d+ hero/i }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

/**
 * `captureSeededState` reads `bf-hp-account-v1` straight out of localStorage, bypassing React.
 * The account autosave (`persist-account.ts`) debounces its write by `AUTOSAVE_MS` (700ms), so a
 * capture taken immediately after `importAccount486` resolves can still see the pre-import
 * default sitting in storage from boot (all-zero tree, no `max_phase`) rather than the
 * just-imported account — and re-seeding that default silently swaps in a much weaker account
 * than the one the test believes it is driving. Poll for `max_phase`, the one field only a real
 * import of this fixture ever sets, instead of sleeping a fixed delay: sleeping either races
 * under load or over-waits needlessly.
 */
async function waitForAccountAutosave(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('bf-hp-account-v1');
    if (!raw) return false;
    try {
      return JSON.parse(raw).maxPhase != null;
    } catch {
      return false;
    }
  });
}

async function captureSeededState(page: Page, lang: 'en' | 'pt'): Promise<SeededState> {
  await waitForAccountAutosave(page);
  const raw = await page.evaluate(() => ({
    heroes: JSON.parse(localStorage.getItem('bf-hp-heroes-v1') ?? '[]') as SeededState['heroes'],
    activeHeroId: JSON.parse(localStorage.getItem('bf-hp-active-hero-v1') ?? 'null') as string | null,
    account: JSON.parse(localStorage.getItem('bf-hp-account-v1') ?? 'null') as SeededState['account'] | null,
    phasesView: JSON.parse(localStorage.getItem('bf-hp-phases-view-v1') ?? 'null') as SeededState['phasesView'] | null,
  }));
  return {
    heroes: raw.heroes,
    activeHeroId: raw.activeHeroId ?? undefined,
    account: raw.account ?? undefined,
    phasesView: raw.phasesView ?? undefined,
    lang,
  };
}

async function firstRowPhase(page: Page): Promise<number> {
  const testid = await rows(page).first().getAttribute('data-testid');
  return Number(testid?.replace('farm-row-', ''));
}

// Deliberately NOT asserted anywhere in this file: "a second Optimize activation on unchanged
// inputs does not re-solve". The DOM has no honest signal for "did not recompute" — inventing
// one (a render-counter attribute) would be test-shaped production code. That claim is proved by
// a Vitest solve-counter assertion instead (phases-slice.test.ts).
test.describe('Farm Respec Advisor', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, { heroes: [], lang: 'en' });
    await page.goto('/farm');
    await importAccount486(page);
  });

  // 1. The callout appears with a lower-bound gain and nothing else; the recommended phase it
  // used to restate is the panel's Phase tile, so the band is asserted there instead.
  test('the toolbar callout is the lower-bound gain alone; the panel names a phase in 50-54', async ({ page }) => {
    await expect(toolbar(page)).toBeVisible();
    await expect(headline(page)).toContainText(/at least/i);
    // The phase, the cost and the payback all moved into the panel — none of them may creep back.
    await expect(headline(page)).not.toContainText(/#\d+/);
    await expect(headline(page)).not.toContainText(/gold to respec|pays for itself/i);

    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();
    const phaseText = (await page.getByTestId('farm-respec-metric-phase').textContent()) ?? '';
    const phases = [...phaseText.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));
    expect(phases.length, `no phase number found in "${phaseText}"`).toBeGreaterThan(0);
    // The tile reads `current -> recommended`; the recommendation is the last one it prints.
    const recommended = phases[phases.length - 1];
    // The solver lands on 52 for this account; asserted as a narrow band rather than a point so
    // a last-digit move in an unrelated constant does not fail a test about the UI.
    expect(recommended).toBeGreaterThanOrEqual(50);
    expect(recommended).toBeLessThanOrEqual(54);
  });

  // 2. Optimize expands the panel IN PLACE — DOM order between the toolbar and the table's
  // <thead>, never a modal or drawer.
  test('Optimize expands the panel in place, between the toolbar and the table head, never a dialog', async ({ page }) => {
    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();

    const order = await page.evaluate(() => {
      const toolbarEl = document.querySelector('[data-testid="farm-respec-toolbar"]');
      const panelEl = document.querySelector('[data-testid="farm-respec-panel"]');
      const theadEl = document.querySelector('[data-testid="farm-ranking-table"] thead');
      if (!toolbarEl || !panelEl || !theadEl) return null;
      const toolbarBeforePanel = Boolean(
        toolbarEl.compareDocumentPosition(panelEl) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      const panelBeforeThead = Boolean(
        panelEl.compareDocumentPosition(theadEl) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      return { toolbarBeforePanel, panelBeforeThead };
    });
    expect(order).toEqual({ toolbarBeforePanel: true, panelBeforeThead: true });

    expect(await page.locator('[role="dialog"]:visible').count()).toBe(0);
  });

  // 3. The split is executable: every enabled hero has a card, at least one is the unchanged
  // variant naming gold not spent, a changed hero's card has eight key rows, the luck row reads
  // the keep wording, and nothing reads optional/negligible/skip.
  test('every enabled hero has a card; changed heroes show all eight keys with luck kept; unchanged heroes name the gold not spent', async ({ page }) => {
    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(heroGrid(page)).toBeVisible();

    const cardCount = await heroGrid(page).locator('[data-testid^="farm-respec-hero-"]').count();
    expect(cardCount).toBe(13); // the committed capture's thirteen heroes

    const keyRows = heroGrid(page).locator('[data-testid^="farm-respec-key-"]');
    const changedCardKeyCount = await keyRows.count();
    expect(changedCardKeyCount).toBeGreaterThan(0);
    expect(changedCardKeyCount % 8).toBe(0); // every changed card contributes exactly 8 rows

    // The Luck row's lock glyph carries "Keep" as its accessible name (DeltaTable's `lockLabel`),
    // not visible text — a compact icon replaces the old Chip + HelpTip pair.
    await expect(heroGrid(page).getByRole('button', { name: 'Keep' }).first()).toBeVisible();
    await expect(heroGrid(page).getByText(/no respec needed/i).first()).toBeVisible();

    const panelText = (await panel(page).textContent()) ?? '';
    expect(panelText).not.toMatch(/optional|negligible|\bskip(pable)?\b/i);
  });

  // 4. Cards wrap onto further rows; never an accordion, tab list or horizontal scroller.
  test('hero cards wrap onto further rows at 1280px width, never collapsing into tabs or a scroller', async ({ page }) => {
    await optimizeButton(page).click();
    await expect(heroGrid(page)).toBeVisible();

    const cards = heroGrid(page).locator('[data-testid^="farm-respec-hero-"]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(1);
    const boxes = await Promise.all(
      Array.from({ length: count }, (_unused, index) => cards.nth(index).boundingBox()),
    );
    const tops = new Set(boxes.map((box) => box?.y));
    expect(tops.size, 'expected cards on more than one row').toBeGreaterThan(1);

    // Scoped to the hero grid — the page may legitimately have an unrelated tablist elsewhere
    // (e.g. shell chrome); the requirement here is that this grid never becomes one.
    expect(await heroGrid(page).locator('[role="tablist"]').count()).toBe(0);
    const gridOverflowX = await heroGrid(page).evaluate((element) => getComputedStyle(element).overflowX);
    expect(gridOverflowX).not.toBe('scroll');
    expect(gridOverflowX).not.toBe('auto');
  });

  // 5. Re-rank moves the top-ranked phase into the recommended band, closes the panel, and marks the
  // table as showing the proposed build.
  test('re-rank moves the top-ranked phase into 50-54, closes the panel, and marks the table', async ({ page }) => {
    const beforePhase = await firstRowPhase(page);

    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();

    await page.getByTestId('farm-respec-rerank').getByRole('switch').click();
    await expect(panel(page)).toBeHidden();
    await expect(table(page).locator('table')).toHaveAttribute('data-farm-mode', 'proposed');
    await expect(page.getByTestId('farm-respec-rerank-banner')).toBeVisible();

    const afterPhase = await firstRowPhase(page);
    expect(afterPhase).not.toBe(beforePhase);
    expect(afterPhase).toBeGreaterThanOrEqual(50);
    expect(afterPhase).toBeLessThanOrEqual(54);
  });

  // 6. Invalidation: with re-rank on, changing an input reverts everything — no stale figure.
  test('changing a rotation-pool input while re-ranked reverts the panel and the table, with no stale gain figure left on screen', async ({ page }) => {
    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();
    const oldGainText = (await headline(page).textContent()) ?? '';

    await page.getByTestId('farm-respec-rerank').getByRole('switch').click();
    await expect(table(page).locator('table')).toHaveAttribute('data-farm-mode', 'proposed');

    // Toggle a rotation-pool hero — an input the respec proposal is keyed on.
    const firstPoolSwitch = page.locator('[data-testid^="farm-pool-hero-"]').first().getByRole('switch');
    await firstPoolSwitch.click();

    await expect(panel(page)).toBeHidden();
    await expect(table(page).locator('table')).toHaveAttribute('data-farm-mode', 'current');
    if (oldGainText.trim() !== '') {
      await expect(page.getByText(oldGainText, { exact: true })).toHaveCount(0);
    }
  });

  // 7. PT — the toolbar, panel and tiles render in Portuguese, no EN leakage.
  test('renders in Portuguese with no EN leakage in the toolbar or panel', async ({ page }) => {
    const captured = await captureSeededState(page, 'pt');
    await seedLocalStorage(page, captured);
    await page.goto('/farm');

    await expect(toolbar(page)).toContainText(/pelo menos/i);
    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByText('Ouro / h', { exact: true })).toBeVisible();

    const toolbarText = (await toolbar(page).textContent()) ?? '';
    const panelText = (await panel(page).textContent()) ?? '';
    expect(toolbarText).not.toMatch(/at least/i);
    expect(panelText).not.toMatch(/Optimize|Payback|Respec cost/i);
  });

  // 8. Keyboard reachability and the busy state.
  test('Optimize is keyboard-activatable and exposes aria-expanded; the re-rank switch is keyboard-reachable with an accessible name', async ({ page }) => {
    await optimizeButton(page).focus();
    await expect(optimizeButton(page)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    await expect(optimizeButton(page)).toHaveAttribute('aria-expanded', 'true');

    const rerankSwitch = page.getByTestId('farm-respec-rerank').getByRole('switch');
    await rerankSwitch.focus();
    await expect(rerankSwitch).toBeFocused();
    await expect(page.getByRole('switch', { name: /show ranking under this build/i })).toBeVisible();
  });
});
