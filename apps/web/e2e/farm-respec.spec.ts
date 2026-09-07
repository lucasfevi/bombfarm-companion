import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { seedLocalStorage, type SeededState } from './fixtures/seed';

/**
 * The committed account-486 capture, imported through the shell's REAL import dialog — the same
 * flow `farm-ranking.spec.ts` scenario 11 drives. It carries an `account` block with a
 * `max_phase`, which is what makes the recommended-phase assertion reproducible;
 * `e2e/fixtures/sample-save.json` is a different, 3-hero account with no `max_phase` and cannot
 * stand in for it (`docs/fixture-corpus.md`). Read from the domain package's own committed
 * capture rather than a local copy — a second copy would drift from it.
 *
 * SWAPPED to the 2026-08-23 capture. The 5-hero 2026-08-13 one drove every case here until the
 * patch that restated the crit-chance abilities in points; under today's sheet math its best
 * reachable respec is worth a rounding error, so the panel would answer every press with the
 * not-worth-it banner and there would be no laid-out recommendation left to test. This file
 * needs an account with genuine headroom, and the 2026-08-23 capture has it while also being one
 * of the captures whose sheet math today's model reproduces.
 */
const account486 = path.join(
  process.cwd(),
  '../../packages/domain/tests/fixtures/sheet-math/save-20260823-13heroes-crit-points.json',
);

/** A capture whose best reachable respec is worth low single digits — under the floor, so the
 *  panel answers with the not-worth-it banner instead of a per-hero split. */
const accountNearOptimal = path.join(
  process.cwd(),
  '../../packages/domain/tests/fixtures/sheet-math/save-20260828-4heroes-postpatch.json',
);

const table = (page: Page) => page.locator('[data-testid="farm-ranking-table"]');
const rows = (page: Page) => table(page).locator('tbody tr');
const toolbar = (page: Page) => page.getByTestId('farm-respec-toolbar');
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

/**
 * Wait out the ONE roster write every import produces ~800ms later.
 *
 * The hero autosave bumps the ACTIVE hero's `updatedAt` after an import even though nothing about
 * the hero changed, which replaces the `heroes` ARRAY. `readFarmDepTuple` holds `heroes` by
 * reference and `farmDepsEqual` compares with `Object.is`, so that write makes any respec
 * proposal solved before it stale — and the panel, which renders off the proposal, closes itself
 * mid-test. Measured on both committed captures used here: hero[2] (the active one) and no other
 * field. Every test below that opens the panel is racing that write and passing only by finishing
 * first.
 *
 * Settle-based rather than "wait for the write": polling until the roster stops changing is
 * correct whether or not the write happens, so fixing the underlying churn cannot break this.
 */
