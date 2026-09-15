/**
 * The Heroes screen's Combat stage in the real app: the shared combat breakdown panel drawn from
 * the fixture account, its twenty figures visible without a click on the desktop's own width, the
 * same cards stacked when the window is pulled narrow, and a popover opening on hover.
 *
 * The panel is `@bombfarm/hero`'s and carries its own test ids; the roster rail's row ids are the
 * only desktop-owned selectors here.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

const CARD_IDS = [
  'attack', 'energy', 'speed', 'critChance', 'critDmg', 'penetration', 'cdr',
  'dmg', 'mitF', 'critFactor', 'fuse', 'fieldSeconds', 'rest',
  'hit', 'criticalHit', 'avgHit', 'bombsPerSecond', 'uptime',
  'activeDps', 'sustainedDps',
];

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

const HEROES_TAB_INDEX = 2;

async function openHeroes(page) {
  await page.locator('nav[aria-label="Main"] button').nth(HEROES_TAB_INDEX).click();
  await page.waitForSelector('[data-testid="heroes-view"]', { timeout: 20_000 });
  await page.waitForSelector('[data-testid^="heroes-roster-row-"]', { timeout: 60_000 });
}

/** Resizes the real `BrowserWindow` — Playwright's Electron support has no viewport emulation. */
async function resize(app, page, width, height = 900) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setMinimumSize(200, 200);
    win?.setSize(size.width, size.height);
  }, { width, height });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(180);
}

/**
 * The fixture carries heroes a sheet-inversion mismatch blocks, whose Combat stage draws a
 * banner instead of figures. Walk the rail until a hero draws the panel.
 */
async function selectHeroWithFigures(page) {
  const rows = page.locator('[data-testid^="heroes-roster-row-"]');
  const count = await rows.count();
  for (let index = 0; index < count; index++) {
    await rows.nth(index).click();
    await page.getByRole('tab', { name: /^Combat$/i }).click();
    const panel = page.getByTestId('combat-breakdown');
    await page.waitForTimeout(250);
    if (await panel.isVisible().catch(() => false)) return panel;
  }
  throw new Error('heroes-combat.spec.mjs: no fixture hero drew the combat breakdown');
}

test.describe('the Heroes screen\'s Combat stage', () => {
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;
  let runDir;

  test.beforeAll(async () => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-heroes-combat-'));
    const fixtureFile = path.join(runDir, 'account.json');
    fs.copyFileSync(ACCOUNT_OFFLINE_FIXTURE, fixtureFile);
    ({ app, page } = await launchApp({
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: fixtureFile,
      BFC_LIVE_SOURCE: 'replay',
      BFC_USER_DATA_DIR: path.join(runDir, 'user-data'),
    }));
    await acceptConsent(page);
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  test('draws the breakdown as a pipeline: twenty figures, four rows, wires, a matrix of seven, no accordion', async () => {
    await resize(app, page, 1280, 900);
    await openHeroes(page);
    const panel = await selectHeroWithFigures(page);

    for (const id of CARD_IDS) {
      await expect(panel.locator(`[data-breakdown-card="${id}"] [data-testid="breakdown-value"]`), id).toBeVisible();
    }
    await expect(panel.locator('[data-breakdown-row]')).toHaveCount(4);
    await expect(panel.locator('[data-testid="breakdown-matrix"] tbody tr')).toHaveCount(7);
    await expect(panel.locator('[data-slot^="accordion"]')).toHaveCount(0);
    const wires = panel.getByTestId('breakdown-wires');
    await expect(wires).toBeVisible();
    await expect(wires.locator('[data-edge-from="speed"][data-edge-to="bombsPerSecond"]')).toHaveCount(1);
  });

  test('hovering a card opens its popover, lights the wires on both sides of it and mutes the cards on neither', async () => {
    const panel = page.getByTestId('combat-breakdown');
    await panel.locator('[data-breakdown-card="hit"]').hover();
    await expect(page.getByTestId('breakdown-popover-hit')).toBeVisible();
    await expect(panel.locator('[data-testid="breakdown-wires"] [data-lit="true"]')).toHaveCount(5);
    await expect(panel.locator('[data-breakdown-card][data-muted="true"]')).toHaveCount(CARD_IDS.length - 6);
    await page.mouse.move(0, 0);
    await expect(panel.locator('[data-breakdown-card][data-muted="true"]')).toHaveCount(0);
  });

  test('pulled narrow, the same cards stack one per row and the wires are gone', async () => {
    await resize(app, page, 700, 900);
    const panel = page.getByTestId('combat-breakdown');
    for (const id of CARD_IDS) {
      await expect(panel.locator(`[data-breakdown-card="${id}"] [data-testid="breakdown-value"]`), id).toBeVisible();
    }
    await expect(panel.getByTestId('breakdown-wires')).toBeHidden();
    const boxes = await Promise.all(CARD_IDS.map((id) => panel.locator(`[data-breakdown-card="${id}"]`).boundingBox()));
    expect(new Set(boxes.map((box) => box?.y)).size).toBe(CARD_IDS.length);
    await resize(app, page, 1280, 900);
  });
});
