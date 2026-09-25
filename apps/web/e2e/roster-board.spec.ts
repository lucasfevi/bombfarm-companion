import { test, expect, type Page } from '@playwright/test';
import { rosterBoard, seedLocalStorage } from './fixtures/seed';

/**
 * The roster rail and board on the planner — the surface the desktop app's Heroes screen and this
 * one now draw from one implementation.
 *
 * What the shared unit tests cannot reach is the property the whole design rests on: that ONE
 * toolbar governs BOTH presentations, and that switching between them changes the shape of the
 * roster and never its membership. That needs the two views alive in one browser, which is this
 * file.
 */
const RAIL_VIEWPORT = { width: 1440, height: 900 };

function railIds(page: Page) {
  return page.locator('[data-testid^="heroes-roster-row-"]').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).dataset.testid?.replace('heroes-roster-row-', '')),
  );
}

function cardIds(page: Page) {
  return page.locator('[data-testid^="heroes-roster-card-"]').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).dataset.testid?.replace('heroes-roster-card-', '')),
  );
}

function tableIds(page: Page) {
  return page.locator('[data-testid^="heroes-leaderboard-row-"]').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLElement).dataset.testid?.replace('heroes-leaderboard-row-', '')),
  );
}

async function openPlanner(page: Page) {
  await page.setViewportSize(RAIL_VIEWPORT);
  await seedLocalStorage(page, { ...rosterBoard, lang: 'en' });
  await page.goto('/heroes');
  await expect(page.getByRole('button', { name: /^Cards$/i })).toBeVisible();
}

async function showBoard(page: Page) {
  await page.getByRole('button', { name: /^Cards$/i }).click();
  await expect(page.locator('[data-testid^="heroes-roster-card-"]').first()).toBeVisible();
}

async function showTable(page: Page) {
  await page.getByRole('button', { name: /^Leaderboard$/i }).click();
  await expect(page.locator('[data-testid^="heroes-leaderboard-row-"]').first()).toBeVisible();
}

async function showList(page: Page) {
  await page.getByRole('button', { name: /^List$/i }).click();
  await expect(page.locator('[data-testid^="heroes-roster-row-"]').first()).toBeVisible();
}

