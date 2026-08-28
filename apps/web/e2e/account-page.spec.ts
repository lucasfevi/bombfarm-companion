import { test, expect, type Page } from '@playwright/test';
import {
  gotoAccountPage,
  importedRoster,
  seedLocalStorage,
  type SeededState,
} from './fixtures/seed';

/**
 * A seed of this spec's own rather than a widened `importedRoster`: that fixture is the baseline
 * for the perf captures and for the farm/team-plan specs, and adding `slots`/`fieldSlots` to it
 * would quietly move their numbers.
 *
 * Every identity value here is INVENTED. `player_name`/`account_id` identify a real person on a
 * real export, and the committed corpus scrubs them for exactly that reason.
 */
function accountRoster(lang: 'pt' | 'en'): SeededState {
  const base = importedRoster.account!;
  return {
    ...importedRoster,
    lang,
    account: {
      ...base,
      tree: {
        ...base.tree,
        danoTotal: 2.183,
        squadDmgPct: 85.58,
        geoMult: 1.176,
        luckFlatPct: 18.34,
        xpMult: 1.582,
        fieldSlotsBonus: 8,
        bagTabsBonus: 1,
      },
      // Casa III at level 6 (from `importedRoster.context`), its own slot-ladder value.
      slots: 7,
      fieldSlots: 9,
      maxPhase: 122,
      playerName: 'Tester',
      accountId: '4242',
    },
  };
}

/** The same roster parked on a specific House, for the next-House edge cases. */
function atHouse(lang: 'pt' | 'en', houseIdx: number, houseLevel: number, slots: number): SeededState {
  const seeded = accountRoster(lang);
  return {
    ...seeded,
    account: {
      ...seeded.account!,
      context: { ...seeded.account!.context, houseIdx, houseLevel },
      slots,
      // The captured cycle anchors to the imported house/level; move the picker and it must fall
      // back to the table, which is what these cases are about.
      houseCycleSecs: null,
      houseCycleSecsHouseIdx: null,
      houseCycleSecsLevel: null,
    },
  };
}

function panel(page: Page, heading: RegExp) {
  return page.locator('section').filter({
    has: page.getByRole('heading', { name: heading, level: 2 }),
  });
}

async function openAccount(page: Page, lang: 'pt' | 'en' = 'en') {
  await seedLocalStorage(page, accountRoster(lang));
  await page.goto('/');
  await gotoAccountPage(page);
}

test.describe('account page — identity header', () => {
  test('names the account and both phase figures', async ({ page }) => {
    await openAccount(page, 'en');
    const header = panel(page, /^Account$/i);

    for (const [label, value] of [
      ['Player', 'Tester'],
      ['Account ID', '4242'],
      // The game's own coordinates, not a bare ordinal: importedRoster farms phase 1, and the
      // seeded max is 122.
      ['Current phase', 'Easy 1-1 (#1)'],
      ['Furthest phase', 'Normal 4-12 (#122)'],
    ] as const) {
      // Assert on the fact CELL, not the panel: a value landing under the wrong label would
      // still satisfy `panel.toContainText(value)`.
      const cell = header
        .locator('[data-account-fact]')
        .filter({ has: page.getByText(label, { exact: true }) });
      await expect(cell).toHaveCount(1);
      await expect(cell).toContainText(value);
    }
  });

  test('a save with no identity shows dashes, not a blank header', async ({ page }) => {
    // `importedRoster` predates the identity keys, which is exactly the scrubbed-export shape.
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await gotoAccountPage(page);

    const header = panel(page, /^Account$/i);
    await expect(header.getByText('Player')).toBeVisible();
    await expect(header.getByText('—').first()).toBeVisible();
  });
});

test.describe('account page — House panel', () => {
  test('shows the current House, its level out of 20, cycle and slots', async ({ page }) => {
    await openAccount(page, 'en');
    const house = panel(page, /^House$/i);

    await expect(house).toContainText('House III (Epic)');
    // Casa III level 6 → 960 + (900-960)*5/19 = 944.21s → 15 min 44 s.
    await expect(house).toContainText('15 min 44 s');
    await expect(house).toContainText('6 / 20');
    await expect(house.getByText('7', { exact: true })).toBeVisible();
  });

  test('the next House is a heading plus its gains, shown as green deltas', async ({ page }) => {
    await openAccount(page, 'en');
    const house = panel(page, /^House$/i);

    await expect(
      house.getByRole('heading', { name: /Next House — House IV \(Legendary\)/i }),
    ).toBeVisible();
    // Casa IV base = 840 s = 14 min 0 s, against Casa III level 6's 944 s → 1 min 44 s faster,
    // and its ladder gives 9 slots against 7.
    await expect(house).toContainText('14 min 0 s');
    const faster = house.getByText('−1 min 44 s');
    const moreSlots = house.getByText('+2', { exact: true });
    await expect(faster).toBeVisible();
    await expect(moreSlots).toBeVisible();
    // Green, via the design system's own improvement token — not a hardcoded colour.
    await expect(faster).toHaveClass(/text-up/);
    await expect(moreSlots).toHaveClass(/text-up/);
  });

  test('a delta of zero is omitted rather than shown as +0', async ({ page }) => {
    // Casa IV → Casa V keeps the slot count at 9, so only the cycle improves.
    await seedLocalStorage(page, atHouse('en', 3, 1, 9));
    await page.goto('/');
    await gotoAccountPage(page);
    const house = panel(page, /^House$/i);

    await expect(house.getByText('−3 min 0 s')).toBeVisible();
    await expect(house.getByText('+0', { exact: true })).toHaveCount(0);
    await expect(house.getByText('−0', { exact: true })).toHaveCount(0);
  });

  test('the last House shows no next-House block at all', async ({ page }) => {
    await seedLocalStorage(page, atHouse('en', 4, 20, 9));
    await page.goto('/');
    await gotoAccountPage(page);
    const house = panel(page, /^House$/i);

    await expect(house).toContainText('House V (Mythic)');
    await expect(house.getByRole('heading', { name: /Next House/i })).toHaveCount(0);
  });

  test('PT chrome renders the House panel in Portuguese', async ({ page }) => {
    await openAccount(page, 'pt');
    const house = panel(page, /^Casa$/i);
    await expect(house).toContainText('Casa III (Épico)');
    await expect(house).toContainText('15 min 44 s');
    await expect(house).toContainText('6 / 20');
    await expect(house.getByRole('heading', { name: /Próxima Casa — Casa IV/i })).toBeVisible();
  });
});

