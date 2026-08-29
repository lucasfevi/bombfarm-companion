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
 * rather than hardcoding "Last {minutes} min" here, so a reword of the copy key moves this
 * assertion with it instead of silently testing stale text.
 */
function readCopyValue(filePath, key) {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) throw new Error(`could not find copy key "${key}" in ${filePath}`);
  return match[1];
}

function goldRecentLabel(minutes) {
  return readCopyValue(EN_COPY_PATH, 'liveEarningsGoldRecentLabel').replace('{minutes}', String(minutes));
}

function xpRecentLabel(minutes) {
  return readCopyValue(EN_COPY_PATH, 'liveEarningsXpRecentLabel').replace('{minutes}', String(minutes));
}

/**
 * The "gold/xp · last N min" labels (`coverageMinutesLabel`, `earnings-panel.tsx`) only ever read
 * "last 1 min" through "last 10 min" — their shortest and longest real forms. Reaching "last 10
 * min" legitimately needs ten real minutes of streamed session time (the fold's window is computed
 * off wall-clock time in the main process, nothing here can accelerate it), far past what a smoke
 * suite can spend on one assertion. The property under test is a CSS one regardless — each label
 * cell reserves space for its own longest form via an always-mounted invisible sizer
 * (`RecentLabel`, `earnings-panel.tsx`), not a size derived from its current content — so this
 * drives both cells straight to each extreme via the DOM and measures every sibling's box around
 * them. Both mutations and both measurements happen inside one `page.evaluate` call, with no
 * `await` in between, so nothing here races the live stream's own periodic re-render of those same
 * cells.
 */
test.describe('live earnings panel: no layout shift smoke', () => {
  test('every sibling cell holds its box as the "last N min" labels grow from their shortest to their longest form', async () => {
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

      // Live is the default tab. The Earnings panel (and these label cells) only mounts once the
      // fixture account has resolved at least once — `slow !== null` in `live-view.tsx` — so wait
      // for a cell itself rather than a fixed delay.
      const goldRecentCell = page.getByTestId('live-earnings-gold-10-label');
      await expect(goldRecentCell).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('live-earnings')).toBeVisible();

      const goldShortText = goldRecentLabel(1);
      const goldLongText = goldRecentLabel(10);
      const xpShortText = xpRecentLabel(1);
      const xpLongText = xpRecentLabel(10);

      const { shortBoxes, longBoxes } = await page.evaluate(
        ({ goldShortText, goldLongText, xpShortText, xpLongText }) => {
          function measureAll() {
            const boxes = {};
            for (const el of document.querySelectorAll('[data-testid^="live-earnings"]')) {
              const testId = el.getAttribute('data-testid');
              const rect = el.getBoundingClientRect();
              boxes[testId] = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
            }
            return boxes;
          }

          const goldLabel = document.querySelector('[data-testid="live-earnings-gold-10-label"]');
          const xpLabel = document.querySelector('[data-testid="live-earnings-xp-10-label"]');
          if (!goldLabel) throw new Error('live-earnings-gold-10-label not found');
          if (!xpLabel) throw new Error('live-earnings-xp-10-label not found');

          goldLabel.textContent = goldShortText;
          xpLabel.textContent = xpShortText;
          const shortBoxes = measureAll();

          goldLabel.textContent = goldLongText;
          xpLabel.textContent = xpLongText;
          const longBoxes = measureAll();

          return { shortBoxes, longBoxes };
        },
        { goldShortText, goldLongText, xpShortText, xpLongText },
      );

      const testIds = Object.keys(shortBoxes);
      // At minimum: the panel, the five value cells, the two "last N min" labels, the
      // session-duration readout and the reset control (`earnings-panel.tsx`'s own testids) —
      // asserting there is something real to compare, not an empty pass.
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
