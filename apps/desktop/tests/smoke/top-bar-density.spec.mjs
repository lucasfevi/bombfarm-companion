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

/** Wide enough to spell every word in the bar. 1320, not the 1280 six tabs were happy at: the
 *  seventh took the whole-bar sum to 1157, and 1280 leaves only 23px over it — inside the range a
 *  font-rendering pass moves. */
const FULL_WINDOW = 1320;
/** Inside the band where the tabs are glyphs and everything else is untouched. */
const ICON_TABS_WINDOW = 1120;
/** `createMainWindow`'s own `minWidth` — the narrowest window a player can drag to. */
const MIN_WINDOW = 960;
/** Below the minimum, reachable only by lifting it as `resize` does. The overflow stage lives
 *  here: glyph tabs, a brand mark and all five actions still fit at the real minimum even with seven tabs, so the stage
 *  is a floor under a future smaller window rather than one a player meets today.
 *
 *  A probe, not a boundary: the stage starts where the window minus the caption cluster falls
 *  under `SHELL_ACTIONS_COLLAPSE_WIDTH`, so this has to stay under that sum plus the cluster's
 *  own width and moves whenever either does. */
const ACTIONS_COLLAPSED_WINDOW = 860;
/** Narrower still. Seven glyph tabs, a mark and a menu stop fitting below ~610px, which is 350px
 *  past the smallest window that exists. */
const NARROWEST_MEASURED = 640;

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
  await expect(page.locator('nav[aria-label="Main"] button')).toHaveCount(7, { timeout: 30_000 });

  // Portuguese, because it is the binding language: its tab words and its action labels are the
  // longest either language puts in the bar, so a width that fits here fits in English too. The
  // widths this file asserts against were measured in it.
  await page.locator('[role="group"] button', { hasText: 'PT' }).click();
  await expect(page.locator('nav[aria-label="Main"] button').first()).toHaveText('Ao vivo');

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
 * drag handle is the header's `aria-hidden` child, and the bar inside it holds the left group
 * (brand then tabs) and the actions cluster — because none of them carries a test id and the
 * design-system reuse boundary is the reason they do not.
 */
function topBar(page) {
  return page.evaluate(() => {
    const header = document.querySelector('header');
    const bar = [...header.children].find((el) => el.getAttribute('aria-hidden') === null);
    const style = getComputedStyle(bar);
    const barRect = bar.getBoundingClientRect();
    const [leftGroup, actions] = bar.children;
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width) };
    };
    return {
      innerWidth: window.innerWidth,
      contentLeft: Math.round(barRect.left + parseFloat(style.paddingLeft)),
      contentRight: Math.round(barRect.right - parseFloat(style.paddingRight)),
      headerOverflow: header.scrollWidth - header.clientWidth,
      brand: box(leftGroup.children[0]),
      nav: box(document.querySelector('nav[aria-label="Main"]')),
      actions: box(actions),
      caption: {
        ...box(document.querySelector('[data-testid="window-controls"]')),
        top: Math.round(
          document.querySelector('[data-testid="window-controls"]').getBoundingClientRect().top,
        ),
      },
    };
  });
}

