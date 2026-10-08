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

/** A nav tab by its accessible name, scoped to the landmark: an unscoped `getByRole` matches every
 *  aria-label CONTAINING the word, and the word moves into `aria-label` once the bar is narrow
 *  enough to draw a glyph instead. */
function navTab(page, labelKey) {
  return page.locator('nav[aria-label="Main"]').getByRole('button', { name: en(labelKey), exact: true });
}

async function openInventory(page) {
  await navTab(page, 'inventoryNavLabel').click();
  await page.waitForSelector('[data-testid="inventory-view"]', { timeout: 30_000 });
}

async function openAccount(page) {
  await navTab(page, 'accountNavLabel').click();
  await page.waitForSelector('[data-testid="account-view"]', { timeout: 30_000 });
}

/**
 * The currency a figure is drawn in, read off its symbol.
 *
 * `Intl.NumberFormat`'s currency style prints a symbol, never the three-letter code, so there is
 * no `USD` to look for. `R$` contains `$`, which is why this asks which symbol the figure starts
 * with rather than which characters it contains.
 */
function symbolOf(text) {
  if (text.includes('R$')) return 'R$';
  if (text.includes('$')) return '$';
  return `no currency symbol in ${JSON.stringify(text)}`;
}

const PRICING_TYPES_PATH = path.join(desktopRoot, '..', '..', 'packages', 'pricing', 'src', 'market', 'types.ts');

/** Read rather than copied: a second literal of the market's app id here would be one more place
 *  for it to go stale. Nothing below asserts it — it only shapes the listing URL a resolved price
 *  carries — but the snapshot has to be a believable one. */
function marketAppId() {
  const source = fs.readFileSync(PRICING_TYPES_PATH, 'utf8');
  const match = source.match(/MARKET_APP_ID\s*=\s*(\d+)/);
  if (!match) throw new Error(`market-currency.spec.mjs: could not read MARKET_APP_ID from ${PRICING_TYPES_PATH}`);
  return Number(match[1]);
}

/**
 * An item the fixture account actually holds, and the key the market prices it under.
 *
 * The key derivation is `priceKey(defId, rarityIdx)` — `<defId>#<rarityIdx>` — which is what an
 * owned inventory item resolves to as long as the game marks it tradable. `account-offline.json`
 * holds several tradable `ember_calca` at rarity 2, so this key reaches real rows on the screen.
 */
const PRICED_DEF_ID = 'ember_calca';
const PRICED_RARITY_IDX = 2;
const PRICED_KEY = `${PRICED_DEF_ID}#${String(PRICED_RARITY_IDX)}`;

/**
 * Writes the market disk cache before the app starts.
 *
 * A fresh profile with no usable network has no snapshot at all, and with a null snapshot the
 * Inventory total does not render, no price renders, and there is no refresh control — so "the
 * chosen currency reaches a priced screen" would have nothing to reach. The cache is read on start
 * and published before any network call, and a background check that fails leaves the adopted
 * snapshot exactly where it was, so this works offline. Both currencies carry a native quote, which
 * is what makes each one the number on the listing rather than a conversion.
 */
function seedMarketCache(userDataDir) {
  const quotedUtc = new Date().toISOString();
  const snapshot = {
    schemaVersion: 3,
    generatedUtc: quotedUtc,
    appId: marketAppId(),
    baseCurrency: 'USD',
    nativeCurrencies: ['BRL', 'USD'],
    fx: { USD: 1, BRL: 5.5 },
    entries: [
      {
        hashName: 'Ember Pants (Rare)',
        name: 'Ember Pants',
        key: PRICED_KEY,
        defId: PRICED_DEF_ID,
        kind: null,
        category: 'equip',
        set: 'ember',
        slot: 'calca',
        rarityIdx: PRICED_RARITY_IDX,
        level: 10,
        act: null,
        lowestUsd: 12.34,
        lowestNative: { USD: 12.34, BRL: 67.89 },
        listings: 7,
        iconUrl: null,
        fetchedUtc: quotedUtc,
        nativeQuotedUtc: quotedUtc,
      },
    ],
    index: { [PRICED_KEY]: 0 },
    alternates: {},
    unlisted: [],
    anomalies: [],
    coverage: {
      marketRows: 1,
      keyedRows: 1,
      pricedRows: 1,
      unkeyedRows: 0,
      catalogKeys: 1,
      matchedCatalogKeys: 1,
      searchCalls: 0,
    },
  };
  fs.writeFileSync(
    path.join(userDataDir, 'market-prices.json'),
    JSON.stringify({ etag: null, adoptedUtc: quotedUtc, snapshot }),
    'utf8',
  );
}