test.describe('roster rail and board', () => {
  test('the rail lists every hero, strongest first', async ({ page }) => {
    await openPlanner(page);
    expect(await railIds(page)).toEqual([
      'board-ayla',
      'board-doran',
      'board-shelved',
      'board-nessa',
    ]);
  });

  test('the board shows the same heroes in the same order as the rail', async ({ page }) => {
    await openPlanner(page);
    const inRail = await railIds(page);
    await showBoard(page);
    expect(await cardIds(page)).toEqual(inRail);
  });

  test('a sort applies to both presentations, so switching never changes who is on screen', async ({
    page,
  }) => {
    await openPlanner(page);
    await page.getByRole('combobox', { name: /^Sort by$/i }).click();
    await page.getByRole('option', { name: /^Level$/i }).click();

    const byLevel = ['board-nessa', 'board-ayla', 'board-doran', 'board-shelved'];
    expect(await railIds(page)).toEqual(byLevel);
    await showBoard(page);
    expect(await cardIds(page)).toEqual(byLevel);

    // The direction button is labelled with the order it is IN — "Best first" is a descending
    // roster saying so — and pressing it reverses that.
    await page.getByRole('button', { name: /^Best first$/i }).click();
    expect(await cardIds(page)).toEqual([...byLevel].reverse());
    await showList(page);
    expect(await railIds(page)).toEqual([...byLevel].reverse());
  });

  test('an ability filter narrows both presentations to the heroes that own it', async ({
    page,
  }) => {
    await openPlanner(page);
    await page.getByTestId('heroes-ability-filter-olho_clinico').click();
    expect(await railIds(page)).toEqual(['board-ayla']);
    await showBoard(page);
    expect(await cardIds(page)).toEqual(['board-ayla']);
  });

  test('an ability no hero owns cannot be pressed, so the roster is never filtered to nothing', async ({
    page,
  }) => {
    await openPlanner(page);
    const absent = page.getByTestId('heroes-ability-filter-bateria_extra');
    // Shown, and shown as unavailable — the strip answers "which of these do I have none of",
    // which is why it is drawn at all rather than hidden.
    await expect(absent).toHaveAttribute('aria-disabled', 'true');

    // Dispatched rather than clicked: Playwright refuses to click an `aria-disabled` element,
    // which is itself half the answer — this fires the handler anyway, which is the half a real
    // browser can still do, since the tooltip primitive leaves the button enabled in the DOM.
    await absent.dispatchEvent('click');
    await expect(absent).toHaveAttribute('aria-pressed', 'false');
    expect(await railIds(page)).toHaveLength(4);
  });

  test('the enabled-heroes switch drops a shelved hero from both presentations', async ({
    page,
  }) => {
    await openPlanner(page);
    // Shelved but present by default: the board is where a hero out of the rotation is compared
    // with the ones that are in.
    expect(await railIds(page)).toContain('board-shelved');

    await page.getByTestId('heroes-filter-active').getByRole('switch').click();
    expect(await railIds(page)).not.toContain('board-shelved');
    await showBoard(page);
    expect(await cardIds(page)).not.toContain('board-shelved');
  });

  test('picking from the rail changes the hero the planner is editing and stays on the rail', async ({
    page,
  }) => {
    await openPlanner(page);
    await page.getByTestId('heroes-roster-row-board-nessa').click();

    await expect(page.getByTestId('heroes-roster-row-board-nessa')).toHaveAttribute(
      'aria-current',
      'true',
    );
    const strip = page.getByRole('region', { name: /^Current hero$/i });
    await expect(strip.getByText('Nessa')).toBeVisible();
  });

  test('picking from the board returns to the rail, which is where the hero it picked is shown', async ({
    page,
  }) => {
    await openPlanner(page);
    await showBoard(page);
    // The detail is not on screen while the board is, so the pick is the act of going to look at
    // it — leaving the reader on the board would swallow the click.
    // The card's own padding, not its centre: the roll bars, ability icons and gear tiles in
    // the middle of a card carry their own tooltip triggers, and a click on one of those is
    // about that icon rather than about picking the hero.
    await page
      .getByTestId('heroes-roster-card-board-nessa')
      .click({ position: { x: 6, y: 6 } });

    await expect(page.locator('[data-testid^="heroes-roster-row-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="heroes-roster-card-"]')).toHaveCount(0);
    await expect(page.getByTestId('heroes-roster-row-board-nessa')).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(
      page.getByRole('region', { name: /^Current hero$/i }).getByText('Nessa'),
    ).toBeVisible();
  });

  test('narrowing the roster does not switch the hero the planner is editing', async ({ page }) => {
    await openPlanner(page);
    await page.getByTestId('heroes-roster-row-board-nessa').click();
    const strip = page.getByRole('region', { name: /^Current hero$/i });
    await expect(strip.getByText('Nessa')).toBeVisible();

    // A filter is a question about the roster, not a hero switch — even one that leaves the
    // edited hero off the rail entirely.
    await page.getByTestId('heroes-ability-filter-olho_clinico').click();
    expect(await railIds(page)).toEqual(['board-ayla']);
    await expect(strip.getByText('Nessa')).toBeVisible();
  });

  test('every showcase card draws the same sections, and the board has no card-detail control', async ({
    page,
  }) => {
    await openPlanner(page);
    await showBoard(page);
    const cards = page.locator('[data-testid^="heroes-roster-card-"]');
    const cardCount = await cards.count();
    expect(cardCount).toBe(4);

    for (const section of ['types', 'birth', 'abilities', 'gear']) {
      await expect(page.getByTestId(`heroes-card-${section}`)).toHaveCount(cardCount);
    }
    await expect(page.getByTestId('heroes-card-density')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Compact$/ })).toHaveCount(0);

    const ayla = page.getByTestId('heroes-roster-card-board-ayla');
    await expect(ayla.getByTestId('heroes-card-position')).toHaveText('#1');
    await expect(ayla.getByTestId('heroes-card-gear-average')).toHaveText(/^Average item level \d+ · \+\d+$/);
    // The pool is icons alone: the level lives on each icon's hover card, never on the icon.
    await expect(ayla.getByTestId('heroes-card-abilities')).not.toContainText(/\d+\/\d+/);
    await expect(ayla.getByTestId('heroes-card-wide-blast')).toHaveCount(0);
    await expect(
      page.getByTestId('heroes-roster-card-board-shelved').getByTestId('heroes-card-wide-blast'),
    ).toHaveCount(1);
  });

  test('the roster summary sits above both presentations, and its top heroes pick like the roster does', async ({
    page,
  }) => {
    await openPlanner(page);
    const summary = page.getByTestId('roster-summary-strip');
    await expect(summary).toBeVisible();
    // The imported account carries no furthest phase, so the cell is left out rather than dashed.
    await expect(summary.getByTestId('roster-summary-max-phase')).toHaveCount(0);

    await showBoard(page);
    await expect(summary).toBeVisible();
    await summary.getByTestId('roster-summary-top-board-nessa').click();

    await expect(page.locator('[data-testid^="heroes-roster-card-"]')).toHaveCount(0);
    await expect(page.getByTestId('heroes-roster-row-board-nessa')).toHaveAttribute('aria-current', 'true');
    await expect(
      page.getByRole('region', { name: /^Current hero$/i }).getByText('Nessa'),
    ).toBeVisible();
  });

  test('below the rail threshold the picker dialog is still the way to choose a hero', async ({
    page,
  }) => {
    await openPlanner(page);
    await page.setViewportSize({ width: 1024, height: 800 });

    await expect(page.locator('[data-testid^="heroes-roster-row-"]').first()).toBeHidden();
    const strip = page.getByRole('region', { name: /^Current hero$/i });
    await strip.getByRole('button', { name: /^Switch hero$/i }).click();
    await expect(page.getByRole('dialog', { name: /^Switch hero$/i })).toBeVisible();
  });

  test('the leaderboard lists every hero, strongest first, and a power header press reverses it', async ({
    page,
  }) => {
    await openPlanner(page);
    await showTable(page);
    const byPower = ['board-ayla', 'board-doran', 'board-shelved', 'board-nessa'];
    expect(await tableIds(page)).toEqual(byPower);
    // The headers order the table, so the toolbar's own sort steps aside while it is shown.
    await expect(page.getByRole('combobox', { name: /^Sort by$/i })).toHaveCount(0);

    const power = page.getByTestId('heroes-leaderboard-sort-power');
    await expect(power).toHaveAttribute('aria-sort', 'descending');
    await power.getByRole('button').click();
    await expect(power).toHaveAttribute('aria-sort', 'ascending');
    expect(await tableIds(page)).toEqual([...byPower].reverse());

    await page.getByRole('button', { name: /^Bench$/ }).click();
    expect(await tableIds(page)).toEqual(['board-shelved']);
  });

  test('picking a row returns to the rail with that hero in the planner', async ({ page }) => {
    await openPlanner(page);
    await showTable(page);
    await page.getByTestId('heroes-leaderboard-row-board-nessa').click();

    await expect(page.locator('[data-testid^="heroes-leaderboard-row-"]')).toHaveCount(0);
    await expect(page.getByTestId('heroes-roster-row-board-nessa')).toHaveAttribute('aria-current', 'true');
    await expect(
      page.getByRole('region', { name: /^Current hero$/i }).getByText('Nessa'),
    ).toBeVisible();
  });

  test('the leaderboard scrolls inside its own frame on a phone rather than widening the page', async ({
    page,
  }) => {
    await openPlanner(page);
    await page.setViewportSize({ width: 380, height: 800 });
    await showTable(page);
    const frame = await page.getByTestId('heroes-leaderboard').evaluate((panel) => {
      const scroller = panel.querySelector('table')?.parentElement;
      return {
        panelRight: panel.getBoundingClientRect().right,
        viewport: document.documentElement.clientWidth,
        scrollerOverflows: scroller ? scroller.scrollWidth > scroller.clientWidth : false,
      };
    });
    expect(frame.panelRight).toBeLessThanOrEqual(frame.viewport);
    expect(frame.scrollerOverflows).toBe(true);
  });
});