/** Where the header, the content and the status strip each start and end. */
function bands(page) {
  return page.evaluate(() => {
    const edges = (el) => {
      const r = el.getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right) };
    };
    const header = document.querySelector('header');
    return {
      bar: edges([...header.children].find((el) => el.getAttribute('aria-hidden') === null)),
      content: edges(document.querySelector('main > div')),
      status: edges(document.querySelector('footer > div')),
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

      // The caption buttons are out of flow, so nothing in the bar shrinks around them — the
      // clearance the bar holds is the only thing keeping the last action out from under the
      // close button, and it is a computed value that a gutter change can quietly invalidate.
      expect(bar.actions.right, `the actions ran under the caption buttons at ${where}`).toBeLessThanOrEqual(
        bar.caption.left,
      );
      expect(bar.caption.right, `the caption buttons left the window corner at ${where}`).toBe(width);
      expect(bar.caption.top, `the caption buttons dropped off the top edge at ${where}`).toBe(0);
    }
  });

  test('the bar and the status strip sit on the content measure, so a wide window lines all three up', async () => {
    // Above the measure the three bands are gutters apart from the window edge rather than flush
    // to it, and a pixel of disagreement between them reads as a crooked shell.
    for (const width of [1920, 1600]) {
      await resize(app, page, width);
      const { bar, content, status } = await bands(page);
      const where = `${width}px: ${JSON.stringify({ bar, content, status })}`;

      expect(bar.left, `the bar started left of the panels at ${where}`).toBe(content.left);
      expect(status.left, `the status strip started left of the panels at ${where}`).toBe(content.left);
      expect(Math.abs(bar.right - content.right), `the bar ended past the panels at ${where}`)
        .toBeLessThanOrEqual(1);
      expect(Math.abs(status.right - content.right), `the status strip ended past the panels at ${where}`)
        .toBeLessThanOrEqual(1);
    }
  });

  test('spells the actions out beside worded tabs while the window is wide', async () => {
    await resize(app, page, FULL_WINDOW);

    await expect(page.getByTestId('shell-referral')).toBeVisible();
    await expect(page.getByTestId('shell-coffee')).toBeVisible();
    await expect(page.getByTestId('open-mini')).toBeVisible();
    await expect(page.getByTestId('shell-overflow')).toHaveCount(0);
    for (const tab of await tabs(page)) expect(tab.text.length).toBeGreaterThan(0);
  });

  test('drops the tabs to glyphs before it touches the brand or an action', async () => {
    await resize(app, page, ICON_TABS_WINDOW);

    await expect(page.getByTestId('shell-referral')).toBeVisible();
    await expect(page.getByTestId('shell-coffee')).toBeVisible();
    await expect(page.getByTestId('open-mini')).toBeVisible();
    await expect(page.getByTestId('shell-overflow')).toHaveCount(0);
    // Which build this is, drawn rather than merely reported over IPC — the boot smoke asserts
    // the label, and this is the only spec that sets a width wide enough to see it.
    await expect(page.getByTestId('flavor-badge')).toHaveText('DEV');

    for (const tab of (await tabs(page)).filter((tab) => !tab.active)) {
      expect(tab.text, 'an inactive tab kept its word instead of its glyph').toBe('');
      expect(tab.glyphs, 'an inactive tab has no glyph to stand in for the word').toBeGreaterThan(0);
    }
  });

  test('keeps every action its own control at the smallest real window', async () => {
    await resize(app, page, MIN_WINDOW);

    await expect(page.getByTestId('shell-overflow')).toHaveCount(0);
    for (const id of ['shell-referral', 'shell-coffee', 'open-mini']) {
      await expect(page.getByTestId(id), `${id} left the bar before it had to`).toBeVisible();
    }
    // What has given way by here is the brand's words, not a control: the mark stays, the badge goes.
    const bar = await topBar(page);
    expect(bar.brand.width).toBeLessThan(60);
    await expect(page.getByTestId('flavor-badge')).toHaveCount(0);
  });

  test('collapses the actions behind one button only below the smallest real window', async () => {
    await resize(app, page, ACTIONS_COLLAPSED_WINDOW);

    await expect(page.getByTestId('shell-overflow')).toBeVisible();
    for (const id of ['shell-referral', 'shell-coffee', 'open-mini']) {
      await expect(page.getByTestId(id), `${id} stayed in the bar past its width`).toHaveCount(0);
    }
  });

  test('every collapsed action is reachable inside the overflow menu', async () => {
    await resize(app, page, ACTIONS_COLLAPSED_WINDOW);
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

  test('keeps the active tab named however narrow the bar gets', async () => {
    await resize(app, page, NARROWEST_MEASURED);
    const rendered = await tabs(page);

    expect(rendered).toHaveLength(7);
    const active = rendered.filter((tab) => tab.active);
    expect(active).toHaveLength(1);
    expect(active[0].text, 'the current screen lost its name').not.toBe('');
    expect(active[0].ariaLabel, 'the active tab is named by its own text, not a label').toBeNull();

    for (const tab of rendered.filter((tab) => !tab.active)) {
      expect(tab.text, 'an inactive tab kept its word instead of its glyph').toBe('');
      expect(tab.glyphs, 'an inactive tab has no glyph to stand in for the word').toBeGreaterThan(0);
      expect(tab.ariaLabel, 'a glyph-only tab has no accessible name').toBeTruthy();
    }
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
    const screens = [
      'live-view',
      'farm-view',
      'heroes-view',
      'inventory-view',
      'forge-view',
      'account-view',
      'settings-view',
    ];

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
