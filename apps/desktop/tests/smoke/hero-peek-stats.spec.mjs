/**
 * A hero's hover card prints the sheet the Heroes detail pane totals — spent points included —
 * wherever the card opens: from the leaderboard's portrait, which is handed the row's own sheet,
 * and from the roster rail, which reads it from the window-wide provider. Neither may print the
 * record's import-time sheet, which leaves every spent point out, and a hero whose spent points
 * the read could not recover draws its card without figures, as its detail pane does.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_OFFLINE_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

/** A fixture hero with points spent in Attack, so its import-time sheet and its total differ. */
const SPENT_HERO_ID = '26863';
/** A fixture hero whose spent points the parse could not recover. */
const WITHHELD_HERO_ID = '52562';
const HEROES_TAB_INDEX = 2;

function electronExecutable() {
  return path.join(desktopRoot, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
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

/** CI's Windows runner has a 1024px screen, below which the Heroes rail is hidden — size the window
 *  the way the other Heroes specs do, so the rail is on screen wherever this runs. */
async function resize(app, page, width, height) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setMinimumSize(200, 200);
    win?.setSize(size.width, size.height);
  }, { width, height });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(180);
}

/** The card's compact figure, as `formatCompactNumber` prints it in English. */
function compactEn(value) {
  const oneDecimal = (n) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).replace(/[.,]0+$/, '');
  if (Math.abs(value) >= 1_000) return `${oneDecimal(value / 1_000)}k`;
  return Number.isInteger(value) ? String(value) : oneDecimal(value);
}

async function openCard(page, trigger) {
  await trigger.hover();
  await page.mouse.move(0, 0, { steps: 1 });
  await trigger.hover({ position: { x: 4, y: 4 } });
  const card = page.locator('[data-peek-card="hero"]');
  await expect(card).toBeVisible();
  return card;
}

async function closeCard(page) {
  await page.mouse.move(0, 0, { steps: 1 });
  await expect(page.locator('[data-peek-card="hero"]')).toHaveCount(0);
}

function cardAttack(card) {
  return card.locator('div', { hasText: /^Attack/ }).locator('b').first();
}

test.describe('the hero hover card\'s statistics', () => {
  test.describe.configure({ mode: 'serial' });

  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;
  let runDir;
  let attack = 0;

  test.beforeAll(async () => {
    runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-hero-peek-stats-'));
    const fixtureFile = path.join(runDir, 'account.json');
    fs.copyFileSync(ACCOUNT_OFFLINE_FIXTURE, fixtureFile);
    ({ app, page } = await launchApp({
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: fixtureFile,
      BFC_LIVE_SOURCE: 'replay',
      BFC_USER_DATA_DIR: path.join(runDir, 'user-data'),
    }));
    await acceptConsent(page);
    await resize(app, page, 1400, 1000);
    await page.locator('nav[aria-label="Main"] button').nth(HEROES_TAB_INDEX).click();
    await page.waitForSelector('[data-testid^="heroes-roster-row-"]', { timeout: 60_000 });
  });

  test.afterAll(async () => {
    await app?.close().catch(() => undefined);
    fs.rmSync(runDir, { recursive: true, force: true });
  });

  test('the leaderboard portrait\'s card prints the row\'s Attack', async () => {
    await page.getByRole('button', { name: /^Leaderboard$/i }).click();
    const row = page.getByTestId(`heroes-leaderboard-row-${SPENT_HERO_ID}`);
    const rowAttack = row.getByTestId('heroes-leaderboard-stat-attack');
    await expect(rowAttack).toHaveText(/\d/);
    attack = Number((await rowAttack.innerText()).replace(/,/g, ''));

    const card = await openCard(page, row.locator('[data-peek="hero"]'));
    await expect(card).toContainText('Minato');
    await expect(cardAttack(card)).toHaveText(compactEn(attack));
    await closeCard(page);
  });

  test('a hero whose spent points were not read opens a card without figures', async () => {
    const row = page.getByTestId(`heroes-leaderboard-row-${WITHHELD_HERO_ID}`);
    const card = await openCard(page, row.locator('[data-peek="hero"]'));
    await expect(card).not.toContainText('Attack');
    await closeCard(page);
  });

  test('the roster rail\'s card prints the same Attack', async () => {
    await page.getByRole('button', { name: /^List$/i }).click();
    const railRow = page.getByTestId(`heroes-roster-row-${SPENT_HERO_ID}`);
    await railRow.scrollIntoViewIfNeeded();
    const card = await openCard(page, railRow.locator('[data-peek="hero"]').first());
    await expect(card).toContainText('Minato');
    await expect(cardAttack(card)).toHaveText(compactEn(attack));
    await closeCard(page);
  });
});
