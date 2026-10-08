import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

/**
 * The Account screen on a running app: what it actually draws, and its one interactive control.
 *
 * The tab was asserted visible and nothing else, which is the weakest claim a screen can carry —
 * the four regions are drawn only when the account sections behind them were usable, so a read
 * that came back short leaves a panel silently absent while the screen still "exists". Hence the
 * region-by-region assertions below.
 *
 * `BFC_FIXTURE_ACCOUNT_FILE` is what makes the House and skill-tree panels render at all: without
 * it the fixture's house and skills sections come back missing and `account-screen-panels` is
 * empty, so a spec that only looked for the screen would pass over two missing panels.
 *
 * `account-restart.spec.mjs` covers the account surviving a restart over the bridge and never
 * opens this tab; nothing here repeats that.
 */
function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');

function en(key) {
  const source = fs.readFileSync(EN_COPY_PATH, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) throw new Error(`account-view.spec.mjs: could not find copy key "${key}" in ${EN_COPY_PATH}`);
  return match[1];
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
      // SAFETY: keeps the token reader away from any real session.cfg on this machine — see
      // i18n.spec.mjs for the full reasoning.
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_FIXTURE,
      ...env,
    },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  return { app, page };
}

function navTab(page, labelKey) {
  return page.locator('nav[aria-label="Main"]').getByRole('button', { name: en(labelKey), exact: true });
}

async function openAccount(page) {
  await navTab(page, 'accountNavLabel').click();
  await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('account-screen')).toBeVisible({ timeout: 30_000 });
}

async function withAccount(run) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-account-view-'));
  try {
    const { app, page } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
    try {
      const modal = page.getByTestId('consent-modal');
      await expect(modal).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('consent-accept').click();
      await expect(modal).toBeHidden({ timeout: 15_000 });
      await openAccount(page);
      await run(page);
    } finally {
      await app.close().catch(() => undefined);
    }
  } finally {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

/** Every region the layout owns, plus the holdings panel's own parts. A region absent here is a
 *  panel the screen quietly dropped, which is what this spec exists to catch. */
const REGIONS = [
  'account-screen',
  'account-screen-summary',
  'account-screen-holdings',
  'account-screen-identity',
  'account-screen-panels',
  'account-holdings',
  'account-holdings-total',
  'account-holdings-inventory',
  'account-holdings-heroes',
  'account-holdings-skins',
  'account-holdings-heroes-floor',
  'account-holdings-skins-worn',
  'account-read-age',
];

test.describe('account screen smoke — what it draws, and the one control it offers', () => {
  test('every region of the screen is drawn, the total carries a formatted figure, and both permanent caveats are present', async () => {
    await withAccount(async (page) => {
      const missing = [];
      for (const testId of REGIONS) {
        if ((await page.getByTestId(testId).count()) === 0) missing.push(testId);
      }
      expect(
        missing,
        'these regions of the Account screen were not drawn. Each one is conditional on the account ' +
          'sections behind it being usable, so a missing region is a read that came back short — not ' +
          'a layout change',
      ).toEqual([]);

      // Non-empty, which is what passing the fixture file buys: the House and skill-tree panels
      // live here, and without those two sections the row is an empty grid that still exists.
      expect(
        await page.locator('[data-testid="account-screen-panels"] > *').count(),
        'the panels row is drawn but holds nothing, so the House and skill-tree panels were both ' +
          'dropped for an unusable read while the screen still looked complete',
      ).toBeGreaterThan(0);

      // The figure, not just the element: formatted by `Intl` in the quote currency, which draws a
      // symbol rather than the three-letter code.
      await expect(page.getByTestId('account-holdings-total')).toHaveText(/\d/);
      await expect(page.getByTestId('account-holdings-total')).toContainText('R$');

      const rows = ['inventory', 'heroes', 'skins'];
      const unnamed = [];
      for (const row of rows) {
        const title = en(`accountHoldings${row[0].toUpperCase()}${row.slice(1)}`);
        if (!(await page.getByTestId(`account-holdings-${row}`).textContent()).includes(title)) {
          unnamed.push(`account-holdings-${row} does not carry its own name "${title}"`);
        }
      }
      expect(
        unnamed,
        'the three holdings rows have to read identically at every width, and a row that lost its ' +
          'name leaves the reader unable to tell which figure belongs to what',
      ).toEqual([]);

      // Permanent text, not tips: each explains a figure that is routinely read as something it is
      // not, so an explanation nobody hovers is one nobody reads.
      await expect(page.getByTestId('account-holdings-heroes-floor')).toContainText(
        en('accountHoldingsHeroesFloor'),
      );
      await expect(page.getByTestId('account-holdings-skins-worn')).toContainText(
        en('accountHoldingsSkinsWorn'),
      );

      const [readAgeBefore] = en('accountReadAge').split('{age}');
      await expect(page.getByTestId('account-read-age')).toContainText(readAgeBefore.trim());
    });
  });

  test('the holdings inventory link reaches the Inventory screen with nothing expanded, and Account redraws on the way back', async () => {
    await withAccount(async (page) => {
      // The link sits in the inventory row's trailing slot — the one the chevron holds on the rows
      // that open — so it is reachable without expanding anything. `toBeVisible` on an untouched
      // screen is what carries that: nothing here is clicked before it.
      const link = page.getByTestId('account-holdings-inventory-link');
      await expect(link).toBeVisible({ timeout: 20_000 });
      await expect(link).toHaveAccessibleName(en('accountHoldingsInventoryLink'));

      await link.click();
      await expect(page.getByTestId('inventory-view')).toBeVisible({ timeout: 30_000 });
      expect(
        await page.getByTestId('account-view').count(),
        'the Account screen was still mounted after the link switched tabs, so two screens were ' +
          'drawn at once',
      ).toBe(0);

      await navTab(page, 'accountNavLabel').click();
      await expect(page.getByTestId('account-view')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('account-screen-holdings')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('account-holdings-total')).toHaveText(/\d/);
    });
  });
});
