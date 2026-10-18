/**
 * How much room the top bar really has, measured in a real window. The density constants in
 * `packages/ui/src/shell-density.ts` are sums of these numbers, so this spec is where they come
 * from: Portuguese (the binding language), with the Premium tab in the strip because that is the
 * widest bar the app ships, then the same bar with one more short tab standing in for the next.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { switchLanguage } from './shell-control.mjs';
import { startPremiumVisibleStub } from './premium-visible-stub.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');
const PT_BR_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'pt-BR.ts');

/** The bar's content cap — the shell's measure. */
const CONTENT_CAP = 1440;
/** The allowance above the measured sum for a font-rendering pass that measures a few pixels wider. */
const MARGIN = 16;
/** A short worded tab in Portuguese. */
const SHORT_TAB_WIDTH = 72;
const WIDE_WINDOW = 1920;

function pt(key) {
  const source = fs.readFileSync(PT_BR_COPY_PATH, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) throw new Error(`top-bar-fit.spec.mjs: could not find copy key "${key}"`);
  return match[1];
}

async function launchApp() {
  const premiumStub = await startPremiumVisibleStub();
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-top-bar-fit-'));
  const app = await electron.launch({
    executablePath: path.join(
      desktopRoot,
      'node_modules',
      'electron',
      'dist',
      process.platform === 'win32' ? 'electron.exe' : 'electron',
    ),
    args: [desktopRoot],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_FULL_FIXTURE,
      BFC_LIVE_SOURCE: 'replay',
      BFC_USER_DATA_DIR: userDataDir,
      BFC_PREMIUM_API_ORIGIN: premiumStub.origin,
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
    },
  });

  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  const consentModal = page.getByTestId('consent-modal');
  await expect(consentModal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(consentModal).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('nav[aria-label="Main"] button')).toHaveCount(10, { timeout: 30_000 });

  await switchLanguage(page, 'pt');
  await expect(page.locator('nav[aria-label="Main"] button').first()).toHaveText('Ao vivo');
  return { app, page, premiumStub };
}

async function resize(app, page, width, height = 800) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setMinimumSize(200, 200);
    win?.setSize(size.width, size.height);
  }, { width, height });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(180);
}

/** Natural widths of the bar's three regions and the two gaps `AppShell` lays between them. */
function measureBar(page) {
  return page.evaluate(() => {
    const header = document.querySelector('header');
    const bar = [...header.children].find((el) => el.getAttribute('aria-hidden') === null);
    const [leftGroup, actions] = bar.children;
    const brand = leftGroup.children[0];
    const nav = document.querySelector('nav[aria-label="Main"]');
    const barStyle = getComputedStyle(bar);
    const rect = (el) => el.getBoundingClientRect();
    const tabWidths = [...nav.querySelectorAll('button')].map((el) => rect(el).width);
    const brandWidth = rect(brand).width;
    const navWidth = rect(nav).width;
    const actionsWidth = rect(actions).width;
    const brandToNav = rect(nav).left - rect(brand).right;
    const navToActionsGap = parseFloat(barStyle.columnGap);
    return {
      brand: brandWidth,
      brandToNav,
      nav: navWidth,
      navToActionsGap,
      actions: actionsWidth,
      content: brandWidth + brandToNav + navWidth + navToActionsGap + actionsWidth,
      tabWidths,
      overlap: {
        brandNav: rect(nav).left - rect(brand).right,
        navActions: rect(actions).left - rect(nav).right,
      },
    };
  });
}

function report(label, m) {
  const tabs = m.tabWidths.map((w) => w.toFixed(1)).join(', ');
  const line = `${label}: brand ${m.brand.toFixed(1)} + ${m.brandToNav.toFixed(1)} + strip ${m.nav.toFixed(1)} + ${m.navToActionsGap.toFixed(1)} + actions ${m.actions.toFixed(1)} = ${m.content.toFixed(1)}px (tabs ${tabs})`;
  console.log(line);
  test.info().annotations.push({ type: 'top-bar-measure', description: line });
}

