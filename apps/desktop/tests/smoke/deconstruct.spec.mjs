import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { switchLanguage } from './shell-control.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');

/**
 * The Deconstruct page, drawn by the real app on the offline fixture account. A real burn cannot
 * start here — main refuses a write against a fixture account, and the page says so on its Burn
 * button before it is ever pressed — so the page is proved in two halves. Everything that does not
 * need a server is driven through the UI: the switch between the Forge tab's two pages, the
 * filters, ticking, Add all, Fill and Clear, and the reason Burn gives. A burn's outcome
 * arrives through `deconstruct:inject`, the test-only channel that replays a scripted event down
 * the same `deconstruct:event` seam the real service uses, the way `forge-run.spec.mjs` drives the
 * forge rail. The injector removes nothing from the fixture account, so the list does not shrink
 * when a burn "lands"; what is proved is the page's side of the seam.
 *
 * The counts below are the committed fixture's: 228 items the game could burn, of which 139 can be
 * ticked (89 are worn or locked), 29 of those forged, 14 Common, 2 gems, 5 closed chests and cages
 * (3 of them Common or Uncommon, which Fill still leaves alone). Regenerating the fixture moves
 * them, and this spec should fail when it does.
 */
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');
const PT_BR_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'pt-BR.ts');
const copyFileCache = new Map();

function readCopyValue(filePath, key) {
  let source = copyFileCache.get(filePath);
  if (source === undefined) {
    source = fs.readFileSync(filePath, 'utf8');
    copyFileCache.set(filePath, source);
  }
  const match = source.match(new RegExp(`\\b${key}:\\s*(?:'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)")`));
  if (!match) {
    throw new Error(`deconstruct.spec.mjs: could not find copy key "${key}" in ${filePath}`);
  }
  return match[1] ?? match[2];
}

const en = (key) => readCopyValue(EN_COPY_PATH, key);
const pt = (key) => readCopyValue(PT_BR_COPY_PATH, key);

const CENSUS = {
  listed: 228,
  burnable: 139,
  forged: 29,
  common: 14,
  uncommon: 60,
  gems: 2,
  chests: 5,
  chestsBelowRare: 3,
  batchCap: 100,
};
const COMMON = 0;
const EPIC = 3;

/** The table's width at the longest forged name the game can print, and what the batch column
 *  leaves out of the split for it: that width plus the gap between the two. */
const TABLE_MIN_WIDTH = 738;
const BATCH_COLUMN_RESERVE = TABLE_MIN_WIDTH + 12;

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

async function launchApp(env, extraArgs = []) {
  const app = await electron.launch({
    executablePath: electronExecutable(),
    args: [desktopRoot, ...extraArgs],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      ELECTRON_ENABLE_LOGGING: '1',
      BFC_GAME_PROCESS: 'bfc-smoke-no-such-process.exe',
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      ...env,
    },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  return { app, page };
}

async function acceptConsent(page) {
  const modal = page.getByTestId('consent-modal');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(modal).toBeHidden({ timeout: 15_000 });
}

async function openForgeTab(page) {
  await page.getByRole('button', { name: 'Forge', exact: true }).click();
  await expect(page.getByTestId('forge-page')).toBeVisible({ timeout: 20_000 });
}

async function openDeconstruct(page) {
  await openForgeTab(page);
  await page.getByRole('tab', { name: 'Deconstruct' }).click();
  await expect(page.getByTestId('deconstruct-view')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('inventory-table-row').first()).toBeVisible({ timeout: 20_000 });
}

async function withApp(run, { args = [], open = true } = {}) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-deconstruct-'));
  try {
    const { app, page } = await launchApp(
      {
        BFC_GAME_READER: 'fixture',
        BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_OFFLINE_FIXTURE,
        BFC_USER_DATA_DIR: userDataDir,
      },
      args,
    );
    try {
      await acceptConsent(page);
      if (open) await openDeconstruct(page);
      await run(page, app);
      await app.close();
    } finally {
      await app.close().catch(() => undefined);
    }
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

const rowsOf = (page) => page.getByTestId('inventory-table-row');
const openRows = (page) => page.locator('[data-testid="inventory-table-row"]:not([aria-disabled="true"])');
const countText = (page) => page.getByTestId('deconstruct-result-count');
const selectedText = (page) => page.getByTestId('deconstruct-selected');

async function resizeWindow(app, page, width, height) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setMinimumSize(200, 200);
    win?.setSize(size.width, size.height);
  }, { width, height });
  await page.waitForTimeout(600);
}

