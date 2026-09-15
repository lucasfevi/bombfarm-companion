import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

/**
 * The market currency setting end to end on a real Electron app: the Settings page draws the
 * selector on the default, a pick lands without a reload, and the pick is what a second launch
 * on the same user-data directory reads back — from the settings row, not from anything the
 * renderer remembers. Launcher shape and the `mkdtempSync` + `BFC_USER_DATA_DIR` relaunch pattern
 * are `i18n.spec.mjs`'s, and so is reading the asserted copy out of `en.ts` rather than
 * hardcoding it.
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
  if (!match) throw new Error(`market-currency.spec.mjs: could not find copy key "${key}" in ${EN_COPY_PATH}`);
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

async function acceptConsent(page) {
  const modal = page.getByTestId('consent-modal');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(modal).toBeHidden({ timeout: 15_000 });
}

async function openSettings(page) {
  await page.getByRole('button', { name: en('settingsNavLabel') }).click();
  await page.waitForSelector('[data-testid="settings-view"]', { timeout: 20_000 });
}

function currencySelect(page) {
  return page.getByRole('combobox', { name: en('settingsMarketQuoteCurrencyLabel') });
}

test.describe('market currency smoke — drawn on the default, picked in place, and remembered', () => {
  test('BRL by default, a pick of USD lands without a reload, and USD is what a restart reads back', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-market-currency-'));
    try {
      const { app: app1, page: page1 } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        await acceptConsent(page1);
        await openSettings(page1);

        const select = currencySelect(page1);
        await expect(select).toBeVisible({ timeout: 10_000 });
        await expect(select).toContainText('BRL');
        await expect(page1.getByTestId('settings-market-quote-currency-warning')).toHaveAttribute('aria-hidden', 'true');

        await page1.evaluate(() => {
          window.__bfcMarketCurrencySentinel = 1;
        });

        await select.click();
        await page1.getByRole('option', { name: /^USD · / }).click();

        await expect(select).toContainText('USD', { timeout: 10_000 });
        await expect(select).not.toContainText('BRL');
        // Persisted, so the not-saved slot stays empty and hidden.
        await expect(page1.getByTestId('settings-market-quote-currency-warning')).toHaveAttribute('aria-hidden', 'true');

        // No reload occurred — the sentinel stamped before the pick survived it.
        expect(await page1.evaluate(() => window.__bfcMarketCurrencySentinel)).toBe(1);
      } finally {
        await app1.close().catch(() => undefined);
      }

      // Launch 2 on the SAME user-data dir: the only thing that can put USD on the selector
      // now is the settings row the first launch wrote.
      const { app: app2, page: page2 } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        await expect(page2.getByTestId('consent-modal')).toHaveCount(0);
        await openSettings(page2);

        const select = currencySelect(page2);
        await expect(select).toBeVisible({ timeout: 10_000 });
        await expect(select).toContainText('USD');
        await expect(select).not.toContainText('BRL');
      } finally {
        await app2.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