test.describe('market currency smoke — drawn on the default, picked in place, and remembered', () => {
  test('BRL by default, a search for "dollar" narrows the list, the USD pick lands without a reload, and USD is what a restart reads back', async () => {
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
        await expect(page1.getByPlaceholder(en('settingsMarketQuoteCurrencySearchPlaceholder'))).toBeFocused();
        await page1.keyboard.type('dollar');
        // Code and name both match, so "dollar" keeps every dollar and drops the real.
        await expect(page1.getByRole('option', { name: /^BRL · / })).toHaveCount(0);
        await expect(page1.getByRole('option', { name: /^AUD · / })).toBeVisible();
        await page1.getByRole('option', { name: /^USD · / }).click();
        await expect(page1.getByRole('listbox')).toHaveCount(0);

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

  /**
   * The setting crosses the nav boundary: the test above never leaves Settings, so "the chosen
   * currency reaches a screen that prices something" was unproven — the selector could have been
   * writing a row nothing downstream read.
   *
   * The figure is an `Intl` currency SYMBOL, never the three-letter code. Because `R$` contains
   * `$`, the dollar assertion is "carries `$` and does not carry `R$`" rather than a bare
   * substring check that both currencies would satisfy.
   *
   * The refresh control is read and never pressed: its click issues a real request to Steam. What
   * it asserts instead is the state it rests in — present, and `aria-disabled="false"` rather than
   * natively `disabled`, which is what keeps it a hover target at all.
   */
  test('the chosen currency reaches the screens that price things: the Inventory total reads in BRL, then both it and the Account holdings total read in dollars after a pick in Settings', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-market-currency-crossing-'));
    try {
      seedMarketCache(userDataDir);
      const { app, page } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        await acceptConsent(page);
        await openSettings(page);
        await expect(currencySelect(page)).toContainText('BRL', { timeout: 10_000 });

        await openInventory(page);
        const totals = page.getByTestId('inventory-totals');
        await expect(
          totals,
          'the Inventory total is only drawn when a market snapshot is in hand, so an absent one ' +
            'means the seeded disk cache was not adopted and nothing on this screen is priced',
        ).toBeVisible({ timeout: 30_000 });
        await expect(totals).toContainText(en('inventoryTotalsTitle'));
        await expect(totals).toContainText('R$', { timeout: 20_000 });

        const refresh = page.getByTestId('item-price-refresh').first();
        await expect(
          refresh,
          'a tradable item the market can key always offers the per-item refresh, so none on screen ' +
            'means the rows resolved with no key at all',
        ).toBeAttached({ timeout: 30_000 });
        // `aria-disabled`, not `disabled`: a natively disabled button takes no pointer events, and
        // the tooltip that names what it does would never open.
        await expect(refresh).toHaveAttribute('aria-disabled', 'false');
        await refresh.scrollIntoViewIfNeeded();
        await refresh.hover();
        const [refreshLabelPrefix] = en('marketRefreshItem').split('{item}');
        await expect(page.locator('[data-slot="tooltip-popup"]')).toContainText(refreshLabelPrefix.trim(), {
          timeout: 10_000,
        });

        await openSettings(page);
        await currencySelect(page).click();
        await page.getByRole('option', { name: /^USD · / }).click();
        await expect(currencySelect(page)).toContainText('USD', { timeout: 10_000 });

        await openInventory(page);
        await expect(page.getByTestId('inventory-totals')).toBeVisible({ timeout: 30_000 });
        await expect
          .poll(async () => (await page.getByTestId('inventory-totals').textContent()) ?? '', {
            timeout: 20_000,
          })
          .not.toContain('R$');
        expect(
          (await page.getByTestId('inventory-totals').textContent()) ?? '',
          'the total has to read in dollars once USD is the quote currency — a figure carrying ' +
            'neither symbol means the screen is formatting against no currency at all',
        ).toContain('$');

        // The second priced screen, reached without touching Settings again: the setting is one
        // value shared by every screen that prices something, so a screen left on the default
        // would print the other symbol beside the same account.
        await openAccount(page);
        const holdings = page.getByTestId('account-holdings-total');
        await expect(holdings).toBeVisible({ timeout: 30_000 });
        expect(
          symbolOf((await holdings.textContent()) ?? ''),
          'the Account holdings total prices the same account the Inventory total does, so it must ' +
            'read in the currency Settings was left on, not in the one it shipped with',
        ).toBe('$');
      } finally {
        await app.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
