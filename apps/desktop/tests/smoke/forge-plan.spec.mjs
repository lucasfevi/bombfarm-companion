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
 *  screen and carries the rest on `aria-rowcount`. */
async function rowCount(page) {
  const count = await page.locator('[data-testid="inventory-table-scroll"] table').getAttribute('aria-rowcount');
  return Number(count);
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

      // The first row is the hero's highest forge; clicking it names the piece in the item panel.
      const first = rows(page).first();
      const firstName = (await first.getByTestId('inventory-row-name').textContent())?.trim() ?? '';
      expect(firstName.length).toBeGreaterThan(0);
      await first.click();

      const itemPanel = page.getByTestId('forge-item-panel');
      await expect(itemPanel).toHaveAttribute('data-state', 'item');
      await expect(itemPanel.getByTestId('forge-item-name')).toHaveText(firstName);
      await expect(itemPanel.getByTestId('forge-item-whereabouts')).toContainText('worn by');

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
