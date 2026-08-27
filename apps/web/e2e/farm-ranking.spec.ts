import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { importedRoster, seedLocalStorage } from './fixtures/seed';

const sampleSave = path.join(process.cwd(), 'e2e/fixtures/sample-save.json');

/** importedRoster's account with a known max phase — importedRoster itself stays untouched
 *  (visual baselines are expressed against it). */
const accountWithMaxPhase = { ...importedRoster.account!, maxPhase: 42 };
const accountNoMaxPhase = importedRoster.account!;

const table = (page: Page) => page.locator('[data-testid="farm-ranking-table"]');
/** Real data rows only — excludes the top/bottom spacer `<tr>`s the virtualized body
 *  renders to reserve scroll height for the rows outside the current window. */
const rows = (page: Page) => table(page).locator('tbody tr[data-testid^="farm-row-"]');
const scrollContainer = (page: Page) => page.getByTestId('farm-ranking-scroll');

/**
 * The body only mounts a scroll-position-derived window of the filtered row set (plus overscan),
 * so a DOM row count can no longer stand for "how many rows matched the filters" — `aria-rowcount`
 * on the `<table>` carries that guarantee instead (`aria-rowindex` on each rendered row is the
 * per-row half of the same pair). `toHaveAttribute` auto-retries, same as the `toHaveCount` this
 * replaces.
 */
function rowCountLocator(page: Page) {
  return table(page).locator('table');
}

async function rowCount(page: Page): Promise<number> {
  const attr = await rowCountLocator(page).getAttribute('aria-rowcount');
  return Number(attr);
}

/** Polls `aria-rowcount` until `predicate` holds, then returns the settled value — the
 *  read/assert-inequality equivalent of `toHaveAttribute`'s built-in retry for equality checks. */
async function waitForRowCount(page: Page, predicate: (count: number) => boolean): Promise<number> {
  let value = NaN;
  await expect
    .poll(async () => {
      value = await rowCount(page);
      return predicate(value);
    })
    .toBe(true);
  return value;
}

async function setScrollTop(page: Page, top: number): Promise<void> {
  await scrollContainer(page).evaluate((el, value) => {
    el.scrollTop = value;
  }, top);
}

/**
 * The row-level "Gate" badge is the same always-mounted-but-invisible pattern — every row's
 * phase cell carries the text "Gate" in the DOM. Scrolls the virtualized body one viewport at a
 * time (a real user would too) looking for the first row whose Gate chip is actually visible (a
 * real gate row); returns its `data-testid` and the `scrollTop` that revealed it, so a caller can
 * bring the same row back into the render window later without re-scanning. Returns null if no
 * gate row exists in the current (filtered) row set.
 */
async function findGateRow(page: Page): Promise<{ testId: string; scrollTop: number } | null> {
  const container = scrollContainer(page);
  const { scrollHeight, clientHeight } = await container.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  const maxScroll = Math.max(0, scrollHeight - clientHeight);
  const step = clientHeight || 1;

  for (let top = 0; ; top = Math.min(top + step, maxScroll)) {
    await setScrollTop(page, top);
    // Scrolling triggers a React re-render of the window asynchronously (the native scroll
    // event, then a commit) — give it a beat before reading the DOM back.
    await page.waitForTimeout(75);
    const testId = await rows(page).evaluateAll((trs) => {
      for (const tr of trs) {
        const gateChip = Array.from(tr.querySelectorAll('span')).find((span) => span.textContent === 'Gate');
        if (gateChip && getComputedStyle(gateChip).visibility !== 'hidden') {
          return tr.getAttribute('data-testid');
        }
      }
      return null;
    });
    if (testId) return { testId, scrollTop: top };
    if (top >= maxScroll) return null;
  }
}