test.describe('top bar — room for the tabs the bar is about to get', () => {
  let app;
  let page;
  let premiumStub;

  test.beforeAll(async () => {
    ({ app, page, premiumStub } = await launchApp());
  });

  test.afterAll(async () => {
    await app?.close();
    await premiumStub?.close();
  });

  test('the bar as shipped, Premium tab included, fits the content cap with a margin and nothing overlaps', async () => {
    await resize(app, page, WIDE_WINDOW);
    const m = await measureBar(page);
    report('worded, with the Premium tab', m);

    expect(m.overlap.brandNav, 'the tabs ran into the brand').toBeGreaterThanOrEqual(0);
    expect(m.overlap.navActions, 'the actions ran into the tabs').toBeGreaterThanOrEqual(m.navToActionsGap - 0.5);
    expect(m.content + MARGIN).toBeLessThanOrEqual(CONTENT_CAP);
    await expect(page.getByTestId('shell-settings')).toBeVisible();
    await expect(page.locator('nav[aria-label="Main"] button').nth(8)).toHaveText('Premium');
  });

  test('one more short worded tab beside the Premium tab still fits with the margin', async () => {
    await resize(app, page, WIDE_WINDOW);
    await page.evaluate((short) => {
      const nav = document.querySelector('nav[aria-label="Main"]');
      const buttons = [...nav.querySelectorAll('button')];
      const donor = buttons.find((el) => el.getAttribute('aria-current') !== 'page');
      const standIn = donor.cloneNode(true);
      standIn.style.boxSizing = 'border-box';
      standIn.style.minWidth = `${short}px`;
      standIn.style.width = `${short}px`;
      standIn.setAttribute('data-stand-in', 'short');
      buttons[buttons.length - 1].before(standIn);
    }, SHORT_TAB_WIDTH);
    await page.waitForTimeout(100);
    const m = await measureBar(page);
    report('worded, with the Premium tab and one stand-in tab', m);

    const shortWidth = await page.evaluate(
      () => document.querySelector('[data-stand-in="short"]').getBoundingClientRect().width,
    );
    expect(shortWidth).toBeCloseTo(SHORT_TAB_WIDTH, 0);

    expect(m.overlap.brandNav, 'the tabs ran into the brand').toBeGreaterThanOrEqual(0);
    expect(m.content + MARGIN, 'brand + strip + actions + gaps + margin past the content cap').toBeLessThanOrEqual(
      CONTENT_CAP,
    );
  });
});

test.describe('top bar — the same sums at each density stage', () => {
  let app;
  let page;
  let premiumStub;

  test.beforeAll(async () => {
    ({ app, page, premiumStub } = await launchApp());
  });

  test.afterAll(async () => {
    await app?.close();
    await premiumStub?.close();
  });

  for (const [label, width] of [
    ['icon-tabs: glyph strip, brand lockup, actions spelled out', 1160],
    ['brand-mark: glyph strip, brand mark, actions spelled out', 980],
    ['actions-collapsed below the minimum window: overflow button and gear', 860],
  ]) {
    test(`measures ${label}`, async () => {
      await resize(app, page, width);
      const m = await measureBar(page);
      report(`${label} @ window ${width}`, m);
      expect(m.overlap.brandNav).toBeGreaterThanOrEqual(0);
      expect(m.overlap.navActions).toBeGreaterThanOrEqual(m.navToActionsGap - 0.5);
    });
  }
});

test.describe('top bar — which control is current', () => {
  let app;
  let page;
  let premiumStub;

  test.beforeAll(async () => {
    ({ app, page, premiumStub } = await launchApp());
  });

  test.afterAll(async () => {
    await app?.close();
    await premiumStub?.close();
  });

  test('Progression stays current on its Collections page, and the gear alone is current on Settings', async () => {
    await resize(app, page, WIDE_WINDOW);
    const strip = page.locator('nav[aria-label="Main"] button');
    const current = page.locator('nav[aria-label="Main"] button[aria-current="page"]');

    await strip.filter({ hasText: pt('progressionNavLabel') }).click();
    await page.getByRole('tab', { name: pt('collectionsNavLabel'), exact: true }).click();
    await expect(page.getByTestId('collections-view')).toBeVisible({ timeout: 20_000 });
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText(pt('progressionNavLabel'));

    await page.getByTestId('shell-settings').click();
    await expect(page.getByTestId('settings-view')).toBeVisible({ timeout: 20_000 });
    await expect(current).toHaveCount(0);
    await expect(strip).toHaveCount(10);
    await expect(page.getByTestId('shell-settings')).toHaveAttribute('aria-current', 'page');
  });
});
