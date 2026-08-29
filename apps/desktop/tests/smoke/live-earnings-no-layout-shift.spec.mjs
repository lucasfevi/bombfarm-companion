import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');
const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');

/**
 * Reads the real template off the source of truth (`i18n.spec.mjs`'s own established technique)
 * rather than hardcoding "last {minutes} min" here, so a reword of the copy key moves this
 * assertion with it instead of silently testing stale text.
 */
function readCopyValue(filePath, key) {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) throw new Error(`could not find copy key "${key}" in ${filePath}`);
  return match[1];
}

function recentWindowLabel(minutes) {
  return readCopyValue(EN_COPY_PATH, 'liveEarningsRecentWindowLabel').replace('{minutes}', String(minutes));
}

/**
 * The "last N min" context-line label (`coverageMinutesLabel`, `earnings-panel.tsx`) only ever
 * reads "last 1 min" through "last 10 min" — its shortest and longest real forms. Reaching "last
 * 10 min" legitimately needs ten real minutes of streamed session time (the fold's window is
 * computed off wall-clock time in the main process, nothing here can accelerate it), far past what
 * a smoke suite can spend on one assertion. The property under test is a CSS one regardless — the
 * label reserves space for its own longest form via an always-mounted invisible sizer
 * (`RecentWindowLabel`, `earnings-panel.tsx`), not a size derived from its current content — so
 * this drives the cell straight to its extreme via the DOM and measures every sibling's box around
 * it. Both the mutation and the measurement happen inside one `page.evaluate` call, with no
 * `await` in between, so nothing here races the live stream's own periodic re-render of that same
 * cell.
 */
test.describe('live earnings panel: no layout shift smoke', () => {
  test('every sibling cell holds its box as the "last N min" label grows from its shortest to its longest form', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-earnings-layout-'));
    const electronExec = path.join(
      desktopRoot,
      'node_modules',
      'electron',
      'dist',
      process.platform === 'win32' ? 'electron.exe' : 'electron',
    );

    const app = await electron.launch({
      executablePath: electronExec,
      args: [desktopRoot],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        BFC_FLAVOR: 'dev',
        BFC_GAME_READER: 'fixture',
        BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_FULL_FIXTURE,
        // Dev-only replay live source (`isReplayLiveSourceEnabled`) — an unpackaged launch like
        // this one, exactly what mounts the Earnings panel's real committed-capture data path
        // without a game process on the runner.
        BFC_LIVE_SOURCE: 'replay',
        BFC_USER_DATA_DIR: userDataDir,
        // SAFETY, reproduced from `i18n.spec.mjs`: points the session-token read away from the
        // real %APPDATA%/Godot session file, so an account refresh this spec triggers can never
        // issue a live, authenticated request using whoever's session happens to exist on the
        // runner.
        BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
        ELECTRON_ENABLE_LOGGING: '1',
      },
    });

    try {
      const page = await app.firstWindow();
      await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });

      const consentModal = page.getByTestId('consent-modal');
      await expect(consentModal).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('consent-accept').click();
      await expect(consentModal).toBeHidden({ timeout: 15_000 });

      // Live is the default tab. The Earnings panel (and this label cell) only mounts once the
      // fixture account has resolved at least once — `slow !== null` in `live-view.tsx` — so wait
      // for the cell itself rather than a fixed delay.
      const recentWindowCell = page.getByTestId('live-earnings-recent-window-label');
      await expect(recentWindowCell).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('live-earnings')).toBeVisible();

      const shortText = recentWindowLabel(1);
      const longText = recentWindowLabel(10);

      const { shortBoxes, longBoxes } = await page.evaluate(
        ({ shortText, longText }) => {
          function measureAll() {
            const boxes = {};
            for (const el of document.querySelectorAll('[data-testid^="live-earnings"]')) {
              const testId = el.getAttribute('data-testid');
              const rect = el.getBoundingClientRect();
              boxes[testId] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            }
            return boxes;
          }

          const label = document.querySelector('[data-testid="live-earnings-recent-window-label"]');
          if (!label) throw new Error('live-earnings-recent-window-label not found');

          label.textContent = shortText;
          const shortBoxes = measureAll();

          label.textContent = longText;
          const longBoxes = measureAll();

          return { shortBoxes, longBoxes };
        },
        { shortText, longText },
      );

      const testIds = Object.keys(shortBoxes);
      // At minimum: the panel, the headline band's two rate figures, the recent-window label, the
      // session-average readout, the reset control, and the six tiles (`earnings-panel.tsx`'s own
      // testids) — asserting there is something real to compare, not an empty pass.
      expect(testIds.length).toBeGreaterThanOrEqual(10);

      for (const testId of testIds) {
        expect(longBoxes[testId], `box for "${testId}" moved or resized`).toEqual(shortBoxes[testId]);
      }

      await app.close();
    } finally {
      await app.close().catch(() => undefined);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