test.describe('Farm Ranking board', () => {
  // 1. Redirect — /phases -> /farm, history replaced.
  test('goto(/phases) lands on /farm, and Back does not bounce back to /phases', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/');
    await page.goto('/phases');
    await expect(page).toHaveURL(/\/farm$/);
    await expect(page.getByTestId('farm-ranking')).toBeVisible();

    await page.goBack();
    await expect(page).not.toHaveURL(/\/phases$/);
  });

  // 2. Renders + default state.
  test('renders above the explorer, sorted gold/hr desc, unlocked-only default, row count == maxPhase', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/farm');

    await expect(page.getByTestId('farm-ranking')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Map$/i, level: 2 })).toBeVisible();
    await expect(rowCountLocator(page)).toHaveAttribute('aria-rowcount', '42');

    const firstRowGold = table(page).locator('[data-testid^="farm-row-gold-"]').first();
    const secondRowGold = table(page).locator('[data-testid^="farm-row-gold-"]').nth(1);
    const parseCompact = (text: string) => {
      const clean = text.trim().replace(/\/h$/, '');
      const mult = clean.endsWith('k') ? 1e3 : clean.endsWith('m') ? 1e6 : clean.endsWith('bi') ? 1e9 : 1;
      return parseFloat(clean) * mult;
    };
    const first = parseCompact((await firstRowGold.textContent()) ?? '0');
    const second = parseCompact((await secondRowGold.textContent()) ?? '0');
    expect(first).toBeGreaterThanOrEqual(second);
  });

  // 3. Sort.
  test('sorting a rate column reorders, sets aria-sort, and announces via the live region', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/farm');

    const chestsHeader = table(page).getByRole('columnheader', { name: /Item chest/i });
    await expect(chestsHeader).toHaveAttribute('aria-sort', 'none');
    await chestsHeader.getByRole('button').click();
    await expect(chestsHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(page.getByTestId('farm-sort-live')).toContainText(/Item chest/i);
    await expect(page.getByTestId('farm-sort-live')).toContainText(/descending/i);

    await chestsHeader.getByRole('button').click();
    await expect(chestsHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.getByTestId('farm-sort-live')).toContainText(/ascending/i);
  });

  // 4. Filters.
  test('filters narrow and widen the row set; an impossible combination shows the empty state', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/farm');

    await expect(rowCountLocator(page)).toHaveAttribute('aria-rowcount', '42');
    await page.getByTestId('farm-filter-unlocked').getByRole('switch').click();
    await expect(rowCountLocator(page)).toHaveAttribute('aria-rowcount', '600');
    await page.getByTestId('farm-filter-ato').getByLabel(/Difficulty/i).click();
    await page.getByRole('option', { name: 'Easy' }).click();
    const atoCount = await waitForRowCount(page, (count) => count < 600);
    expect(atoCount).toBeLessThan(600);
    expect(atoCount).toBeGreaterThan(0);

    await page.getByTestId('farm-filter-gate').getByLabel(/^Gate$/i).click();
    await page.getByRole('option', { name: 'Gates only', exact: true }).click();
    const gateCount = await waitForRowCount(page, (count) => count < atoCount);
    expect(gateCount).toBeLessThan(atoCount);

    // The account's max phase (42) is well within the Easy band, so re-enabling "unlocked
    // only" and switching to a difficulty far past it (Very Hard) is a guaranteed zero-match
    // combination — proving the impossible-combination path renders the named empty state.
    await page.getByTestId('farm-filter-gate').getByLabel(/^Gate$/i).click();
    await page.getByRole('option', { name: /All phases/i }).click();
    await page.getByTestId('farm-filter-unlocked').getByRole('switch').click();
    await page.getByTestId('farm-filter-ato').getByLabel(/Difficulty/i).click();
    await page.getByRole('option', { name: 'Very Hard' }).click();
    await expect(page.getByTestId('farm-ranking-empty')).toBeVisible();
    await expect(table(page)).toHaveCount(0);
  });

  test('the minimum item level filter keeps only phases whose LOWEST drop band clears it', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/farm');

    await page.getByTestId('farm-filter-unlocked').getByRole('switch').click();
    await expect(rowCountLocator(page)).toHaveAttribute('aria-rowcount', '600');

    // The top band spans phases 581–600, but 581–590 overlap the level-290 band beneath it and
    // still roll a 290 item, so a level-300 FLOOR leaves exactly the ten phases 591–600 — one
    // exact answer, and one that a highest-band reading would get wrong (it would say twenty).
    await page.getByTestId('farm-filter-item-level').getByLabel(/Min item level/i).click();
    await page.getByRole('option', { name: 'Level 300+', exact: true }).click();
    await expect(rowCountLocator(page)).toHaveAttribute('aria-rowcount', '10');

    await page.getByTestId('farm-filter-item-level').getByLabel(/Min item level/i).click();
    await page.getByRole('option', { name: /Any item level/i }).click();
    await expect(rowCountLocator(page)).toHaveAttribute('aria-rowcount', '600');
  });

  // 5. Row -> picker sync.
  test('a fresh load opens on the best gold/hr map, in the explorer too, without persisting it', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/farm');

    // Default sort is gold descending, so the first row is the best gold/hr map.
    const firstRow = rows(page).first();
    await expect(firstRow).toHaveAttribute('aria-current', 'true');
    const phase = (await firstRow.getAttribute('data-testid'))?.replace('farm-row-', '');
    expect(phase).not.toBe('1');

    // The explorer's own panels read the same shared phase — the board must never claim a row is
    // current while the panels below it describe a different map.
    await expect(page.getByRole('definition').getByText(`#${phase}`, { exact: false })).toBeVisible();

    // An auto-pick is a derived default, not a choice: nothing is written, so the next load
    // re-picks against whatever the roster can farm by then.
    const view = await page.evaluate(() => localStorage.getItem('bf-hp-phases-view-v1'));
    expect(view).toBeNull();
  });

  test('activating a row drives the explorer and persists the phase', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/farm');

    const firstRow = rows(page).first();
    const phaseAttr = await firstRow.getAttribute('data-testid');
    const phase = phaseAttr?.replace('farm-row-', '');
    await firstRow.click();
    await expect(firstRow).toHaveAttribute('aria-current', 'true');

    const view = await page.evaluate(() => {
      const raw = localStorage.getItem('bf-hp-phases-view-v1');
      return raw ? JSON.parse(raw) : null;
    });
    expect(String(view?.phase)).toBe(phase);
  });

  // 6. Hero toggle changes rates.
  test('toggling a hero recomputes rates, persists additively, survives reload, and leaves bf-hp-heroes-v1 byte-identical', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/farm');

    const heroesBefore = await page.evaluate(() => localStorage.getItem('bf-hp-heroes-v1'));
    const goldCell = table(page).locator('[data-testid^="farm-row-gold-"]').first();
    const before = await goldCell.textContent();

    await page.getByTestId('farm-pool-hero-seed-cora').getByRole('switch').click();
    await expect(goldCell).not.toHaveText(before ?? '');

    const view = await page.evaluate(() => {
      const raw = localStorage.getItem('bf-hp-phases-view-v1');
      return raw ? JSON.parse(raw) : null;
    });
    expect(view?.farmPool?.['seed-cora']).toBe(false);

    // "Survives a reload": `seedLocalStorage`'s `addInitScript` deterministically re-applies its
    // payload on EVERY navigation in this page, including `page.reload()` — a literal reload
    // would re-run the ORIGINAL seed (no phasesView) and erase the override just proven above,
    // not exercise persistence. Re-seeding with the override just captured and navigating fresh
    // is what actually proves hydration honours a stored override on load.
    await seedLocalStorage(page, {
      ...importedRoster,
      account: accountWithMaxPhase,
      lang: 'en',
      phasesView: view,
    });
    await page.goto('/farm');
    await expect(page.getByTestId('farm-pool-hero-seed-cora').getByRole('switch')).toHaveAttribute(
      'aria-checked',
      'false',
    );

    const heroesAfter = await page.evaluate(() => localStorage.getItem('bf-hp-heroes-v1'));
    expect(heroesAfter).toBe(heroesBefore);
  });

  // 7. Return bonus.
  test("return bonus 'off' -> 'on' -> 'vip' strictly increases gold/hr; the gate row's keys value does not change", async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/farm');

    const parseCompact = (text: string) => {
      const clean = text.trim().replace(/\/h$/, '');
      const mult = clean.endsWith('k') ? 1e3 : clean.endsWith('m') ? 1e6 : clean.endsWith('bi') ? 1e9 : 1;
      return parseFloat(clean) * mult;
    };

    // Pin the SAME row by its stable data-testid for every later read, rather than re-resolving
    // "first row in the DOM" each time — the return-bonus multiplier is uniform across every row
    // (`returnBonusMultiplier` in `@bombfarm/domain/farm-rate`), so it never reorders the
    // gold/hr ranking, and pinning survives the row scrolling out of the virtualized window's
    // top position between reads (see the scroll dance below, needed to reach the gate row too).
    const topRowTestId = await rows(page).first().getAttribute('data-testid');
    const goldCellFor = (testId: string | null) =>
      table(page).locator(`[data-testid="${testId}"]`).locator('[data-testid^="farm-row-gold-"]');

    const goldOff = parseCompact((await goldCellFor(topRowTestId).textContent()) ?? '0');
    // A gate row's "Keys / hr" cell is the 5th data cell (Phase, Mitigation, Gold, Chests, Keys).
    const gateRow = await findGateRow(page);
    expect(gateRow, 'no gate row in the default unlocked-only row set').not.toBeNull();
    const gateKeysCellFor = (testId: string) => table(page).locator(`[data-testid="${testId}"]`).locator('td').nth(4);
    const gateKeysOff = (await gateKeysCellFor(gateRow!.testId).textContent()) ?? '';

    // findGateRow left the window scrolled to wherever it found the gate row — bring the top row
    // (rank 1 by gold/hr) back into the render window before reading its cell again.
    await setScrollTop(page, 0);

    const select = page.getByTestId('farm-return-bonus').getByLabel(/Return Bonus/i);
    await select.click();
    await page.getByRole('option', { name: /^On$/i }).click();
    const goldOn = parseCompact((await goldCellFor(topRowTestId).textContent()) ?? '0');
    expect(goldOn).toBeGreaterThan(goldOff);

    await setScrollTop(page, gateRow!.scrollTop);
    await expect(gateKeysCellFor(gateRow!.testId)).toHaveText(gateKeysOff);
    await setScrollTop(page, 0);

    await select.click();
    await page.getByRole('option', { name: /^VIP$/i }).click();
    const goldVip = parseCompact((await goldCellFor(topRowTestId).textContent()) ?? '0');
    expect(goldVip).toBeGreaterThan(goldOn);

    await setScrollTop(page, gateRow!.scrollTop);
    await expect(gateKeysCellFor(gateRow!.testId)).toHaveText(gateKeysOff);
  });

  // 8. Zero enabled.
  test('disabling every hero shows the empty state and renders no numeric cell', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/farm');

    for (const heroId of ['seed-cora', 'seed-lorne', 'seed-brenna']) {
      await page.getByTestId(`farm-pool-hero-${heroId}`).getByRole('switch').click();
    }

    await expect(page.getByTestId('farm-ranking-empty')).toBeVisible();
    await expect(table(page)).toHaveCount(0);
  });

  // 9. No maxPhase.
  test('a null maxPhase shows every phase and a non-applicable unlocked-only control', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountNoMaxPhase, lang: 'en' });
    await page.goto('/farm');

    await expect(rowCountLocator(page)).toHaveAttribute('aria-rowcount', '600');
    await expect(page.getByTestId('farm-filter-unlocked').getByRole('switch')).toBeDisabled();
  });

  // 10. PT.
  test('renders in Portuguese with the Farm nav label', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'pt' });
    await page.goto('/farm');

    await expect(page.getByRole('link', { name: /^Farm$/i })).toBeVisible();
    await expect(page.getByText(/RANKING DE FARM/i)).toBeVisible();
    await expect(table(page).getByRole('columnheader', { name: /^Ouro$/i })).toBeVisible();
  });

  // Keyboard coverage.
  test('sort headers and rows are keyboard-operable', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/farm');

    const goldHeaderButton = table(page)
      .getByRole('columnheader', { name: /^Gold$/i })
      .getByRole('button');
    await goldHeaderButton.focus();
    await page.keyboard.press('Enter');
    await expect(
      table(page).getByRole('columnheader', { name: /^Gold$/i }),
    ).toHaveAttribute('aria-sort', 'ascending');
    await expect(page.getByTestId('farm-sort-live')).toContainText(/ascending/i);

    const firstRow = rows(page).first();
    await firstRow.focus();
    await page.keyboard.press('Enter');
    await expect(firstRow).toHaveAttribute('aria-current', 'true');
  });

  // 11. max_phase import wiring — the only scenario exercising the real import flow.
  test.skip('importing a save with a known max_phase writes it through', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountNoMaxPhase, lang: 'en' });
    await page.goto('/farm');

    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(sampleSave);
    await expect(page.getByRole('dialog').getByText('Cora')).toBeVisible();
    await page.getByRole('button', { name: /import \d+ hero/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByTestId('farm-filter-unlocked').getByRole('switch').click(); // widen to see locked rows
    await expect(rowCountLocator(page)).toHaveAttribute('aria-rowcount', '600');

    // The account autosave is debounced (AUTOSAVE_MS = 700ms) — poll rather than read once.
    await expect
      .poll(async () => {
        const raw = await page.evaluate(() => localStorage.getItem('bf-hp-account-v1'));
        return raw ? (JSON.parse(raw) as { maxPhase?: number }).maxPhase : undefined;
      })
      .toBe(87);
  });
});