async function waitForRosterSettle(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const first = await page.evaluate(() => localStorage.getItem('bf-hp-heroes-v1'));
        await page.waitForTimeout(900);
        const second = await page.evaluate(() => localStorage.getItem('bf-hp-heroes-v1'));
        return first === second;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
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
    await waitForRosterSettle(page);
  });

  // 1. The toolbar is the Optimize control and nothing else — no figure is reported until the
  // player asks. The recommended phase is the panel's Phase tile, so the band is asserted there.
  test('the toolbar offers Optimize and reports no figure; the panel names a phase in 59-63', async ({ page }) => {
    await expect(toolbar(page)).toBeVisible();
    await expect(optimizeButton(page)).toBeEnabled();
    // Before the press the toolbar carries the button label and no number of any kind: no gain,
    // no phase, no cost, no payback.
    const beforePress = (await toolbar(page).textContent())?.trim() ?? '';
    expect(beforePress).toBe('Optimize');

    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();
    const phaseText = (await page.getByTestId('farm-respec-metric-phase').textContent()) ?? '';
    const phases = [...phaseText.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));
    expect(phases.length, `no phase number found in "${phaseText}"`).toBeGreaterThan(0);
    // The tile reads `current -> recommended`; the recommendation is the last one it prints.
    const recommended = phases[phases.length - 1];
    // The solver lands on 61 for this account, up from 55 before every clear was charged for the
    // seconds the squad spends coming up to speed: that head is a fixed cost, so it hurts a quick
    // low-phase clear far more than a long one and the phase worth farming rises. (55 was itself
    // up from 52, when the 2026-08-28 damage patch made weapons worth five times as much.)
    // Asserted as a narrow band rather than a point so a last-digit move in an unrelated constant
    // does not fail a test about the UI.
    //
    // This band is a UI anchor, not a measurement. The capture behind it is out of regime for
    // sheet math (see `docs/fixture-corpus.md` §13), so the number is here to keep the assertion
    // from going vacuous, and it moves whenever the model does.
    expect(recommended).toBeGreaterThanOrEqual(59);
    expect(recommended).toBeLessThanOrEqual(63);
  });

  test('the panel says it moves points only, and points at the Optimizer page for the rest', async ({ page }) => {
    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();
    const scope = page.getByTestId('farm-respec-points-only');
    await expect(scope).toHaveText(/only moves stat points/i);
    await expect(scope).toHaveText(/never moves gear between heroes and never forges anything/i);
    await expect(scope).toHaveText(/use the Optimizer page/i);
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
  // table as showing the proposed build. Same band, and the same caveat, as the Phase tile above.
  test('re-rank moves the top-ranked phase into 59-63, closes the panel, and marks the table', async ({ page }) => {
    const beforePhase = await firstRowPhase(page);

    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();

    await page.getByTestId('farm-respec-rerank').getByRole('switch').click();
    await expect(panel(page)).toBeHidden();
    await expect(table(page).locator('table')).toHaveAttribute('data-farm-mode', 'proposed');
    await expect(page.getByTestId('farm-respec-rerank-banner')).toBeVisible();

    const afterPhase = await firstRowPhase(page);
    expect(afterPhase).not.toBe(beforePhase);
    expect(afterPhase).toBeGreaterThanOrEqual(59);
    expect(afterPhase).toBeLessThanOrEqual(63);
  });

  // 6. Invalidation: with re-rank on, changing an input reverts everything — no stale figure.
  test('changing a rotation-pool input while re-ranked reverts the panel and the table, with no stale gain figure left on screen', async ({ page }) => {
    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();

    // The PANEL's gold tile carries the SOLVED proposal and is rendered only inside the panel,
    // so it has to be gone once the panel is invalidated.
    const proposalText = (await page.getByTestId('farm-respec-metric-gold').textContent()) ?? '';
    expect(proposalText.trim()).not.toBe('');

    await page.getByTestId('farm-respec-rerank').getByRole('switch').click();
    await expect(table(page).locator('table')).toHaveAttribute('data-farm-mode', 'proposed');

    // Toggle a rotation-pool hero — an input the respec proposal is keyed on.
    const firstPoolSwitch = page.locator('[data-testid^="farm-pool-hero-"]').first().getByRole('switch');
    await firstPoolSwitch.click();

    await expect(panel(page)).toBeHidden();
    await expect(table(page).locator('table')).toHaveAttribute('data-farm-mode', 'current');
    await expect(page.getByTestId('farm-respec-metric-gold')).toHaveCount(0);
    await expect(page.getByText(proposalText, { exact: true })).toHaveCount(0);
  });

  // 7. PT — the toolbar, panel and tiles render in Portuguese, no EN leakage.
  test('renders in Portuguese with no EN leakage in the toolbar or panel', async ({ page }) => {
    const captured = await captureSeededState(page, 'pt');
    await seedLocalStorage(page, captured);
    await page.goto('/farm');

    await expect(toolbar(page)).toContainText(/Otimizar/i);
    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByText('Ouro / h', { exact: true })).toBeVisible();

    const toolbarText = (await toolbar(page).textContent()) ?? '';
    const panelText = (await panel(page).textContent()) ?? '';
    expect(toolbarText).not.toMatch(/Optimize/i);
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

  // 9. The floor's other side: the search runs, finds a real but small gain, and the panel says
  // the gold is better left unspent rather than laying out a respec that does not pay.
  test('a gain under the floor answers with the not-worth-it banner and no per-hero split', async ({ page }) => {
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(accountNearOptimal);
    await page.getByRole('button', { name: /import \d+ hero/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
    await waitForRosterSettle(page);

    // The control is offered on this account too — that is the point of it being unconditional.
    await expect(optimizeButton(page)).toBeEnabled();
    await optimizeButton(page).click();
    await expect(panel(page)).toBeVisible();

    const banner = page.getByTestId('farm-respec-below-threshold-banner');
    await expect(banner).toBeVisible();
    // It names the gain it DID find rather than hiding it, and says what the floor is.
    await expect(banner).toContainText(/%/);
    // No recommendation is laid out: no metric tiles, no hero cards, no frontier.
    await expect(page.getByTestId('farm-respec-metrics')).toHaveCount(0);
    await expect(heroGrid(page)).toHaveCount(0);
    await expect(page.getByTestId('farm-respec-frontier')).toHaveCount(0);
  });
});