/**
 * The Heroes screen's four stages sit side by side in one strip, the inactive ones off screen,
 * and `<main>` may only ever scroll vertically. This walks the rail to a hero whose stages all
 * draw and measures, on each stage, that neither the window nor `<main>` can scroll sideways.
 *
 * What it guards against: an absolutely positioned element in an off-screen stage — an `sr-only`
 * table caption on the Gear stage — resolving its containing block above the strip's clip, so
 * the clip never reaches it and `<main>` grows a horizontal scrollbar for content nobody can see.
 * The precondition on that caption is what keeps this from passing on a fixture whose Gear stage
 * draws a banner instead of the table.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

const HEROES_TAB_INDEX = 2;
const STAGES = ['Hero', 'Combat', 'Gear', 'Points'];

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

async function openHeroes(page) {
  await page.locator('nav[aria-label="Main"] button').nth(HEROES_TAB_INDEX).click();
  await page.waitForSelector('[data-testid="heroes-view"]', { timeout: 20_000 });
  await page.waitForSelector('[data-testid^="heroes-roster-row-"]', { timeout: 60_000 });
}

/** Resizes the real `BrowserWindow` — Playwright's Electron support has no viewport emulation. */
async function resize(app, page, width, height) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setMinimumSize(200, 200);
    win?.setSize(size.width, size.height);
  }, { width, height });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(180);
}

/**
 * The fixture carries heroes a sheet-inversion mismatch blocks, whose Gear stage draws a banner
 * instead of the totals table. Walk the rail until a hero draws the table — the Gear stage is
 * mounted whichever stage is showing, so the caption is there to find without leaving Hero.
 */
async function selectHeroWithGearTable(page) {
  const rows = page.locator('[data-testid^="heroes-roster-row-"]');
  const count = await rows.count();
  for (let index = 0; index < count; index++) {
    await rows.nth(index).click();
    await page.waitForTimeout(250);
    if ((await page.locator('caption').count()) > 0) return;
  }
  throw new Error('heroes-stages-and-scrollbars.spec.mjs: no fixture hero drew the gear totals table');
}

/** How far the document itself can be scrolled — the measurement, rather than `scrollHeight`. */
function documentScrollRange(page) {
  return page.evaluate(() => {
    const startX = window.scrollX;
    const startY = window.scrollY;
    window.scrollTo(9999, 9999);
    const moved = { x: window.scrollX, y: window.scrollY };
    window.scrollTo(startX, startY);
    return moved;
  });
}

function mainSidewaysOverflow(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    return main.scrollWidth - main.clientWidth;
  });
}

test.describe('the Heroes screen\'s stages and the scrollbars they may show', () => {
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;
  let runDir;

  test.beforeAll(async () => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-heroes-stages-'));
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

  test('no stage, on screen or off, lets the window or <main> scroll sideways', async () => {
    await resize(app, page, 1280, 900);
    await openHeroes(page);
    await selectHeroWithGearTable(page);

    // The element this guards against, proved to be the shape that escapes an unpositioned clip.
    const caption = await page.evaluate(() => {
      const el = document.querySelector('caption');
      return { position: getComputedStyle(el).position, right: Math.round(el.getBoundingClientRect().right) };
    });
    expect(caption.position, 'the Gear totals caption is no longer absolutely positioned; this test measures nothing').toBe('absolute');
    expect(caption.right, 'the Gear stage is on screen; the caption cannot be the off-screen case').toBeGreaterThan(
      await page.evaluate(() => window.innerWidth),
    );

    for (const stage of STAGES) {
      await page.getByRole('tab', { name: new RegExp(`^${stage}$`, 'i') }).click();
      await page.waitForTimeout(400);

      expect(await documentScrollRange(page), `the window scrolled on the ${stage} stage`).toEqual({ x: 0, y: 0 });
      expect(await mainSidewaysOverflow(page), `<main> scrolls sideways on the ${stage} stage`).toBeLessThanOrEqual(0);
    }
  });
});