test.describe('account page — Skill Tree panel', () => {
  test('shows the two damage factors and their product', async ({ page }) => {
    await openAccount(page, 'en');
    const tree = panel(page, /^Skill Tree$/i);

    await expect(tree).toContainText('Squad damage');
    await expect(tree).toContainText('+85.58%');
    await expect(tree).toContainText('Multiplicative damage');
    await expect(tree).toContainText('×1.176');
    await expect(tree).toContainText('×2.183');
  });

  test('field slots show the tree bonus and the usable total, which differ by one', async ({
    page,
  }) => {
    await openAccount(page, 'en');
    const tree = panel(page, /^Skill Tree$/i);
    await expect(tree).toContainText('+8 (9 total)');
  });

  test('sorts the bonuses into named groups', async ({ page }) => {
    await openAccount(page, 'en');
    const tree = panel(page, /^Skill Tree$/i);

    for (const heading of ['Damage', 'Field', 'Rewards']) {
      await expect(tree.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    // Each group holds the rows it claims — crit sits under Damage, not among the readouts.
    // Located by the list's own aria-label rather than `getByLabel`, which also matches the
    // tooltip triggers whose accessible name starts with the row label.
    await expect(tree.locator('dl[aria-label="Damage"]')).toContainText('Crit chance');
    await expect(tree.locator('dl[aria-label="Field"]')).toContainText('Field slots');
    await expect(tree.locator('dl[aria-label="Rewards"]')).toContainText('Hero XP');
    await expect(tree.locator('dl[aria-label="Damage"]')).not.toContainText('Hero XP');
  });

  test('carries no icons, and every row is exactly the same height', async ({ page }) => {
    await openAccount(page, 'en');
    const tree = panel(page, /^Skill Tree$/i);

    await expect(tree.locator('img')).toHaveCount(0);

    const heights = await tree.locator('dl > div').evaluateAll((rows) =>
      rows.map((row) => Math.round(row.getBoundingClientRect().height)),
    );
    expect(heights.length).toBeGreaterThan(6);
    expect(new Set(heights).size).toBe(1);
  });

  test('carries luck and the XP multiplier, and stays entirely read-only', async ({ page }) => {
    await openAccount(page, 'en');
    const tree = panel(page, /^Skill Tree$/i);

    await expect(tree).toContainText('+18.34 pp');
    await expect(tree).toContainText('×1.582');

    // The whole page is import-sourced facts — no editable control anywhere on it.
    await expect(tree.locator('input')).toHaveCount(0);
    await expect(tree.locator('[data-num]')).toHaveCount(0);
    await expect(tree.locator('[data-select]')).toHaveCount(0);
  });
});

test.describe('account page — what the rework removed', () => {
  test('no farm-phase field, no target-prop picker, no team-buff fields', async ({ page }) => {
    await openAccount(page, 'en');

    await expect(page.getByRole('heading', { name: /^Team buffs$/i })).toHaveCount(0);
    await expect(page.getByText(/^Farm phase$/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /auto-fill/i })).toHaveCount(0);

    // No control of any kind survives on the ACCOUNT panels. Deliberately not scoped to `main`:
    // the planner slot stays mounted (hidden + inert) under the same element while browsing a
    // section page, and its own pickers would answer for this assertion.
    for (const heading of [/^Account$/i, /^House$/i, /^Skill Tree$/i]) {
      const section = panel(page, heading);
      await expect(section.locator('[data-num], [data-select], input, select')).toHaveCount(0);
    }
  });

  test('the planner keeps its own tabs and has no Account tab', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await expect(page.getByRole('tab', { name: /^Account$/i })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /^Gear$/i })).toBeVisible();
  });

  test('no keystone control survives anywhere on the page', async ({ page }) => {
    // Carried over from the retired account-panel spec: the 2026-08-13 patch removed all five
    // keystones, and this is the DOM-level proof that the Account surface grew none back. The
    // page is read-only now, so the switch/checkbox assertions double as a "still no controls"
    // guard.
    for (const lang of ['en', 'pt'] as const) {
      await openAccount(page, lang);
      const main = page.locator('main');
      await expect(main.locator('[data-keystone-control]')).toHaveCount(0);
      await expect(main.locator('[data-switch]')).toHaveCount(0);
      await expect(main.getByRole('switch')).toHaveCount(0);
      await expect(main.getByRole('checkbox')).toHaveCount(0);
      for (const name of [/Abisso/i, /Glass Cannon/i, /Tempo Dobrado/i]) {
        await expect(main.getByLabel(name)).toHaveCount(0);
      }
    }
  });
});
