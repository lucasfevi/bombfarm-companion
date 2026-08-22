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
      ['Current phase', '1'],
      ['Furthest phase', '122'],
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

  test('previews what the next House buys, at its own level 1', async ({ page }) => {
    await openAccount(page, 'en');
    const house = panel(page, /^House$/i);

    await expect(house).toContainText('House IV (Legendary)');
    // Casa IV base = 840 s = 14 min 0 s, and its slot-ladder value is 9.
    await expect(house).toContainText('14 min 0 s');
    await expect(house.getByText('9', { exact: true })).toBeVisible();
  });

  test('PT chrome renders the House panel in Portuguese', async ({ page }) => {
    await openAccount(page, 'pt');
    const house = panel(page, /^Casa$/i);
    await expect(house).toContainText('Casa III (Épico)');
    await expect(house).toContainText('15 min 44 s');
    await expect(house).toContainText('6 / 20');
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

  test('no keystone control survives anywhere on the page (MSC-01)', async ({ page }) => {
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
