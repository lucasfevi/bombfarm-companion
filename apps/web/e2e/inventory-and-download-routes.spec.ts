import path from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { importedRoster, seedLocalStorage } from './fixtures/seed';

/** Mirrors `src/shared/lib/inventory-view-storage.ts` — keep in sync. */
const INVENTORY_VIEW_KEY = 'bf-hp-inventory-view-v1';

const IMPORTED_AT = 1_700_000_000_000;

const CAPTURE = path.join(
  process.cwd(),
  '../../packages/domain/tests/fixtures/sheet-math/save-20260819-11882-7heroes.json',
);

/**
 * The display list is a second, wider read of the same import than the optimizer snapshot: it
 * keeps rows the planner cannot use, so it is the only one that can answer whether the Inventory
 * screen groups and filters what a real save carries.
 */
const parsed = parseSaveFile(
  JSON.parse(readFileSync(CAPTURE, 'utf8')) as Record<string, unknown>,
  [],
);
const VIEW_ITEMS = parsed.inventoryView;
const TOTAL_ITEMS = VIEW_ITEMS.length;
const GEM_ITEMS = VIEW_ITEMS.filter((item) => item.kind === 'gem').length;
const KINDS_IN_CAPTURE = ['equipment', 'gem', 'key', 'time', 'stone'];

const REPLICA_HEROES = ['Bellatrix', 'Jon', 'Minato', 'Buff S #1', 'WB #1', 'WB #2'];
const REPLICA_LEVELS = [106, 96, 95, 85, 84, 77];
const DAMAGE_HEROES = ['Bellatrix', 'Jon', 'Minato', 'Buff S #1', 'WB #1'];

async function seedInventory(page: Page): Promise<void> {
  await seedLocalStorage(page, {
    ...importedRoster,
    lang: 'en',
    inventory: { version: 1, importedAt: IMPORTED_AT, items: parsed.inventory },
  });
  await page.addInitScript(
    ({ key, stored }) => {
      localStorage.setItem(key, JSON.stringify(stored));
    },
    { key: INVENTORY_VIEW_KEY, stored: { version: 1, importedAt: IMPORTED_AT, items: VIEW_ITEMS } },
  );
}

function groups(page: Page) {
  return page.getByTestId('inventory-group');
}

function kindsOnScreen(page: Page): Promise<(string | undefined)[]> {
  return groups(page).evaluateAll((sections) =>
    sections.map((section) => (section as HTMLElement).dataset.kind),
  );
}

test.describe('the Inventory route', () => {
  test('groups an imported save by item kind, and a kind chip narrows the screen to that kind alone', async ({
    page,
  }) => {
    await seedInventory(page);
    await page.goto('/');
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /^inventory$|^inventário$/i })
      .click();
    await expect(page).toHaveURL(/\/inventory/);

    await expect(groups(page)).toHaveCount(KINDS_IN_CAPTURE.length);
    expect(await kindsOnScreen(page)).toEqual(KINDS_IN_CAPTURE);
    await expect(
      page.getByText(new RegExp(`^${String(TOTAL_ITEMS)} (of|de) ${String(TOTAL_ITEMS)}$`)),
    ).toBeVisible();

    const gemChip = page.getByRole('button', { name: /^(Gems|Gemas)$/ });
    await expect(gemChip).toHaveAttribute('aria-pressed', 'false');
    await gemChip.click();

    await expect(gemChip).toHaveAttribute('aria-pressed', 'true');
    expect(await kindsOnScreen(page)).toEqual(['gem']);
    await expect(
      page.getByText(new RegExp(`^${String(GEM_ITEMS)} (of|de) ${String(TOTAL_ITEMS)}$`)),
    ).toBeVisible();
  });
});

/**
 * The drawing is hidden from assistive technology on purpose — it carries sample numbers — so it
 * is reached through the mark its own chrome draws rather than by role.
 */
function liveReplica(page: Page) {
  return page.locator('[aria-hidden="true"]').filter({ has: page.getByTestId('replica-live-mark') });
}

test.describe('the Download route', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/download');
  });

  test("the Live replica draws the sample session's own roster and phase, not an empty frame", async ({
    page,
  }) => {
    const replica = liveReplica(page);
    await expect(replica).toHaveCount(1);

    const heroesCard = replica.getByTestId('replica-live-heroes');
    for (const name of REPLICA_HEROES) {
      await expect(heroesCard.getByText(name, { exact: true })).toBeVisible();
    }
    for (const level of REPLICA_LEVELS) {
      await expect(heroesCard.getByText(new RegExp(`^(Lv|Nv) ${String(level)}$`))).toBeVisible();
    }
    await expect(replica.getByText('#126', { exact: true })).toBeVisible();
  });

  test("the Live replica's Damage card lists the sample roster's heroes with the Unattributed row last", async ({
    page,
  }) => {
    const card = liveReplica(page).getByTestId('replica-live-damage');
    await expect(card).toBeVisible();
    await expect(card.getByText('Damage', { exact: true })).toBeVisible();

    for (const name of DAMAGE_HEROES) {
      await expect(card.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(card.getByText('Unattributed', { exact: true })).toBeVisible();

    const rows = await card.getByText(/^(Bellatrix|Jon|Minato|Buff S #1|WB #1|Unattributed)$/).allTextContents();
    expect(rows).toEqual([...DAMAGE_HEROES, 'Unattributed']);
  });

  test('switching the Heroes panel on redraws the compact window with the same roster', async ({
    page,
  }) => {
    const miniWindow = page.getByTestId('download-mini-window');
    await expect(miniWindow).toBeVisible();
    for (const name of REPLICA_HEROES) {
      await expect(miniWindow.getByText(name, { exact: true })).toHaveCount(0);
    }

    const heroesSwitch = page.getByRole('switch', { name: /^(Heroes|Heróis)$/ });
    await expect(heroesSwitch).toHaveAttribute('aria-checked', 'false');
    await heroesSwitch.click();

    await expect(heroesSwitch).toHaveAttribute('aria-checked', 'true');
    for (const name of REPLICA_HEROES) {
      await expect(miniWindow.getByText(name, { exact: true })).toBeVisible();
    }
    await expect(miniWindow.getByText('#126', { exact: true })).toBeVisible();
  });
});