/**
 * The field-contention notice. `importedRoster` is 3 heroes, so it can only contend once
 * `fieldSlots` drops below 3 — which makes the same fixture serve both the silent case (the one
 * that must never nag) and the speaking one.
 */
test.describe('field-contention notice', () => {
  const notice = (page: Page) => page.getByTestId('farm-contention-notice');

  test('stays silent when every hero fits on the field at once', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, account: accountWithMaxPhase, lang: 'en' });
    await page.goto('/farm');
    await expect(page.getByTestId('farm-ranking')).toBeVisible();
    await expect(notice(page)).toHaveCount(0);
  });

  test('names the share of wall clock, the slot count and what the wait costs, when the field binds', async ({
    page,
  }) => {
    await seedLocalStorage(page, {
      ...importedRoster,
      account: { ...accountWithMaxPhase, fieldSlots: 1 },
      lang: 'en',
    });
    await page.goto('/farm');
    await expect(page.getByTestId('farm-ranking')).toBeVisible();

    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText(/Your field is the bottleneck/i);
    // Every placeholder resolved — an unsubstituted `{pct}` is the failure this guards.
    await expect(notice(page)).not.toContainText(/\{/);
    await expect(notice(page)).toContainText(/% of the time a rested hero waits on the bench/i);
    // The estimate CHARGES this wait (`concurrencyScale`), so the notice reports the cost. The
    // sentence it must never print again is the one claiming the estimate ignores it.
    await expect(notice(page)).toContainText(/gold\/hr estimate already charges this wait/i);
    await expect(notice(page)).not.toContainText(/does not model this wait/i);
    // One slot of nine: the advice is actionable, so the cap is named as a target.
    await expect(notice(page)).toContainText(/all 1 of your field slots are taken/i);
    await expect(notice(page)).toContainText(/the cap is 9/i);
    // And it does NOT promise that benching heroes raises the total, because it does not.
    await expect(notice(page)).toContainText(/usually lowers the total as well/i);
  });

  test('stops prescribing field slots once the player is at the cap', async ({ page }) => {
    // Nine slots against three heroes cannot contend, so the roster has to outgrow the cap for
    // the maxed-field copy to be reachable at all — which is exactly the player who complained.
    // FORTY-FIVE, not a dozen: these seeded heroes carry small energy pools, so each holds the
    // field a short fraction of a House cycle. Measured against the board's own compute, the pool
    // reaches 5% contention only past ~30 (12 -> 0.01%, 24 -> 1.07%, 30 -> 2.76%, 45 -> 16.33%).
    await seedLocalStorage(page, {
      ...importedRoster,
      heroes: Array.from({ length: 45 }, (_, index) => ({
        ...importedRoster.heroes[index % importedRoster.heroes.length],
        id: `contend-${index}`,
        name: `Contender ${index}`,
      })),
      account: { ...accountWithMaxPhase, fieldSlots: 9 },
      lang: 'en',
    });
    await page.goto('/farm');
    await expect(page.getByTestId('farm-ranking')).toBeVisible();

    await expect(notice(page)).toBeVisible();
    await expect(notice(page)).toContainText(/Your field is saturated/i);
    await expect(notice(page)).not.toContainText(/\{/);
    await expect(notice(page)).toContainText(/9 is the maximum/i);
    await expect(notice(page)).toContainText(/no more slots to buy/i);
    // The impossible instruction, in either wording.
    await expect(notice(page)).not.toContainText(/More field slots is the direct fix/i);
    await expect(notice(page)).toContainText(/gold\/hr estimate already charges this wait/i);
  });
});
