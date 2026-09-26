/**
 * The Heroes screen's board of showcase cards, its leaderboard table and the roster summary above
 * them, in the real app, drawn from the fixture account.
 *
 * Counts, never geometry: CI's screen is narrower than the window this asks for, so how many cards
 * fit a row is not a property this can assert. The board is `@bombfarm/hero`'s and carries its own
 * test ids.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
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

async function showBoard(page) {
  await page.getByRole('button', { name: /^Cards$/i }).click();
  await page.waitForSelector('[data-testid^="heroes-roster-card-"]', { timeout: 20_000 });
}

async function showTable(page) {
  await page.getByRole('button', { name: /^Leaderboard$/i }).click();
  await page.waitForSelector('[data-testid^="heroes-leaderboard-row-"]', { timeout: 20_000 });
}

function tableIds(page) {
  return page.locator('[data-testid^="heroes-leaderboard-row-"]').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-testid')?.replace('heroes-leaderboard-row-', '')),
  );
}

/** A fixture hero whose spent points the parse could not recover. */
const WITHHELD_HERO_ID = '52562';

function tablePowers(page) {
  return page.locator('[data-testid="heroes-leaderboard-power"]').allTextContents();
}

test.describe('the Heroes screen\'s board of cards', () => {
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;
  let runDir;

  test.beforeAll(async () => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-heroes-roster-board-'));
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

  test('every showcase card draws the same sections, with no card-detail control on the board', async () => {
    await resize(app, page, 1280, 900);
    await openHeroes(page);
    await showBoard(page);

    const cards = page.locator('[data-testid^="heroes-roster-card-"]');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    for (const section of ['types', 'birth', 'abilities', 'gear', 'position']) {
      await expect(page.getByTestId(`heroes-card-${section}`)).toHaveCount(cardCount);
    }
    await expect(page.getByTestId('heroes-card-density')).toHaveCount(0);
    await expect(page.getByTestId('heroes-card-sheet')).toHaveCount(0);
    await expect(page.getByTestId('heroes-card-abilities').first()).not.toContainText(/\d+\/\d+/);
  });

  test('the roster summary carries the squad power and the furthest phase', async () => {
    const summary = page.getByTestId('roster-summary-strip');
    await expect(summary).toBeVisible();
    await expect(summary.getByTestId('roster-summary-power')).toContainText(/\d/);
    await expect(summary.getByTestId('roster-summary-max-phase')).toContainText('137');
  });

  test('the leaderboard lists every hero, sorts by power both ways, and a row opens that hero', async () => {
    await page.getByRole('button', { name: /^List$/i }).click();
    await page.waitForSelector('[data-testid^="heroes-roster-row-"]', { state: 'attached', timeout: 20_000 });
    const heroCount = await page.locator('[data-testid^="heroes-roster-row-"]').count();
    await showTable(page);
    expect(await tableIds(page)).toHaveLength(heroCount);

    // The fixture could not recover this hero's spent points, so its detail pane withholds its
    // figures — and the table withholds its statistics for the same reason.
    const withheld = page.getByTestId(`heroes-leaderboard-row-${WITHHELD_HERO_ID}`);
    for (const stat of ['attack', 'critChance', 'critDmg', 'luck', 'speed']) {
      await expect(withheld.getByTestId(`heroes-leaderboard-stat-${stat}`)).toHaveText('—');
    }

    const power = page.getByTestId('heroes-leaderboard-sort-power');
    await expect(power).toHaveAttribute('aria-sort', 'descending');
    const strongestFirst = await tableIds(page);
    await power.getByRole('button').click();
    await expect(power).toHaveAttribute('aria-sort', 'ascending');
    // A whole reversal holds only while no two powers tie, which the distinct count pins.
    const powers = await tablePowers(page);
    expect(new Set(powers).size).toBe(powers.length);
    expect(await tableIds(page)).toEqual([...strongestFirst].reverse());

    const pickedId = strongestFirst[1];
    await page.getByTestId(`heroes-leaderboard-row-${pickedId}`).click();
    await expect(page.locator('[data-testid^="heroes-leaderboard-row-"]')).toHaveCount(0);
    await expect(page.getByTestId(`heroes-roster-row-${pickedId}`)).toHaveAttribute('aria-current', 'true');
  });

  test('the Columns menu shows cooldown reduction and hides luck, and a portrait peeks and picks', async () => {
    await showTable(page);
    await expect(page.getByTestId('heroes-leaderboard-sort-cdr')).toHaveCount(0);

    await page.getByTestId('heroes-leaderboard-columns').click();
    const menu = page.getByTestId('heroes-leaderboard-columns-menu');
    await menu.getByRole('menuitemcheckbox', { name: /^Cooldown reduction$/ }).click();
    await menu.getByRole('menuitemcheckbox', { name: /^Luck$/ }).click();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    await expect(page.getByTestId('heroes-leaderboard-sort-cdr')).toHaveText(/Cooldown reduction/);
    const firstId = (await tableIds(page))[0];
    const first = page.getByTestId(`heroes-leaderboard-row-${firstId}`);
    await expect(first.getByTestId('heroes-leaderboard-stat-cdr')).toHaveText(/^(\d[\d,.]*%|—)$/);
    await expect(page.getByTestId('heroes-leaderboard-sort-luck')).toHaveCount(0);

    const portrait = first.locator('[data-peek="hero"]');
    await portrait.hover();
    await portrait.hover({ position: { x: 4, y: 4 } });
    await expect(page.locator('[data-peek-card="hero"]')).toBeVisible();

    await portrait.click();
    await expect(page.locator('[data-testid^="heroes-leaderboard-row-"]')).toHaveCount(0);
    await expect(page.getByTestId(`heroes-roster-row-${firstId}`)).toHaveAttribute('aria-current', 'true');
  });
});
