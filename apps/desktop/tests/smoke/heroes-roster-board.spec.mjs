/**
 * The Heroes screen's board of cards in the real app, drawn from the fixture account: the
 * card-detail control on the board's header, and what each of its three presets leaves on a card.
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

  test('the card-detail presets change what every card draws, never how many cards there are', async () => {
    await resize(app, page, 1280, 900);
    await openHeroes(page);
    await showBoard(page);

    const cards = page.locator('[data-testid^="heroes-roster-card-"]');
    const birth = page.getByTestId('heroes-card-birth');
    const sheet = page.getByTestId('heroes-card-sheet');
    const abilities = page.getByTestId('heroes-card-abilities');
    const gear = page.getByTestId('heroes-card-gear');
    const density = page.getByTestId('heroes-card-density');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    await expect(density.getByRole('button', { name: /^Full$/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(birth).toHaveCount(cardCount);
    await expect(birth.locator('h3')).toHaveCount(cardCount);
    await expect(sheet).toHaveCount(cardCount);
    await expect(abilities).toHaveCount(cardCount);
    await expect(gear).toHaveCount(cardCount);

    await density.getByRole('button', { name: /^Compact$/i }).click();
    await expect(cards).toHaveCount(cardCount);
    await expect(abilities).toHaveCount(cardCount);
    await expect(birth).toHaveCount(cardCount);
    await expect(birth.locator('h3')).toHaveCount(0);
    await expect(sheet).toHaveCount(0);
    await expect(gear).toHaveCount(0);

    await density.getByRole('button', { name: /^Combat$/i }).click();
    await expect(cards).toHaveCount(cardCount);
    await expect(sheet).toHaveCount(cardCount);
    await expect(abilities).toHaveCount(cardCount);
    await expect(gear).toHaveCount(0);

    await density.getByRole('button', { name: /^Full$/i }).click();
    await expect(cards).toHaveCount(cardCount);
    await expect(gear).toHaveCount(cardCount);
  });
});
