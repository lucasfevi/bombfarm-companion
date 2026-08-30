import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');
const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');
const PT_BR_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'pt-BR.ts');

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

const en = (key) => readCopyValue(EN_COPY_PATH, key);
const pt = (key) => readCopyValue(PT_BR_COPY_PATH, key);

/** The six fixed-width blocks, `earnings-panel.tsx`'s own `blockTestId`s — every one of them
 *  reserves the same three lines (label, value, age) and must land on the same box size. */
const BLOCK_TEST_IDS = [
  'live-earnings-block-current-gold',
  'live-earnings-block-gold-rate',
  'live-earnings-block-gold-total',
  'live-earnings-block-elapsed',
  'live-earnings-block-xp-rate',
  'live-earnings-block-xp-total',
];

/**
 * Measures, for each of the six blocks, its own box and its label's overflow/height — the two
 * signals that together catch both failure modes this panel has already shipped once each: a
 * column that resizes (caught by the width/height comparison across blocks) and a label that
 * wraps instead of fitting (caught per-label: `whitespace-nowrap` means a too-long label
 * overflows its box rather than growing taller, so `scrollWidth > clientWidth` is the overflow
 * signal, and a label that DID wrap despite the class would show up as a taller-than-its-siblings
 * `labelHeight` instead).
 */
function measureBlocks(page) {
  return page.evaluate((blockTestIds) => {
    return blockTestIds.map((testId) => {
      const block = document.querySelector(`[data-testid="${testId}"]`);
      if (!block) throw new Error(`block not found: ${testId}`);
      const label = block.firstElementChild;
      if (!label) throw new Error(`label not found in block: ${testId}`);
      const blockRect = block.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      return {
        testId,
        width: blockRect.width,
        height: blockRect.height,
        labelText: label.textContent,
        labelScrollWidth: label.scrollWidth,
        labelClientWidth: label.clientWidth,
        labelHeight: labelRect.height,
      };
    });
  }, BLOCK_TEST_IDS);
}

/** Asserts the properties every block must hold regardless of which language is active:
 *  identical block width, identical block height, no label overflowing its column, and every
 *  label rendering at the same (single-line) height as its siblings. */
function assertBlocksHoldTheirShape(blocks) {
  const detail = JSON.stringify(blocks, null, 2);

  const widths = new Set(blocks.map((block) => Math.round(block.width)));
  expect(widths.size, `all six blocks must share one width:\n${detail}`).toBe(1);

  const heights = new Set(blocks.map((block) => Math.round(block.height)));
  expect(heights.size, `all six blocks must share one height:\n${detail}`).toBe(1);

  const labelHeights = new Set(blocks.map((block) => Math.round(block.labelHeight)));
  expect(labelHeights.size, `every label must render at one single-line height:\n${detail}`).toBe(1);

  for (const block of blocks) {
    expect(
      block.labelScrollWidth,
      `label "${block.labelText}" (${block.testId}) overflowed its fixed-width column`,
    ).toBeLessThanOrEqual(block.labelClientWidth);
  }
}

/** The Live/Planning/Inventory/Settings nav buttons, by position — same technique as
 *  `i18n.spec.mjs`'s own `navButton` (`packages/ui` ships no `data-testid` on these, by design). */
function navButton(page, index) {
  return page.locator('nav[aria-label="Main"] button').nth(index);
}

async function switchToPortuguese(page) {
  await navButton(page, 3).click();
  const select = page.getByRole('combobox', { name: en('settingsLanguageLabel') });
  await select.waitFor({ state: 'visible', timeout: 10_000 });
  await select.click();
  await page.getByRole('option', { name: en('settingsLanguageOptionPortuguese') }).click();
  await navButton(page, 0).click();
  await page.waitForSelector('[data-testid="live-earnings"]', { timeout: 15_000 });
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

  test('the six blocks share one width and one height, and no label overflows its fixed column, in English and in Portuguese', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-earnings-blocks-'));
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
        BFC_LIVE_SOURCE: 'replay',
        BFC_USER_DATA_DIR: userDataDir,
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

      await expect(page.getByTestId('live-earnings-recent-window-label')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('live-earnings')).toBeVisible();

      const englishBlocks = await measureBlocks(page);
      assertBlocksHoldTheirShape(englishBlocks);

      // Sanity check that this really did read English text, so a passing assertion above isn't
      // accidentally measuring the same content twice under two different labels.
      const currentGoldBlockEn = englishBlocks.find((block) => block.testId === 'live-earnings-block-current-gold');
      expect(currentGoldBlockEn?.labelText).toBe(en('liveEarningsCurrentGoldLabel'));

      // Portuguese is where this panel has actually wrapped before (longer words, same fixed
      // column) — switching in place and re-measuring is the whole point of this second pass
      // rather than only ever checking the English strings.
      await switchToPortuguese(page);

      const portugueseBlocks = await measureBlocks(page);
      assertBlocksHoldTheirShape(portugueseBlocks);

      const currentGoldBlockPt = portugueseBlocks.find((block) => block.testId === 'live-earnings-block-current-gold');
      expect(currentGoldBlockPt?.labelText).toBe(pt('liveEarningsCurrentGoldLabel'));

      await app.close();
    } finally {
      await app.close().catch(() => undefined);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
