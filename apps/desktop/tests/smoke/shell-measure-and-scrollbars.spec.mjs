import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');

/** `createMainWindow`'s own `minWidth`/`minHeight` — the smallest window a player can drag to, and
 *  therefore the width every layout rule here has to survive. */
const MIN_WINDOW = { width: 960, height: 640 };
/** `--container-desktop`. Past this the content stops growing and the background takes the rest. */
const MAX_CONTENT = 1440;
/** `--container-settings`. A settings row is a label at one edge and its control at the other, so
 *  it gets a tighter measure than the tabs that fill their width. */
const MAX_SETTINGS = 768;

async function launchLiveApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-live-layout-'));
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
  await expect(page.getByTestId('live-earnings')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('live-map')).toBeVisible();

  return { app, page };
}

/** Resizes the real `BrowserWindow` — Playwright's Electron support has no viewport emulation —
 *  lifting the minimum first so a width below it can also be asked for. */
async function resize(app, page, width, height) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win?.setMinimumSize(200, 200);
    win?.setSize(size.width, size.height);
  }, { width, height });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(200);
}

/**
 * Tries to scroll the document and reports how far it actually moved. This is the measurement that
 * matters rather than `scrollHeight`: a second scrollbar is exactly "the window itself can be
 * scrolled", and the failure this guards against reached the screen while every unit test passed.
 */
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

/** Every element the user could actually scroll, so "how many scrollbars are on screen" is counted
 *  rather than inferred. `<main>` is the one legitimate entry. */
function scrollContainers(page) {
  return page.evaluate(() => {
    const found = [];
    for (const el of document.querySelectorAll('*')) {
      const style = getComputedStyle(el);
      const scrollsY = /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
      const scrollsX = /(auto|scroll)/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
      if (scrollsY || scrollsX) {
        found.push({
          tag: el.tagName.toLowerCase(),
          testId: el.getAttribute('data-testid'),
          scrollsY,
          scrollsX,
        });
      }
    }
    return found;
  });
}

