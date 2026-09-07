import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');

/**
 * The Forge screen as a planner, end to end in the real app.
 *
 * Modelled on `inventory.spec.mjs`: the screen's whole job is composition — the domain's forge
 * rules and cost table, `@bombfarm/game-art`'s icons and this shell's words — and only a launched
 * app proves they were wired to each other. The offline fixture is the account here because it
 * carries worn gear across several forge levels.
 *
 * Launched on the fixture reader, which is also what makes the button's reason the fixture one:
 * an account with no server behind it cannot forge, whatever the Settings switch says.
 */
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

async function launchApp(env) {
  const app = await electron.launch({
    executablePath: electronExecutable(),
    args: [desktopRoot],
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

async function goToForge(page) {
  const modal = page.getByTestId('consent-modal');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(modal).toBeHidden({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Forge' }).click();
  await page.waitForSelector('[data-testid="forge-view"]', { timeout: 20_000 });
  // The rows, not just the screen: the table mounts once the account is in hand, and a count
  // read before then is zero.
  await page.waitForSelector('[data-testid="inventory-table-row"]', { timeout: 20_000 });
}

/** The rows that are actually in the document — a windowed slice of the bag, not all of it. */
function rows(page) {
  return page.getByTestId('inventory-table-row');
}

/** How many rows the bag holds, which the DOM no longer counts: the table mounts only what is on
 *  screen and carries the rest on `aria-rowcount`. A filter that matches nothing replaces the
 *  whole table with an empty state, which is a bag of zero rows rather than an unreadable count. */
async function rowCount(page) {
  const table = page.locator('[data-testid="inventory-table-scroll"] table');
  if ((await table.count()) === 0) return 0;
  return Number(await table.getAttribute('aria-rowcount'));
}

async function withForge(run) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-forge-'));
  try {
    const { app, page } = await launchApp({
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_OFFLINE_FIXTURE,
      BFC_USER_DATA_DIR: userDataDir,
    });
    try {
      await goToForge(page);
      await run(page);
      await app.close();
    } finally {
      await app.close().catch(() => undefined);
    }
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

/** The number a fact prints, read as one — `2.5` and `127,595` both parse; a dash does not. */
function figureOf(text) {
  return Number(text.replace(/,/g, ''));
}

test.describe('forge plan smoke', () => {
  test('narrows to one hero, plans a climb on a piece, steps the target, and cannot forge on a fixture', async ({}, testInfo) => {
    testInfo.setTimeout(180_000);
    await withForge(async (page) => {
      const view = page.getByTestId('forge-view');

      // The whole bag first, gear only.
      const before = await rowCount(page);
      expect(before).toBeGreaterThan(1);
      await expect(view.getByTestId('forge-hero-hint')).toHaveCount(0);
      // A bag-slot counter is not what this screen is deciding about, and it is gone.
      await expect(view.getByTestId('forge-bag')).toHaveCount(0);

      // Three columns, in this order. A slot column is not among them: the name already reads
      // "Set · Slot", so one would print half of every name a second time beside it — and the
      // width it took is what squeezed the name at the window's minimum.
      const headers = page.locator('[data-testid="inventory-table-scroll"] thead th');
      await expect(headers).toHaveText(['Name', 'Forge', 'Equipped by']);
      await expect(page.getByRole('columnheader', { name: 'Slot' })).toHaveCount(0);

      // The bag opens forged-first, and the Forge header says so.
      const forgeHeader = page.getByRole('columnheader', { name: 'Forge' });
      await expect(forgeHeader).toHaveAttribute('aria-sort', 'descending');

      // The table's headers are the only ordering on this screen — the toolbar offers none of its
      // own, and clicking a header is what changes the order.
      await expect(page.getByRole('combobox', { name: 'Sort by' })).toHaveCount(0);
      const nameHeader = page.getByRole('columnheader', { name: 'Name' });
      await nameHeader.getByRole('button').click();
      await expect(forgeHeader).toHaveAttribute('aria-sort', 'none');
      await expect(nameHeader).not.toHaveAttribute('aria-sort', 'none');
      await forgeHeader.getByRole('button').click();
      await expect(forgeHeader).toHaveAttribute('aria-sort', 'descending');

      // The forge filter is a band now: each option is a stretch of the ladder, and every one of
      // them narrows the bag to the pieces standing on it.
      const forgeBand = page.getByRole('combobox', { name: 'Filter by forge level' });
      await expect(forgeBand).toHaveText('Any forge');
      for (const band of ['+0 only', '+8 only', '+8 to +10', '+10 to +12', '+12 to +14', '+14 and higher']) {
        await forgeBand.click();
        await page.getByRole('option', { name: band, exact: true }).click();
        await expect.poll(() => rowCount(page), { timeout: 10_000 }).toBeLessThan(before);
      }
      await forgeBand.click();
      await page.getByRole('option', { name: 'Any forge' }).click();
      await expect.poll(() => rowCount(page), { timeout: 10_000 }).toBe(before);

      // Refresh acts on the read behind the bag, so it stands over the bag rather than among the
      // filters. A live read on this fixture never moves, so it is only ever in its current-read
      // state here: no label above it, and the read age answered only when the button is asked.
      await expect(view.getByTestId('forge-toolbar').getByTestId('forge-refresh')).toHaveCount(0);
      await expect(view.getByTestId('forge-bag-panel').getByTestId('forge-refresh')).toBeVisible();
      await expect(view.getByTestId('forge-stale-label')).toHaveCount(0);
      await expect(page.getByTestId('forge-read-age')).toHaveCount(0);
      await view.getByTestId('forge-refresh').hover();
      await expect(page.getByTestId('forge-read-age')).toContainText('Account read');

      // Clearing is a button beside the fields now, not a chip, and it is there only while a
      // filter is on.
      await expect(view.getByTestId('forge-clear-filter')).toHaveCount(0);
      await forgeBand.click();
      await page.getByRole('option', { name: '+8 only', exact: true }).click();
      await view.getByTestId('forge-clear-filter').click();
      await expect(forgeBand).toHaveText('Any forge');
      await expect.poll(() => rowCount(page), { timeout: 10_000 }).toBe(before);

      // Who wears it is one chip now, not a three-state dropdown: pressed narrows to the worn
      // pieces, and letting it go is the whole bag again rather than the rest of it.
      await expect(page.getByRole('combobox', { name: 'Filter by who wears it' })).toHaveCount(0);
      const equipped = view.getByTestId('forge-equipped-chip');
      await expect(equipped).toHaveAttribute('aria-pressed', 'false');
      await equipped.click();
      await expect(equipped).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => rowCount(page), { timeout: 10_000 }).toBeLessThan(before);
      await equipped.click();
      await expect.poll(() => rowCount(page), { timeout: 10_000 }).toBe(before);

      // Virtualized: the fixture's gear does not fit the pane, and what does not fit is not in
      // the document. Two spacer rows hold its height open instead.
      const mounted = await rows(page).count();
      expect(mounted).toBeLessThan(before);
      await expect(page.getByTestId('inventory-table-spacer-bottom')).toHaveCount(1);

      // Picked by position: an option is a face, a rank, a name and a level rendered as markup, so
      // its accessible name is the block concatenated and matching on it would match formatting.
      await page.getByRole('combobox', { name: 'Filter by hero' }).click();
      await page.getByRole('option').nth(1).click();

      await expect.poll(() => rowCount(page), { timeout: 10_000 }).toBeLessThan(before);
      const wornByHero = await rowCount(page);
      expect(wornByHero).toBeGreaterThan(0);
      // Few enough to fit now, so every one of them is mounted and neither spacer is needed.
      expect(await rows(page).count()).toBe(wornByHero);
      await expect(view.getByTestId('forge-hero-hint')).toContainText(/^Showing what .+ wears$/);

      // A hero already means "worn, by that hero", so the chip that would repeat that cut is not
      // on the screen at all — the line beside the chips is what says the bag is already narrowed.
      await expect(view.getByTestId('forge-equipped-chip')).toHaveCount(0);

      // The first row is the hero's highest forge; clicking it names the piece in the item panel.
      const first = rows(page).first();
      const firstName = (await first.getByTestId('inventory-row-name').textContent())?.trim() ?? '';
      expect(firstName.length).toBeGreaterThan(0);
      await first.click();

      const itemPanel = page.getByTestId('forge-item-panel');
      await expect(itemPanel).toHaveAttribute('data-state', 'item');
      await expect(itemPanel.getByTestId('forge-item-name')).toHaveText(firstName);
      // The identity block above already names the piece; where an unworn piece sits is not
      // something this screen can act on, and the line saying so is gone.
      await expect(itemPanel.getByTestId('forge-item-whereabouts')).toHaveCount(0);

      // The plan panel prints an expected-rolls figure that is a number, and raising the target
      // by one rung changes it — a second value iteration over a longer ladder.
      const planPanel = page.getByTestId('forge-plan-panel');
      await expect(planPanel).toBeVisible();
      const rollsBefore = (await planPanel.getByTestId('forge-fact-rolls').textContent()) ?? '';
      expect(Number.isFinite(figureOf(rollsBefore)), `expected rolls "${rollsBefore}" is not a number`).toBe(true);
      expect(figureOf(rollsBefore)).toBeGreaterThan(0);

      const targetBefore = await planPanel.getByTestId('forge-target').textContent();
      await planPanel.getByRole('button', { name: 'Raise the target' }).click();
      await expect(planPanel.getByTestId('forge-target')).not.toHaveText(targetBefore ?? '');
      await expect(planPanel.getByTestId('forge-fact-rolls')).not.toHaveText(rollsBefore);
      const rollsAfter = (await planPanel.getByTestId('forge-fact-rolls').textContent()) ?? '';
      expect(figureOf(rollsAfter)).toBeGreaterThan(figureOf(rollsBefore));

      // The facts end at the wallet — nothing on this panel prints a DPS delta.
      await expect(planPanel.getByTestId('forge-fact-buys')).toHaveCount(0);

      // An account with no server behind it cannot forge, whatever the switch says — the fixture
      // rule outranks the switch rule, and the button stays disabled with that reason under it.
      await expect(planPanel.getByTestId('forge-button')).toBeDisabled();
      await expect(planPanel.getByTestId('forge-button-reason')).toHaveText('No server to forge on');

      // Nothing rolling, so the rail takes no room; the ledger below says it has no runs.
      await expect(page.getByTestId('forge-rail')).toHaveAttribute('data-state', 'collapsed');
      await expect(page.getByTestId('forge-ledger')).toHaveAttribute('data-state', 'empty');
    });
  });
});
