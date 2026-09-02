import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

async function launchLiveApp(userDataDir, { grantConsent = true } = {}) {
  const app = await electron.launch({
    executablePath: electronExecutable(),
    args: [desktopRoot],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_FULL_FIXTURE,
      BFC_LIVE_SOURCE: 'replay',
      BFC_USER_DATA_DIR: userDataDir,
      // SAFETY, reproduced from the other Live smokes: points the session-token read away from the
      // real %APPDATA% session file, so nothing here can issue a live authenticated request.
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      ELECTRON_ENABLE_LOGGING: '1',
    },
  });

  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });

  const consentModal = page.getByTestId('consent-modal');
  if (grantConsent) {
    await expect(consentModal).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('consent-accept').click();
  }
  await expect(consentModal).toBeHidden({ timeout: 30_000 });

  await page.waitForSelector('[data-testid="live-hero-list"]', { timeout: 60_000 });
  return { app, page };
}

function windowCount(app) {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
}

/** The mini is the narrow one: its maximum sits well below the main window's 960px minimum. */
function setMiniWidth(app, width) {
  return app.evaluate(({ BrowserWindow }, target) => {
    const windows = BrowserWindow.getAllWindows();
    const mini = windows.reduce((a, b) => (a.getBounds().width <= b.getBounds().width ? a : b));
    mini.setBounds({ ...mini.getBounds(), width: target });
  }, width);
}

/**
 * Measured on the panel, not the list: the panel is the `overflow-auto` scroll container, so it is
 * the element that grew a horizontal scrollbar when a row was too wide for it. A `<ul>` inside it
 * is stretched to the container's width and reports no overflow of its own.
 */
function heroListGeometry(mini) {
  return mini.evaluate(() => {
    const panel = document.querySelector('[data-testid="mini-heroes"]');
    const list = document.querySelector('[data-testid="live-hero-list"]');
    if (!panel || !list) throw new Error('hero panel not rendered');
    const rows = [...list.querySelectorAll('li[data-testid^="live-hero-row-"]')];
    const gapReadingToBar = rows.map((row) => {
      const reading = row.querySelector('[data-testid$="-energy"]');
      const bar = row.querySelector('[data-testid$="-energy-bar"]');
      if (!reading || !bar) return null;
      return Math.round(bar.getBoundingClientRect().left - reading.getBoundingClientRect().right);
    });
    const readingLeft = rows
      .map((row) => row.querySelector('[data-testid$="-energy"]'))
      .filter(Boolean)
      .map((reading) => Math.round(reading.getBoundingClientRect().left - reading.closest('li').getBoundingClientRect().left));
    return {
      heights: rows.map((row) => Math.round(row.getBoundingClientRect().height)),
      gapReadingToBar: gapReadingToBar.filter((gap) => gap !== null),
      distinctReadingOffsets: new Set(readingLeft).size,
      scrollWidth: panel.scrollWidth,
      clientWidth: panel.clientWidth,
    };
  });
}