/** The batch's group rows as [group id, label, count], in the order the table draws them. */
function groupRows(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="deconstruct-group-row"]')].map((row) => [
      row.getAttribute('data-group'),
      row.textContent,
      Number(row.closest('div')?.querySelector('dd')?.textContent?.replace(/[^\d]/g, '')),
    ]),
  );
}

function kindChip(page, kind) {
  return page.locator(`[data-testid="deconstruct-kind-chip"][data-kind="${kind}"]`);
}

function rarityChip(page, rarity) {
  return page.locator(`[data-testid="deconstruct-rarity-chip"][data-rarity="${String(rarity)}"]`);
}

/** The Essence column is the last cell of a row. */
async function essenceOf(row) {
  const text = await row.locator('td').last().innerText();
  return Number(text.replace(/[^\d]/g, ''));
}

function figure(text) {
  return Number(text.replace(/[^\d]/g, ''));
}

async function pickRows(page, count) {
  const ids = [];
  let total = 0;
  const rows = openRows(page);
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    ids.push(await row.getAttribute('data-item-id'));
    total += await essenceOf(row);
    await row.click();
  }
  return { ids, total };
}

function inject(page, events) {
  return page.evaluate((scripted) => window.bfc.invoke('deconstruct:inject', { events: scripted }), events);
}

function burned(runId, itemIds, gained, essence) {
  return { type: 'done', runId, itemIds, result: { status: 'burned', burned: itemIds.length, gained, essence } };
}

function refused(runId, itemIds, code) {
  return { type: 'done', runId, itemIds, result: { status: 'refused', code } };
}

function failed(runId, itemIds, reason) {
  return { type: 'done', runId, itemIds, result: { status: 'failed', reason } };
}

/** Boxes in page coordinates — down the page, not down the viewport, so a scroll of `<main>`
 *  moves nothing that was measured. */
function boxesOf(page, testIds) {
  return page.evaluate((ids) => {
    const scrolled = document.querySelector('main')?.scrollTop ?? 0;
    return Object.fromEntries(
      ids.map((id) => {
        const element = document.querySelector(`[data-testid="${id}"]`);
        if (element === null) return [id, null];
        const box = element.getBoundingClientRect();
        return [
          id,
          {
            x: Math.round(box.left),
            y: Math.round(box.top + scrolled),
            width: Math.round(box.width),
            height: Math.round(box.height),
          },
        ];
      }),
    );
  }, testIds);
}

/** Everything a band or a new group row could push: the toolbar and the list above and beside
 *  it, the batch panel, and the Burn button the group table sits above. */
const STEADY = ['deconstruct-toolbar', 'deconstruct-list-panel', 'deconstruct-batch-panel', 'deconstruct-burn'];

/**
 * `listMayGrow` is for the result band, the one thing that adds height to the column beside the
 * list: on a window with no spare height the row they share grows to hold it, so the list may end
 * lower — but it never starts elsewhere, is never narrower, and never loses a row.
 */
async function expectNothingMoved(page, before, what, { listMayGrow = false } = {}) {
  const after = await boxesOf(page, STEADY);
  for (const id of STEADY) {
    if (listMayGrow && id === 'deconstruct-list-panel') {
      expect(after[id], `${id} moved or narrowed when ${what}`).toMatchObject({
        x: before[id].x,
        y: before[id].y,
        width: before[id].width,
      });
      expect(after[id].height, `${id} shrank when ${what}`).toBeGreaterThanOrEqual(before[id].height);
      continue;
    }
    expect(after[id], `${id} moved or resized when ${what}`).toEqual(before[id]);
  }
}

