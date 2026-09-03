/**
 * The top bar as the window narrows. Unit tests can prove which shape a density renders, but not
 * that the shapes actually fit: `renderToStaticMarkup` has no layout, and the failure this guards
 * against — the Settings tab painted under the Open-mini button — was invisible to a green suite.
 * So the widths here are measured in a real window, the same way
 * `shell-measure-and-scrollbars.spec.mjs` measures the panels below it.
 */
import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');

/** `createMainWindow`'s own `minWidth` — the narrowest window a player can drag to. */
const MIN_WINDOW = 960;
/** Below the minimum, reachable only by lifting it as `resize` does. The icon-tab stage lives
 *  here: five worded tabs plus one overflow button still fit at the real minimum, so the stage is
 *  a floor under a future smaller window rather than something a player meets today. */
const ICON_TABS_WINDOW = 760;
/** Narrower still. Five tabs and a menu stop fitting below ~520px, which is 440px past the
 *  smallest window that exists. */
const NARROWEST_MEASURED = 560;

async function launchApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-top-bar-'));
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
      // SAFETY, as in the sibling specs: points the session-token read away from the real
      // %APPDATA% session file so nothing here can issue a live authenticated request.
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
    },
  });

  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  const consentModal = page.getByTestId('consent-modal');
  await expect(consentModal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(consentModal).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('nav[aria-label="Main"] button')).toHaveCount(5, { timeout: 30_000 });

  return { app, page };
}

/** Resizes the real `BrowserWindow` — Playwright's Electron support has no viewport emulation —
 *  lifting the minimum first so a width below it can also be asked for. */
async function resize(app, page, width, height = 800) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setMinimumSize(200, 200);
    win?.setSize(size.width, size.height);
  }, { width, height });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(180);
}

/**
 * The bar's three regions and the room it has for them. Read off `AppShell`'s own structure — the
 * drag handle is the header's `aria-hidden` child, the other two are the left group (brand then
 * tabs) and the actions cluster — because none of them carries a test id and the design-system
 * reuse boundary is the reason they do not.
 */
function topBar(page) {
  return page.evaluate(() => {
    const header = document.querySelector('header');
    const style = getComputedStyle(header);
    const headerRect = header.getBoundingClientRect();
    const groups = [...header.children].filter((el) => el.getAttribute('aria-hidden') === null);
    const [leftGroup, actions] = groups;
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
    };
    return {
      innerWidth: window.innerWidth,
      contentLeft: Math.round(headerRect.left + parseFloat(style.paddingLeft)),
      contentRight: Math.round(headerRect.right - parseFloat(style.paddingRight)),
      headerOverflow: header.scrollWidth - header.clientWidth,
      brand: box(leftGroup.children[0]),
      nav: box(document.querySelector('nav[aria-label="Main"]')),
      actions: box(actions),
    };
  });
}

/** Every tab, in nav order, with the two things that tell a glyph from a word apart. */
function tabs(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Main"] button')].map((el) => ({
      text: el.textContent.trim(),
      ariaLabel: el.getAttribute('aria-label'),
      active: el.getAttribute('aria-current') === 'page',
      glyphs: el.querySelectorAll('svg').length,
    })),
  );
}