function boxes(page, testIds) {
  return page.evaluate((ids) => {
    const out = {};
    for (const id of ids) {
      const el = document.querySelector(`[data-testid="${id}"]`);
      if (!el) throw new Error(`missing ${id}`);
      const r = el.getBoundingClientRect();
      out[id] = {
        left: Math.round(r.left),
        right: Math.round(r.right),
        top: Math.round(r.top),
        width: Math.round(r.width),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    }
    return out;
  }, testIds);
}

test.describe('shell measure — one scrollbar, two columns, capped and centred content', () => {
  let app;
  let page;

  test.beforeAll(async () => {
    ({ app, page } = await launchLiveApp());
  });

  test.afterAll(async () => {
    await app?.close();
  });

  test('the window never scrolls, at any size the user can drag it to', async () => {
    for (const size of [
      MIN_WINDOW,
      { width: 1280, height: 800 },
      { width: MAX_CONTENT, height: 700 },
      { width: 1920, height: 1080 },
    ]) {
      await resize(app, page, size.width, size.height);

      const moved = await documentScrollRange(page);
      const containers = await scrollContainers(page);
      const detail = `${size.width}x${size.height}: ${JSON.stringify(containers)}`;

      expect(moved, `the document itself scrolled at ${detail}`).toEqual({ x: 0, y: 0 });
      expect(containers.filter((c) => c.tag !== 'main'), `only <main> may scroll — ${detail}`).toEqual([]);
    }
  });

  /** Portuguese is the binding language for this row: its map labels are the widest strings either
   *  language puts in the panel, so English fitting proves nothing about the width that matters. */
  async function expectSideBySideAtMinimumWidth(language) {
    await resize(app, page, MIN_WINDOW.width, MIN_WINDOW.height);
    const measured = await boxes(page, ['live-earnings', 'live-map']);

    expect(measured['live-earnings'].top, `${language}: panels fell onto separate rows`).toBe(
      measured['live-map'].top,
    );
    expect(measured['live-map'].left).toBeGreaterThan(measured['live-earnings'].right);
    // Both panels must fit what they were given rather than spilling: the earnings panel's content
    // is fixed-width and cannot reflow, so a column too narrow for it overflows instead of wrapping.
    for (const [id, box] of Object.entries(measured)) {
      expect(
        box.scrollWidth,
        `${language}: ${id} overflowed its column at the minimum window width`,
      ).toBeLessThanOrEqual(box.clientWidth);
    }
  }

  test('keeps the earnings and map panels side by side down to the smallest window, in both languages', async () => {
    await expectSideBySideAtMinimumWidth('English');

    // Same technique as `i18n.spec.mjs` — the nav carries no test ids by design, so it is indexed.
    // Settings is the last entry; addressed as such rather than by number, because a nav that
    // gains a tab moves every number after it and this spec then clicks the wrong screen.
    await resize(app, page, 1280, 800);
    await page.locator('nav[aria-label="Main"] button').last().click();
    const select = page.getByRole('combobox', { name: 'App language' });
    await select.waitFor({ state: 'visible', timeout: 10_000 });
    await select.click();
    await page.getByRole('option', { name: 'Portuguese (Brazil)' }).click();
    await page.locator('nav[aria-label="Main"] button').nth(0).click();
    await expect(page.getByTestId('live-map')).toBeVisible({ timeout: 15_000 });

    await expectSideBySideAtMinimumWidth('Portuguese');
  });

  test('stops growing the content at the measure and centres it, leaving the background to widen', async () => {
    await resize(app, page, 2560, 900);
    const measured = await boxes(page, ['live-heroes', 'live-earnings']);

    expect(measured['live-heroes'].width).toBeLessThanOrEqual(MAX_CONTENT);
    // Centred: equal gaps either side. Measured against `<main>`'s client box rather than the
    // window, because the scroll region's own scrollbar takes real width off the right-hand side —
    // comparing to `innerWidth` would read that scrollbar as the content being off-centre.
    const region = await page.evaluate(() => {
      const main = document.querySelector('main');
      const rect = main.getBoundingClientRect();
      return { left: Math.round(rect.left), right: Math.round(rect.left + main.clientWidth) };
    });
    const leftGap = measured['live-heroes'].left - region.left;
    const rightGap = region.right - measured['live-heroes'].right;
    expect(Math.abs(leftGap - rightGap)).toBeLessThanOrEqual(1);
    expect(leftGap, 'a window wider than the measure must leave background either side').toBeGreaterThan(0);
    expect(measured['live-earnings'].top).toBe((await boxes(page, ['live-map']))['live-map'].top);
  });

  test('holds the settings sections to their own measure instead of letting them span the window', async () => {
    // Settings is the last entry — see the note above on why it is not addressed by number.
    await page.locator('nav[aria-label="Main"] button').last().click();
    await expect(page.getByTestId('settings-view')).toBeVisible({ timeout: 15_000 });

    for (const width of [MIN_WINDOW.width, MAX_CONTENT, 2560]) {
      await resize(app, page, width, 900);
      const measured = await boxes(page, ['settings-view']);
      const region = await page.evaluate(() => {
        const main = document.querySelector('main');
        const rect = main.getBoundingClientRect();
        return { left: Math.round(rect.left), right: Math.round(rect.left + main.clientWidth) };
      });

      expect(measured['settings-view'].width, `settings spanned the window at ${width}px`).toBeLessThanOrEqual(
        MAX_SETTINGS,
      );
      const leftGap = measured['settings-view'].left - region.left;
      const rightGap = region.right - measured['settings-view'].right;
      expect(Math.abs(leftGap - rightGap), `settings sat off-centre at ${width}px`).toBeLessThanOrEqual(1);
      expect(await documentScrollRange(page)).toEqual({ x: 0, y: 0 });
    }
  });
});