test.describe('deconstruct smoke', () => {
  test('opens the Forge tab on Forge, switches to Deconstruct and back, and the Forge page still works', async () => {
    await withApp(
      async (page) => {
        await openForgeTab(page);
        await expect(page.getByTestId('forge-page')).toHaveAttribute('data-page', 'forge');
        await expect(page.getByTestId('forge-view')).toBeVisible();
        await expect(page.getByTestId('deconstruct-view')).toHaveCount(0);
        await expect(page.getByRole('tab', { name: 'Forge', selected: true })).toBeVisible();
        await page.waitForSelector('[data-testid="inventory-table-row"]', { timeout: 20_000 });

        await page.getByRole('tab', { name: 'Deconstruct' }).click();
        await expect(page.getByTestId('forge-page')).toHaveAttribute('data-page', 'deconstruct');
        await expect(page.getByTestId('deconstruct-view')).toBeVisible();
        await expect(page.getByTestId('forge-view')).toHaveCount(0);
        await expect(page.getByRole('tab', { name: 'Deconstruct', selected: true })).toBeVisible();

        await page.getByRole('button', { name: 'Inventory', exact: true }).click();
        await expect(page.getByTestId('forge-page')).toHaveCount(0);
        await openForgeTab(page);
        await expect(page.getByTestId('forge-page')).toHaveAttribute('data-page', 'deconstruct');

        await page.getByRole('tab', { name: 'Forge' }).click();
        await expect(page.getByTestId('forge-view')).toBeVisible();
        await expect(page.getByTestId('deconstruct-view')).toHaveCount(0);
        await page.waitForSelector('[data-testid="inventory-table-row"]', { timeout: 20_000 });
        await page.getByTestId('inventory-table-row').first().click();
        await expect(page.getByTestId('forge-item-panel')).toHaveAttribute('data-state', 'item');
      },
      { open: false },
    );
  });

  test('lists only what can be burned, refuses a blocked row, and narrows on every filter with the count following', async () => {
    await withApp(async (page) => {
      const count = countText(page);
      await expect(count).toHaveText(`${String(CENSUS.burnable)} of ${String(CENSUS.listed)}`);
      await expect(page.locator('[data-testid="inventory-table-row"][aria-disabled="true"]')).toHaveCount(0);

      // Showing what cannot be burned lists it dimmed, and ticking it does nothing.
      await page.getByTestId('deconstruct-hide-unburnable').click();
      await expect(count).toHaveText(`${String(CENSUS.listed)} of ${String(CENSUS.listed)}`);
      const blocked = page.locator('[data-testid="inventory-table-row"][aria-disabled="true"]').first();
      await expect(blocked).toBeVisible();
      await blocked.click({ force: true });
      await expect(selectedText(page)).toHaveText(`0 of ${String(CENSUS.batchCap)}`);
      await expect(blocked.locator('[role="checkbox"]')).toHaveAttribute('aria-checked', 'false');
      await page.getByTestId('deconstruct-hide-unburnable').click();
      await expect(count).toHaveText(`${String(CENSUS.burnable)} of ${String(CENSUS.listed)}`);

      await expect(page.getByTestId('deconstruct-clear-filter')).toHaveCount(0);

      await kindChip(page, 'gem').click();
      await expect(count).toHaveText(`${String(CENSUS.gems)} of ${String(CENSUS.listed)}`);
      await expect(page.getByTestId('deconstruct-clear-filter')).toBeVisible();
      await kindChip(page, 'gem').click();
      await expect(count).toHaveText(`${String(CENSUS.burnable)} of ${String(CENSUS.listed)}`);

      await kindChip(page, 'chest').click();
      await expect(count).toHaveText(`${String(CENSUS.chests)} of ${String(CENSUS.listed)}`);
      await kindChip(page, 'chest').click();
      await expect(count).toHaveText(`${String(CENSUS.burnable)} of ${String(CENSUS.listed)}`);

      await rarityChip(page, COMMON).click();
      await expect(count).toHaveText(`${String(CENSUS.common)} of ${String(CENSUS.listed)}`);
      await rarityChip(page, COMMON).click();

      await page.getByTestId('deconstruct-hide-forged').click();
      await expect(count).toHaveText(`${String(CENSUS.burnable - CENSUS.forged)} of ${String(CENSUS.listed)}`);
      await page.getByTestId('deconstruct-hide-forged').click();
      await expect(count).toHaveText(`${String(CENSUS.burnable)} of ${String(CENSUS.listed)}`);

      await page.getByRole('searchbox', { name: en('deconstructSearchLabel') }).fill('ring');
      await expect(count).not.toHaveText(`${String(CENSUS.burnable)} of ${String(CENSUS.listed)}`);
      const names = await rowsOf(page).allInnerTexts();
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) expect(name.toLowerCase()).toContain('ring');

      await page.getByTestId('deconstruct-clear-filter').click();
      await expect(count).toHaveText(`${String(CENSUS.burnable)} of ${String(CENSUS.listed)}`);
      await expect(page.getByTestId('deconstruct-clear-filter')).toHaveCount(0);
      await expect(page.getByTestId('deconstruct-level-range')).toBeVisible();
      await expect(page.getByTestId('deconstruct-forge-ceiling')).toBeVisible();
    });
  });

  test('totals the batch as rows are ticked, warns about forged and Epic pieces, and has Add all, Fill and Clear obey the cap and the filters', async () => {
    await withApp(async (page, app) => {
      await resizeWindow(app, page, 1440, 900);
      const selected = selectedText(page);
      const essence = page.getByTestId('deconstruct-essence');
      const balance = figure(await page.getByTestId('deconstruct-balance').innerText());
      expect(balance).toBeGreaterThan(0);

      const { total } = await pickRows(page, 3);
      await expect(selected).toHaveText(`3 of ${String(CENSUS.batchCap)}`);
      expect(figure(await essence.innerText())).toBe(total);
      expect(figure(await page.getByTestId('deconstruct-balance-after').innerText())).toBe(balance + total);

      await page.getByTestId('deconstruct-clear').click();
      await expect(selected).toHaveText(`0 of ${String(CENSUS.batchCap)}`);
      await expect(essence).toHaveText('+0');

      // The group table grows a row per kind and rarity, and the Burn button never moves.
      await expect(page.getByTestId('deconstruct-group-row')).toHaveCount(0);
      const quiet = await boxesOf(page, STEADY);

      const forgedRow = rowsOf(page).filter({ hasText: /\+\d+/ }).first();
      await forgedRow.click();
      await expect(page.getByTestId('deconstruct-group-row')).toHaveCount(1);
      await expectNothingMoved(page, quiet, 'a forged piece was ticked');
      await forgedRow.click();
      await expect(page.getByTestId('deconstruct-group-row')).toHaveCount(0);

      await rarityChip(page, EPIC).click();
      const quietAgain = await boxesOf(page, STEADY);
      await rowsOf(page).first().click();
      const [epicRow] = await groupRows(page);
      expect(epicRow?.[0]).toBe(`equipment:${String(EPIC)}`);
      expect(epicRow?.[1]).toContain('Epic');
      expect(epicRow?.[2]).toBe(1);
      await expectNothingMoved(page, quietAgain, 'an Epic piece was ticked');
      await page.getByTestId('deconstruct-clear').click();
      await rarityChip(page, EPIC).click();

      // Add all takes the first hundred of the burnable rows and says the rest did not fit; its
      // label counts what it would add, and it lives in the list header, not the batch panel.
      const addAll = page.getByTestId('deconstruct-select-shown');
      await expect(page.getByTestId('deconstruct-toolbar').getByTestId('deconstruct-select-shown')).toHaveCount(1);
      await expect(addAll).toHaveText(en('deconstructAddAll').replace('{count}', String(CENSUS.burnable)));
      await addAll.click();
      await expect(addAll).toHaveText(en('deconstructAddAll').replace('{count}', String(CENSUS.burnable - CENSUS.batchCap)));
      await expect(selected).toHaveText(`${String(CENSUS.batchCap)} of ${String(CENSUS.batchCap)}`);
      await expect(page.getByTestId('deconstruct-hint')).toHaveText(
        `${String(CENSUS.burnable - CENSUS.batchCap)} more did not fit under the limit of ${String(CENSUS.batchCap)}.`,
      );
      await page.getByTestId('deconstruct-clear').click();
      await expect(page.getByTestId('deconstruct-hint')).toHaveText('');

      // Fill tops up with Common and Uncommon only, and never with a chest or a cage.
      const filled = CENSUS.common + CENSUS.uncommon - CENSUS.chestsBelowRare;
      await page.getByTestId('deconstruct-fill').click();
      await expect(selected).toHaveText(`${String(filled)} of ${String(CENSUS.batchCap)}`);
      await page.getByTestId('deconstruct-selected-only').click();
      await expect(countText(page)).toHaveText(`${String(filled)} of ${String(CENSUS.listed)}`);
      for (const text of await rowsOf(page).allInnerTexts()) {
        expect(text).toMatch(/Common|Uncommon/);
        expect(text).not.toMatch(/\b(Rare|Epic|Mythic)\b/);
        expect(text).not.toMatch(/Item chest|Gem chest|Hero cage/);
      }
      await page.getByTestId('deconstruct-selected-only').click();

      await page.getByTestId('deconstruct-clear').click();
      await expect(selected).toHaveText(`0 of ${String(CENSUS.batchCap)}`);
    });
  });

  test('draws the ticked items as tiles in the batch, opens an item card on hover and takes one out with its corner mark', async () => {
    await withApp(async (page, app) => {
      await resizeWindow(app, page, 1440, 900);
      const tiles = page.getByTestId('deconstruct-batch-tile');
      await expect(tiles).toHaveCount(0);
      await expect(page.getByTestId('deconstruct-batch-empty')).toBeVisible();
      const quiet = await boxesOf(page, STEADY);
      const region = await boxesOf(page, ['deconstruct-batch-tiles']);

      const { ids } = await pickRows(page, 3);
      await expect(tiles).toHaveCount(3);
      await expect(page.getByTestId('deconstruct-batch-empty')).toHaveCount(0);
      expect(await tiles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-item-id')))).toEqual(ids);
      await expectNothingMoved(page, quiet, 'three rows were ticked');
      const grown = await boxesOf(page, ['deconstruct-batch-tiles']);
      expect(grown['deconstruct-batch-tiles'], 'the tile region keeps its place and gives height to the group table').toMatchObject({
        x: region['deconstruct-batch-tiles'].x,
        y: region['deconstruct-batch-tiles'].y,
        width: region['deconstruct-batch-tiles'].width,
      });
      expect(grown['deconstruct-batch-tiles'].height).toBeLessThanOrEqual(region['deconstruct-batch-tiles'].height);

      const trigger = tiles.nth(1).locator('[data-peek="item"]');
      await trigger.hover();
      await page.mouse.move(0, 0, { steps: 1 });
      await trigger.hover({ position: { x: 4, y: 4 } });
      await expect(page.locator('[data-peek-card="item"]')).toBeVisible();

      const forgedRow = rowsOf(page).filter({ hasText: /\+\d+/ }).first();
      await forgedRow.click();
      await expect(tiles).toHaveCount(4);
      const corner = await page.evaluate(() => {
        const rectOf = (node) => {
          const box = node.getBoundingClientRect();
          return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
        };
        const region = rectOf(document.querySelector('[data-testid="deconstruct-batch-tiles"]'));
        return [...document.querySelectorAll('[data-testid="deconstruct-batch-tile"]')].map((tile, index, all) => {
          const mark = tile.querySelector('[data-testid="deconstruct-batch-remove"]');
          const icon = tile.querySelector('[data-peek="item"]');
          const badge = tile.querySelector('[data-slot="item-upgrade"]');
          const next = all[index + 1];
          return {
            mark: rectOf(mark),
            icon: rectOf(icon),
            badge: badge === null ? null : rectOf(badge),
            next: next === undefined || Math.abs(next.getBoundingClientRect().top - tile.getBoundingClientRect().top) > 1 ? null : rectOf(next),
            region,
            background: getComputedStyle(mark).backgroundColor,
            border: getComputedStyle(mark).borderTopWidth,
          };
        });
      });
      for (const tile of corner) {
        expect(tile.mark.right, 'the mark reaches past the icon at the right').toBeGreaterThan(tile.icon.right);
        expect(tile.mark.top, 'the mark reaches past the icon at the top').toBeLessThan(tile.icon.top);
        expect(tile.mark.right - tile.mark.left, 'the mark keeps a 20px hit target').toBeGreaterThanOrEqual(20);
        expect(tile.mark.bottom - tile.mark.top).toBeGreaterThanOrEqual(20);
        expect(tile.mark.right, 'the mark is not clipped by the region').toBeLessThanOrEqual(tile.region.right);
        expect(tile.mark.top).toBeGreaterThanOrEqual(tile.region.top);
        if (tile.next !== null) expect(tile.next.left, 'the mark stays off the next tile').toBeGreaterThanOrEqual(tile.mark.right - 0.5);
        if (tile.badge !== null) expect(tile.mark.bottom, 'the mark stays above the forge badge').toBeLessThanOrEqual(tile.badge.top);
        expect(tile.background).toBe('rgba(0, 0, 0, 0)');
        expect(tile.border).toBe('0px');
      }
      expect(corner.some((tile) => tile.badge !== null)).toBe(true);
      await forgedRow.click();
      await expect(tiles).toHaveCount(3);

      await tiles.nth(1).getByTestId('deconstruct-batch-remove').click();
      await expect(tiles).toHaveCount(2);
      expect(await tiles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-item-id')))).toEqual([ids[0], ids[2]]);
      await expect(selectedText(page)).toHaveText(`2 of ${String(CENSUS.batchCap)}`);
      await expectNothingMoved(page, quiet, 'a tile was removed');

      await tiles.first().getByTestId('deconstruct-batch-remove').focus();
      await page.keyboard.press('Enter');
      await expect(tiles).toHaveCount(1);
      await expect(tiles.first()).toHaveAttribute('data-item-id', ids[2]);
      await tiles.first().getByTestId('deconstruct-batch-remove').focus();
      await page.keyboard.press('Space');
      await expect(tiles).toHaveCount(0);
      await expect(page.getByTestId('deconstruct-batch-empty')).toBeVisible();
      await expectNothingMoved(page, quiet, 'the last tile was removed');
    });
  });

  test('groups the batch by kind and rarity, caps the table at six rows with its own scroll, and keeps Burn and the tiles in place as rows arrive', async () => {
    await withApp(async (page, app) => {
      await resizeWindow(app, page, 1440, 900);
      const table = page.getByTestId('deconstruct-batch-groups');
      const rowCount = () => page.getByTestId('deconstruct-group-row').count();
      const quiet = await boxesOf(page, STEADY);
      const empty = await boxesOf(page, ['deconstruct-batch-groups']);
      expect(empty['deconstruct-batch-groups']?.height, 'an empty table keeps only its rule').toBeLessThanOrEqual(2);

      await kindChip(page, 'chest').click();
      await page.getByTestId('deconstruct-select-shown').click();
      await kindChip(page, 'chest').click();
      await expect(selectedText(page)).toHaveText(`${String(CENSUS.chests)} of ${String(CENSUS.batchCap)}`);
      const afterChests = await groupRows(page);
      expect(afterChests.reduce((sum, row) => sum + row[2], 0)).toBe(CENSUS.chests);
      for (const [id, label] of afterChests) {
        expect(id).toMatch(/^chest:/);
        expect(label).toMatch(/chest|cage/i);
      }
      await expectNothingMoved(page, quiet, 'the chests and cages were added');

      for (const rarity of [0, 1, 2, 3, 4, 5]) {
        if ((await rarityChip(page, rarity).count()) === 0) continue;
        await rarityChip(page, rarity).click();
        if (await page.getByTestId('deconstruct-select-shown').isEnabled()) await page.getByTestId('deconstruct-select-shown').click();
        await rarityChip(page, rarity).click();
        await expectNothingMoved(page, quiet, `rarity ${String(rarity)} was added`);
      }

      const rows = await groupRows(page);
      expect(rows.length).toBeGreaterThan(6);
      const counts = rows.map((row) => row[2]);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
      expect(rows.reduce((sum, row) => sum + row[2], 0)).toBe(Number((await selectedText(page).innerText()).split(' ')[0]));
      expect(await rowCount()).toBe(rows.length);

      const metrics = await table.evaluate((node) => ({
        client: node.clientHeight,
        scroll: node.scrollHeight,
        rowHeight: node.querySelector('dl > div')?.getBoundingClientRect().height ?? 0,
        align: getComputedStyle(node.querySelector('dd')).textAlign,
        numeric: getComputedStyle(node.querySelector('dd')).fontVariantNumeric,
      }));
      expect(metrics.scroll, 'the table scrolls on its own').toBeGreaterThan(metrics.client);
      expect(metrics.client, 'six rows are visible').toBeLessThanOrEqual(metrics.rowHeight * 6 + 8);
      expect(metrics.client).toBeGreaterThanOrEqual(metrics.rowHeight * 5);
      expect(metrics.align).toBe('right');
      expect(metrics.numeric).toContain('tabular-nums');

      await page.getByTestId('deconstruct-clear').click();
      await expect(page.getByTestId('deconstruct-group-row')).toHaveCount(0);
      await expectNothingMoved(page, quiet, 'the batch was cleared');
    });
  });

  test('keeps Burn disabled on a fixture account and gives the fixture as the reason whatever else is true', async () => {
    await withApp(async (page) => {
      const burn = page.getByTestId('deconstruct-burn');
      const reason = page.getByTestId('deconstruct-burn-reason');

      // Nothing ticked and the write switch off would each give a reason of their own; the fixture
      // outranks both, so it is the one a reader sees.
      await expect(burn).toBeDisabled();
      await expect(burn).toHaveAttribute('data-reason', 'fixture');
      await expect(reason).toHaveText(en('deconstructReasonFixture'));

      await rowsOf(page).first().click();
      await expect(selectedText(page)).toHaveText(`1 of ${String(CENSUS.batchCap)}`);
      await expect(burn).toBeDisabled();
      await expect(burn).toHaveAttribute('data-reason', 'fixture');

      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      const forgeSwitch = page.getByRole('switch', { name: en('settingsForgeWritesLabel') });
      await expect(forgeSwitch).toBeVisible({ timeout: 15_000 });
      await forgeSwitch.click();
      await expect(forgeSwitch).toHaveAttribute('aria-checked', 'true');

      await openForgeTab(page);
      await expect(page.getByTestId('deconstruct-view')).toBeVisible();
      await expect(selectedText(page)).toHaveText(`1 of ${String(CENSUS.batchCap)}`);
      await expect(page.getByTestId('deconstruct-burn')).toBeDisabled();
      await expect(page.getByTestId('deconstruct-burn')).toHaveAttribute('data-reason', 'fixture');
      await expect(page.getByTestId('deconstruct-burn-reason')).toHaveText(en('deconstructReasonFixture'));
    });
  });

  test('draws a burned, a refused and an unconfirmed result from the injected seam without moving anything, and keeps it across another tab', async () => {
    await withApp(async (page) => {
      const slot = page.getByTestId('deconstruct-result-slot');
      const result = page.getByTestId('deconstruct-result');
      await expect(result).toHaveCount(0);

      const { ids } = await pickRows(page, 2);
      await expect(selectedText(page)).toHaveText(`2 of ${String(CENSUS.batchCap)}`);
      const balance = figure(await page.getByTestId('deconstruct-balance').innerText());
      const before = await boxesOf(page, STEADY);

      expect(await inject(page, [burned('smoke-burned', ids, 3_400, balance + 3_400)])).toEqual({ ok: true });
      await expect(result).toHaveAttribute('data-outcome', 'burned');
      await expect(result).toContainText('Burned 2 items: +3,400 Forge Essence');
      await expect(result).toContainText(`Forge Essence now: ${(balance + 3_400).toLocaleString('en-US')}`);
      await expect(selectedText(page)).toHaveText(`0 of ${String(CENSUS.batchCap)}`);
      await page.waitForTimeout(400);
      await expect(slot.getByTestId('deconstruct-done')).toBeVisible();
      await expectNothingMoved(page, before, 'a burned result opened', { listMayGrow: true });

      await page.getByTestId('deconstruct-done').click();
      await expect(result).toHaveCount(0);
      await expectNothingMoved(page, before, 'the result was dismissed');

      expect(await inject(page, [refused('smoke-refused', ids, 'ITEM_EQUIPPED')])).toEqual({ ok: true });
      await expect(result).toHaveAttribute('data-outcome', 'refused');
      await expect(result).toContainText(en('deconstructResultRefused'));
      await expect(result).toContainText(en('deconstructBlockEquipped'));
      await page.waitForTimeout(400);
      await expectNothingMoved(page, before, 'a refused result opened', { listMayGrow: true });

      // The result outlives a look at another screen, and the page it was on is the one returned to.
      await page.getByRole('button', { name: 'Inventory', exact: true }).click();
      await expect(page.getByTestId('deconstruct-view')).toHaveCount(0);
      await openForgeTab(page);
      await expect(page.getByTestId('forge-page')).toHaveAttribute('data-page', 'deconstruct');
      await expect(page.getByTestId('deconstruct-result')).toHaveAttribute('data-outcome', 'refused');
      await expect(page.getByTestId('deconstruct-result')).toContainText(en('deconstructBlockEquipped'));
      await page.getByTestId('deconstruct-done').click();

      expect(await inject(page, [failed('smoke-failed', ids, 'network')])).toEqual({ ok: true });
      await expect(result).toHaveAttribute('data-outcome', 'failed');
      await expect(result).toContainText(en('deconstructResultFailed'));
      await expect(result).toContainText(en('deconstructFailedNetwork'));
      await page.getByTestId('deconstruct-done').click();
      await expect(result).toHaveCount(0);
    });
  });

  test('keeps every batch label on one line in both languages, and gives the batch column what the table can spare', async () => {
    await withApp(async (page, app) => {
      const wrapped = () =>
        page.evaluate(() => {
          const lines =
            '[data-testid="deconstruct-batch-panel"] dt, [data-testid="deconstruct-hidden-note"], [data-testid="deconstruct-burn-reason"]';
          return [...document.querySelectorAll(lines)]
            .filter((element) => element.getBoundingClientRect().height > parseFloat(getComputedStyle(element).lineHeight) * 1.5)
            .map((element) => element.textContent);
        });
      const overflowing = () =>
        page.evaluate(() =>
          ['inventory-table-scroll', 'deconstruct-batch-panel'].filter((id) => {
            const element = document.querySelector(`[data-testid="${id}"]`);
            return element !== null && element.scrollWidth > element.clientWidth + 1;
          }),
        );

      for (const width of [1500, 1250, 1100]) {
        await app.evaluate(({ BrowserWindow }, size) => {
          const win = BrowserWindow.getAllWindows()[0];
          win?.setMinimumSize(200, 200);
          win?.setSize(size, 900);
        }, width);
        await page.waitForTimeout(600);
        const split = await page.getByTestId('deconstruct-split').boundingBox();
        const aside = await page.getByTestId('deconstruct-aside').boundingBox();
        const list = await page.getByTestId('deconstruct-list-panel').boundingBox();
        const spare = Math.min(540, Math.max(372, Math.round(split?.width ?? 0) - BATCH_COLUMN_RESERVE));
        const expected = width === 1100 ? 316 : spare;
        expect(Math.round(aside?.width ?? 0), `aside width at ${String(width)}`).toBe(expected);
        if (width !== 1100) {
          expect(Math.round(list?.width ?? 0), `list width at ${String(width)}`).toBeGreaterThanOrEqual(TABLE_MIN_WIDTH - 1);
        }

        await switchLanguage(page, 'en');
        await expect(page.getByTestId('deconstruct-selected')).toHaveText(`0 of ${String(CENSUS.batchCap)}`);
        expect(await wrapped(), `English labels wrapped at ${String(width)}`).toEqual([]);
        expect(await overflowing(), `English overflow at ${String(width)}`).toEqual([]);
        await switchLanguage(page, 'pt');
        await expect(page.getByTestId('deconstruct-selected')).toHaveText(`0 de ${String(CENSUS.batchCap)}`);
        expect(await wrapped(), `Portuguese labels wrapped at ${String(width)}`).toEqual([]);
        expect(await overflowing(), `Portuguese overflow at ${String(width)}`).toEqual([]);
        await switchLanguage(page, 'en');
      }
    });
  });

  test('gives the batch tiles the height the window has, and keeps Burn in view', async () => {
    await withApp(async (page, app) => {
      const settle = (width, height) => resizeWindow(app, page, width, height);
      const tileRows = () =>
        page.evaluate(() => {
          const region = document.querySelector('[data-testid="deconstruct-batch-tiles"]')?.getBoundingClientRect();
          if (!region) return { full: 0, columns: 0 };
          const tops = new Map();
          for (const tile of document.querySelectorAll('[data-testid="deconstruct-batch-tile"]')) {
            const box = tile.getBoundingClientRect();
            if (box.top >= region.top - 0.5 && box.bottom <= region.bottom + 0.5) {
              tops.set(Math.round(box.top), (tops.get(Math.round(box.top)) ?? 0) + 1);
            }
          }
          return { full: tops.size, columns: Math.max(0, ...tops.values()) };
        });
      const burnInView = () =>
        page.evaluate(() => {
          const burn = document.querySelector('[data-testid="deconstruct-burn"]')?.getBoundingClientRect();
          const main = document.querySelector('main')?.getBoundingClientRect();
          return burn !== undefined && main !== undefined && burn.bottom <= main.bottom + 0.5;
        });

      await page.getByTestId('deconstruct-select-shown').click();
      await expect(selectedText(page)).toHaveText(`${String(CENSUS.batchCap)} of ${String(CENSUS.batchCap)}`);

      await settle(1440, 900);
      const medium = await tileRows();
      expect(medium.full, 'full tile rows at 1440x900').toBeGreaterThanOrEqual(3);
      expect(medium.columns, 'tile columns at 1440x900').toBeGreaterThanOrEqual(10);
      expect(await burnInView(), 'Burn in view at 1440x900').toBe(true);

      await settle(1920, 1080);
      const tall = await tileRows();
      expect(tall.full, 'full tile rows at 1920x1080').toBeGreaterThan(medium.full);
      expect(await burnInView(), 'Burn in view at 1920x1080').toBe(true);

      await settle(1440, 768);
      expect(await burnInView(), 'Burn in view at 1440x768').toBe(true);
    });
  });

  test('reads in Portuguese and in English on both of the Forge tab\'s pages', async () => {
    await withApp(async (page) => {
      await expect(page.getByRole('tab', { name: en('deconstructNavLabel') })).toBeVisible();
      await expect(page.getByTestId('deconstruct-burn-reason')).toHaveText(en('deconstructReasonFixture'));

      await switchLanguage(page, 'pt');
      await expect(page.getByRole('tab', { name: pt('deconstructNavLabel') })).toBeVisible();
      await expect(page.getByRole('tab', { name: pt('forgeNavLabel') })).toBeVisible();
      await expect(page.getByTestId('deconstruct-burn')).toHaveText(pt('deconstructBurn'));
      await expect(page.getByTestId('deconstruct-burn-reason')).toHaveText(pt('deconstructReasonFixture'));
      await expect(page.getByTestId('deconstruct-selected')).toHaveText(`0 de ${String(CENSUS.batchCap)}`);

      await inject(page, [refused('smoke-pt', ['1'], 'ITEM_EQUIPPED')]);
      await expect(page.getByTestId('deconstruct-result')).toContainText(pt('deconstructResultRefused'));
      await expect(page.getByTestId('deconstruct-result')).toContainText(pt('deconstructBlockEquipped'));

      await switchLanguage(page, 'en');
      await expect(page.getByRole('tab', { name: en('deconstructNavLabel') })).toBeVisible();
      await expect(page.getByTestId('deconstruct-result')).toContainText(en('deconstructResultRefused'));
      await expect(page.getByTestId('deconstruct-burn')).toHaveText(en('deconstructBurn'));
    });
  });
});