test.describe('top bar — degrades as the window narrows, and never overlaps itself', () => {
  let app;
  let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchApp());
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('brand, tabs and actions stay in their own lanes at every width the bar is drawn at', async () => {
    for (let width = 1920; width >= NARROWEST_MEASURED; width -= 20) {
      await resize(app, page, width);
      const bar = await topBar(page);
      const where = `${width}px: ${JSON.stringify(bar)}`;

      expect(bar.brand.right, `the tabs ran into the brand at ${where}`).toBeLessThanOrEqual(bar.nav.left);
      expect(bar.nav.right, `the actions ran into the tabs at ${where}`).toBeLessThanOrEqual(bar.actions.left);
      expect(bar.brand.left, `the brand started left of the bar at ${where}`).toBeGreaterThanOrEqual(
        bar.contentLeft,
      );
      expect(bar.actions.right, `the actions ran past the window at ${where}`).toBeLessThanOrEqual(
        bar.contentRight,
      );
      expect(bar.headerOverflow, `the header overflowed at ${where}`).toBeLessThanOrEqual(0);
    }
  });

  test('spells the actions out beside worded tabs while the window is wide', async () => {
    await resize(app, page, 1280);

    await expect(page.getByTestId('shell-referral')).toBeVisible();
    await expect(page.getByTestId('shell-coffee')).toBeVisible();
    await expect(page.getByTestId('open-mini')).toBeVisible();
    await expect(page.getByTestId('shell-overflow')).toHaveCount(0);
    for (const tab of await tabs(page)) expect(tab.text.length).toBeGreaterThan(0);
  });

  test('collapses the actions behind one button at the smallest real window, tabs still worded', async () => {
    await resize(app, page, MIN_WINDOW);

    await expect(page.getByTestId('shell-overflow')).toBeVisible();
    for (const id of ['shell-referral', 'shell-coffee', 'open-mini']) {
      await expect(page.getByTestId(id), `${id} stayed in the bar past its width`).toHaveCount(0);
    }
    // The half a player navigates by is the half that survives: still five words, no glyphs.
    for (const tab of await tabs(page)) {
      expect(tab.text.length).toBeGreaterThan(0);
      expect(tab.glyphs).toBe(0);
    }
  });

  test('every collapsed action is reachable inside the overflow menu', async () => {
    await resize(app, page, MIN_WINDOW);
    await page.getByTestId('shell-overflow').click();
    await expect(page.getByTestId('shell-overflow-menu')).toBeVisible({ timeout: 10_000 });

    for (const id of [
      'shell-overflow-open-mini',
      'shell-overflow-referral',
      'shell-overflow-coffee',
      'shell-overflow-language-pt',
      'shell-overflow-language-en',
    ]) {
      await expect(page.getByTestId(id), `${id} is not in the overflow menu`).toBeVisible();
    }

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shell-overflow-menu')).toHaveCount(0);
  });

  test('drops the tabs to glyphs below the second width, and keeps the active one named', async () => {
    await resize(app, page, ICON_TABS_WINDOW);
    const rendered = await tabs(page);

    expect(rendered).toHaveLength(5);
    const active = rendered.filter((tab) => tab.active);
    expect(active).toHaveLength(1);
    expect(active[0].text, 'the current screen lost its name').not.toBe('');
    expect(active[0].ariaLabel, 'the active tab is named by its own text, not a label').toBeNull();

    for (const tab of rendered.filter((tab) => !tab.active)) {
      expect(tab.text, 'an inactive tab kept its word instead of its glyph').toBe('');
      expect(tab.glyphs, 'an inactive tab has no glyph to stand in for the word').toBeGreaterThan(0);
      expect(tab.ariaLabel, 'a glyph-only tab has no accessible name').toBeTruthy();
    }

    // The brand is down to its mark: no words, and the flavor badge has gone with them.
    const bar = await topBar(page);
    expect(bar.brand.width).toBeLessThan(60);
    await expect(page.getByTestId('flavor-badge')).toHaveCount(0);
  });

  test('names a glyph tab through the design-system tooltip, never the native title attribute', async () => {
    await resize(app, page, ICON_TABS_WINDOW);
    const inactive = page.locator('nav[aria-label="Main"] button:not([aria-current="page"])').first();
    expect(await inactive.getAttribute('title')).toBeNull();

    await inactive.hover();
    await expect(page.locator('[data-slot="tooltip-popup"]')).toBeVisible({ timeout: 10_000 });
  });

  test('every tab still reaches its screen at the narrowest width the bar is drawn at', async () => {
    await resize(app, page, NARROWEST_MEASURED);
    const screens = ['live-view', 'farm-view', 'inventory-view', 'account-view', 'settings-view'];

    for (const [index, testId] of screens.entries()) {
      await page.locator('nav[aria-label="Main"] button').nth(index).click();
      await expect(page.getByTestId(testId), `tab ${index} did not reach ${testId}`).toBeVisible({
        timeout: 20_000,
      });
    }

    await page.locator('nav[aria-label="Main"] button').nth(0).click();
    await expect(page.getByTestId('live-view')).toBeVisible({ timeout: 20_000 });
  });
});