test.describe('compact Live window smoke', () => {
  test('Open mini opens a second window fed by the same live stream, and its close control tears it down', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-mini-live-'));
    let app;

    try {
      let page;
      ({ app, page } = await launchLiveApp(userDataDir));

      const miniOpened = app.waitForEvent('window', { timeout: 30_000 });
      await page.getByTestId('open-mini').click();
      const mini = await miniOpened;

      await expect(mini.getByTestId('mini-live-page')).toBeVisible({ timeout: 30_000 });
      await expect(mini.getByTestId('mini-earnings')).toBeVisible();
      await expect(mini.getByTestId('mini-map')).toBeVisible();
      await expect(mini.getByTestId('mini-heroes')).toHaveCount(0);
      // Printed only once a map frame has reached this window — proves the broadcast reaches the
      // second renderer, not just the one that asked for it.
      await expect(mini.getByTestId('live-map-phase')).toBeVisible({ timeout: 30_000 });
      await expect(mini.getByTestId('mini-live-close')).not.toHaveAttribute('title', /.+/);

      await mini.getByTestId('mini-live-close').click();
      await expect.poll(() => windowCount(app), { timeout: 15_000 }).toBe(1);

      const reopened = app.waitForEvent('window', { timeout: 30_000 });
      await page.getByTestId('open-mini').click();
      const second = await reopened;
      await expect(second.getByTestId('mini-live-page')).toBeVisible({ timeout: 30_000 });

      await second.getByTestId('mini-live-close').click();
      await expect.poll(() => windowCount(app), { timeout: 15_000 }).toBe(1);
    } finally {
      await app?.close().catch(() => undefined);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  /**
   * The defect this replaces: the hero row's fixed columns needed more width than the panel had,
   * so the one flexible track collapsed to zero, the name rendered as nothing, and the list
   * overflowed sideways instead of truncating. Neither the markup assertions in the unit test nor
   * a screenshot of one frame can see any of that — only the rendered geometry can, and only at a
   * real window width.
   */
  test('hero rows hold one height and the list never scrolls sideways, narrow or wide', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-mini-rows-'));
    let app;

    try {
      let page;
      ({ app, page } = await launchLiveApp(userDataDir));

      const miniOpened = app.waitForEvent('window', { timeout: 30_000 });
      await page.getByTestId('open-mini').click();
      const mini = await miniOpened;
      await expect(mini.getByTestId('mini-live-page')).toBeVisible({ timeout: 30_000 });

      // Heroes ships off, so the panel under test has to be switched on the way a player would.
      await mini.getByTestId('mini-live-gear').click();
      await mini.getByRole('switch', { name: 'Heroes' }).click();
      await mini.keyboard.press('Escape');
      await expect(mini.getByTestId('mini-heroes')).toBeVisible({ timeout: 30_000 });
      await mini.waitForSelector('[data-testid="live-hero-list"]', { timeout: 30_000 });

      for (const width of [320, 820]) {
        await setMiniWidth(app, width);
        await expect
          .poll(async () => (await heroListGeometry(mini)).clientWidth, { timeout: 10_000 })
          .toBeGreaterThan(0);

        const { heights, gapReadingToBar, distinctReadingOffsets, scrollWidth, clientWidth } =
          await heroListGeometry(mini);

        // The reading labels the bar, so it stays beside it however wide the window is dragged.
        // Pinned to the row's right edge instead, it measured 409px from its own hero at 557px.
        expect(Math.max(...gapReadingToBar), `reading adrift from its bar at ${String(width)}px`).toBeLessThanOrEqual(12);
        // And every row puts it in the same place, so readings compare down the list.
        expect(distinctReadingOffsets, `reading column ragged at ${String(width)}px`).toBe(1);

        expect(heights.length, `rows at ${String(width)}px`).toBeGreaterThan(1);
        expect(new Set(heights).size, `distinct row heights at ${String(width)}px: ${heights.join(',')}`).toBe(1);
        // The row declares 36px for its two lines. A cell that wrapped instead of truncating
        // pushes it to ~48, which is the shape this layout replaced — so the ceiling is what
        // catches a regression here, not the equality above: every row wraps alike, so they stay
        // equal to each other while all growing together.
        expect(Math.max(...heights), `tallest row at ${String(width)}px`).toBeLessThanOrEqual(40);
        expect(scrollWidth, `sideways overflow at ${String(width)}px`).toBeLessThanOrEqual(clientWidth);
      }
    } finally {
      await app?.close().catch(() => undefined);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  /**
   * The control is gated on account access in the main process, not only in the renderer, and the
   * grant it reads on a warm start comes from the store rather than from the modal the first run
   * showed. A gate that answered "not granted" there would leave a button that silently does
   * nothing, which no fresh-profile run can catch.
   */
  test('the control still opens the mini on a relaunch that reads its grant from the store', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-mini-warm-'));
    let first;
    let second;

    try {
      ({ app: first } = await launchLiveApp(userDataDir));
      await first.close();
      first = undefined;

      let page;
      ({ app: second, page } = await launchLiveApp(userDataDir, { grantConsent: false }));

      await expect(page.getByTestId('open-mini')).toBeVisible({ timeout: 15_000 });

      const miniOpened = second.waitForEvent('window', { timeout: 30_000 });
      await page.getByTestId('open-mini').click();
      await expect((await miniOpened).getByTestId('mini-live-page')).toBeVisible({ timeout: 30_000 });
    } finally {
      await first?.close().catch(() => undefined);
      await second?.close().catch(() => undefined);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
