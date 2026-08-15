import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { seedLocalStorage, type SeededState } from './fixtures/seed';

/**
 * The committed account-486 fixture, imported through the shell's REAL import dialog — the same
 * flow `farm-ranking.spec.ts` scenario 11 drives. This is the only fixture with an `account`
 * block carrying a `max_phase`, which is what makes the 26-28 recommended-phase band
 * reproducible; `e2e/fixtures/sample-save.json` is a different, 3-hero account with no
 * `max_phase` and cannot stand in for it (`docs/fixture-corpus.md`). Not copied into
 * `e2e/fixtures/` — that would be a second copy of a scrubbed capture that drifts.
 */
const account486 = path.join(process.cwd(), 'src/tests/fixtures/sheet-math/save-20260813-5heroes.json');

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
  // Jon is one of the five heroes in the committed fixture.
  await expect(page.getByRole('dialog').getByText('Jon')).toBeVisible();
  await page.getByRole('button', { name: /import \d+ hero/i }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

async function captureSeededState(page: Page, lang: 'en' | 'pt'): Promise<SeededState> {
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

  // 1. The callout appears and names a phase in the band; the gain reads as a lower bound.
  test('the toolbar callout names a recommended phase in 26-28, with a lower-bound gain', async ({ page }) => {
    await expect(toolbar(page)).toBeVisible();
    await expect(headline(page)).toContainText(/at least/i);
    // Scoped to the ONE leaf span carrying the phase — sibling spans in the headline have no
    // literal whitespace between them in the DOM (only a CSS flex gap), so reading the whole
    // container's concatenated textContent would run this span's digits into the next span's.
    const phaseText = await headline(page).getByText(/#\d+/).textContent();
    const phaseMatch = phaseText?.match(/#(\d+)/);
    expect(phaseMatch, `no phase number found in "${phaseText}"`).not.toBeNull();
    const phase = Number(phaseMatch![1]);
    expect(phase).toBeGreaterThanOrEqual(26);
    expect(phase).toBeLessThanOrEqual(28);
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
    expect(cardCount).toBe(5); // the committed fixture's five heroes

    const keyRows = heroGrid(page).locator('[data-testid^="farm-respec-key-"]');
    const changedCardKeyCount = await keyRows.count();
    expect(changedCardKeyCount).toBeGreaterThan(0);
    expect(changedCardKeyCount % 8).toBe(0); // every changed card contributes exactly 8 rows

    await expect(heroGrid(page).getByText('Keep', { exact: true }).first()).toBeVisible();
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

  // 5. Re-rank moves the top-ranked phase into the 26-28 band, closes the panel, and marks the
  // table as showing the proposed build.
  test('re-rank moves the top-ranked phase into 26-28, closes the panel, and marks the table', async ({ page }) => {
    const beforePhase = await firstRowPhase(page);

    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();

    await page.getByTestId('farm-respec-rerank').getByRole('switch').click();
    await expect(panel(page)).toBeHidden();
    await expect(table(page).locator('table')).toHaveAttribute('data-farm-mode', 'proposed');
    await expect(page.getByTestId('farm-respec-rerank-banner')).toBeVisible();

    const afterPhase = await firstRowPhase(page);
    expect(afterPhase).not.toBe(beforePhase);
    expect(afterPhase).toBeGreaterThanOrEqual(26);
    expect(afterPhase).toBeLessThanOrEqual(28);
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

  // 7. The objective picker re-solves and persists across a reload.
  test('selecting the chests objective re-solves and shows the explainer; the selection survives a reload', async ({ page }) => {
    const objectiveSelect = toolbar(page).getByLabel(/^Objective$/i);
    await objectiveSelect.click();
    // Anchored to the start — "Balanced" also contains the word "chests" in its own label.
    await page.getByRole('option', { name: /^Chests \/ hr/i }).click();

    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(page.getByTestId('farm-respec-chest-explainer')).toBeVisible();

    const captured = await captureSeededState(page, 'en');
    expect(captured.phasesView?.farmObjective).toBe('chests');

    await seedLocalStorage(page, captured);
    await page.goto('/farm');

    await expect(toolbar(page).getByLabel(/^Objective$/i)).toContainText(/Chests/i);
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('bf-hp-phases-view-v1');
      return raw ? (JSON.parse(raw) as { farmObjective?: string }) : null;
    });
    expect(stored?.farmObjective).toBe('chests');
  });

  // 8. PT — the toolbar, panel and tiles render in Portuguese, no EN leakage.
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

  // 9. Keyboard reachability and the busy state.
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
