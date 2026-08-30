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
 * Every test in this file needs the same boot: launch against the replayed fixture account,
 * dismiss consent, wait for the Earnings panel to actually mount. Pulled out once three tests
 * needed it rather than three near-identical copies of the same ~25 lines.
 */
async function launchEarningsPanelApp(tmpPrefix) {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), tmpPrefix));
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
      // SAFETY, reproduced from `i18n.spec.mjs`: points the session-token read away from the real
      // %APPDATA%/Godot session file, so an account refresh this spec triggers can never issue a
      // live, authenticated request using whoever's session happens to exist on the runner.
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      ELECTRON_ENABLE_LOGGING: '1',
    },
  });

  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });

  const consentModal = page.getByTestId('consent-modal');
  await expect(consentModal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(consentModal).toBeHidden({ timeout: 15_000 });

  // Live is the default tab. The Earnings panel only mounts once the fixture account has resolved
  // at least once — `slow !== null` in `live-view.tsx` — so wait for one of its own cells rather
  // than a fixed delay.
  await expect(page.getByTestId('live-earnings-recent-window-label')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('live-earnings')).toBeVisible();

  return { app, page, userDataDir };
}

/**
 * Resizes the real window via its `BrowserWindow` (Playwright's Electron support has no viewport
 * emulation of its own — a real page's `setViewportSize` isn't available here), then gives the
 * renderer a couple of frames plus a short settle window before the caller measures anything.
 */
async function resizeWindow(app, page, width, height) {
  await app.evaluate(({ BrowserWindow }, size) => {
    BrowserWindow.getAllWindows()[0]?.setSize(size.width, size.height);
  }, { width, height });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(150);
}

/**
 * Every element inside the earnings panel, checked against the panel's own bounding box — the
 * direct measurement for "nothing spills past the panel's border" at whatever width the window
 * currently is.
 */
function measureOverflow(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-testid="live-earnings"]');
    if (!panel) throw new Error('live-earnings panel not found');
    const panelRect = panel.getBoundingClientRect();
    const EPSILON = 0.5;
    const offenders = [];
    for (const el of panel.querySelectorAll('*')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.left < panelRect.left - EPSILON || rect.right > panelRect.right + EPSILON) {
        offenders.push({
          testId: el.getAttribute('data-testid') ?? el.tagName,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
        });
      }
    }
    return { panelLeft: Math.round(panelRect.left), panelRight: Math.round(panelRect.right), offenders };
  });
}

/** The reset control's own box, and the headline column's and every block's — measured
 *  separately so the comparison (does either rectangle overlap the other) happens in Node,
 *  not baked into the page's own JS. */
function measureResetAndContentBoxes(page) {
  return page.evaluate((blockTestIds) => {
    const rectOf = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    };
    const button = document.querySelector('[data-testid="live-earnings-reset"]');
    const headline = document.querySelector('[data-testid="live-earnings-headline-column"]');
    if (!button || !headline) throw new Error('reset control or headline column not found');
    const others = [headline, ...blockTestIds.map((id) => document.querySelector(`[data-testid="${id}"]`))].filter(
      (el) => el,
    );
    return { buttonRect: rectOf(button), otherRects: others.map(rectOf) };
  }, BLOCK_TEST_IDS);
}

function rectsOverlap(a, b) {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

/**
 * The same technique the headline-column test below drives its own cell with, factored out so the
 * responsiveness sweep can repeat it at every width without a second copy of the inline
 * `page.evaluate`.
 */
function measureHeadlineForms(page) {
  const forms = { short: '1k', long: '999.9m', noData: '—' };
  return page.evaluate((figureForms) => {
    const column = document.querySelector('[data-testid="live-earnings-headline-column"]');
    const gold = document.querySelector('[data-testid="live-earnings-gold-10"]');
    const xp = document.querySelector('[data-testid="live-earnings-xp-10"]');
    if (!column) throw new Error('live-earnings-headline-column not found');
    if (!gold) throw new Error('live-earnings-gold-10 not found');
    if (!xp) throw new Error('live-earnings-xp-10 not found');

    const results = {};
    for (const [stateName, text] of Object.entries(figureForms)) {
      gold.textContent = text;
      xp.textContent = text;
      const rect = column.getBoundingClientRect();
      results[stateName] = { width: rect.width, dividerX: rect.right };
    }
    return results;
  }, forms);
}

function assertHeadlineHoldsOneShape(measurements) {
  const detail = JSON.stringify(measurements, null, 2);
  const widths = new Set(Object.values(measurements).map((m) => Math.round(m.width)));
  expect(widths.size, `headline column width must not change across figure forms:\n${detail}`).toBe(1);
  const dividerXs = new Set(Object.values(measurements).map((m) => Math.round(m.dividerX)));
  expect(dividerXs.size, `divider x-position must not change across figure forms:\n${detail}`).toBe(1);
}

/**
 * The "last N min" context-line label (`coverageMinutesLabel`, `earnings-panel.tsx`) only ever
 * reads "last 1 min" through "last 10 min" — its shortest and longest real forms. Reaching "last
 * 10 min" legitimately needs ten real minutes of streamed session time (the fold's window is
 * computed off wall-clock time in the main process, nothing here can accelerate it), far past what
 * a smoke suite can spend on one assertion. The property under test is a CSS one regardless — the
 * label sits right-aligned inside the headline column's own fixed-width box
 * (`live-earnings-headline-column`, `earnings-panel.tsx`), not sized by its own content, so this
 * drives the cell straight to its extreme via the DOM and measures every sibling's box around it.
 * The label's own element is allowed to narrow or widen with its text (it is plain right-aligned
 * text, not a per-line reservation) — what must hold is its right edge and every other element's
 * full box, both unchanged. Both the mutation and the measurement happen inside one
 * `page.evaluate` call, with no `await` in between, so nothing here races the live stream's own
 * periodic re-render of that same cell.
 */
test.describe('live earnings panel: no layout shift smoke', () => {
  test('every sibling cell holds its box (and the shrinking label its right edge) as the "last N min" label grows from its shortest to its longest form', async () => {
    const { app, page, userDataDir } = await launchEarningsPanelApp('bfc-earnings-layout-');

    try {
      const shortText = recentWindowLabel(1);
      const longText = recentWindowLabel(10);

      const { shortBoxes, longBoxes } = await page.evaluate(
        ({ shortText, longText }) => {
          function measureAll() {
            const boxes = {};
            for (const el of document.querySelectorAll('[data-testid^="live-earnings"]')) {
              const testId = el.getAttribute('data-testid');
              const rect = el.getBoundingClientRect();
              // `right` rather than `x`/`width` separately: the label itself right-aligns inside
              // a fixed-width column, so its own box may legitimately narrow or widen with its
              // text — what must hold, for it and for every other cell alike, is its right edge,
              // its vertical position, and its height.
              boxes[testId] = { right: rect.x + rect.width, y: rect.y, height: rect.height };
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
      // At minimum: the panel, the headline column, the headline band's two rate figures, the
      // recent-window label, the reset control, and the six tiles (`earnings-panel.tsx`'s own
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
    const { app, page, userDataDir } = await launchEarningsPanelApp('bfc-earnings-blocks-');

    try {
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

  /**
   * The bug this whole file exists to catch, isolated: the headline column (`earnings-panel.tsx`'s
   * `live-earnings-headline-column`) used to size itself to whichever child was currently widest,
   * so the compact gold/xp figures growing or shrinking between character counts — "1k" versus
   * "999.9m" versus the em-dash no-data state — resized the column and slid its right-hand border
   * (the divider the owner actually saw move) sideways along with the whole six-block grid beside
   * it. Driven the same way the "last N min" test above drives its own cell: straight through the
   * DOM via `page.evaluate`, since reaching these forms from real streamed data would need either
   * a specific fixture balance or ten real minutes, neither practical for a smoke suite. The
   * property under test is a CSS one (a fixed-width box does not care what text is inside it), so
   * driving it this way exercises the real thing.
   */
  test('the headline column holds one width, and its divider one x-position, across the gold/xp figures\' shortest, longest, and no-data forms', async () => {
    const { app, page, userDataDir } = await launchEarningsPanelApp('bfc-earnings-headline-');

    try {
      const measurements = await measureHeadlineForms(page);
      assertHeadlineHoldsOneShape(measurements);

      await app.close();
    } finally {
      await app.close().catch(() => undefined);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  /**
   * The window has a real minimum width (`minWidth` on the `BrowserWindow`), and the page-level
   * layout promotes the panel to a half-width column above a breakpoint — both are places a fixed,
   * non-shrinking layout can end up narrower than its own reserved content. Sweeping real window
   * widths from that minimum up through a wide one and re-running the shape assertions above at
   * each one is the direct check: not that the arithmetic behind the breakpoint is right, but that
   * nothing the panel renders ever ends up wider than the panel itself, at any width the window
   * can actually be.
   */
  test('at every width from the window minimum up, nothing in the panel spills past its own border, the six blocks and headline keep their shape, and the reset control clears every other cell', async () => {
    const { app, page, userDataDir } = await launchEarningsPanelApp('bfc-earnings-responsive-');

    try {
      const widths = [960, 1024, 1100, 1200, 1349, 1350, 1400, 1600, 1920];

      for (const width of widths) {
        await resizeWindow(app, page, width, 720);

        const { panelLeft, panelRight, offenders } = await measureOverflow(page);
        expect(
          offenders,
          `width=${width}: elements spilling past the panel (left=${panelLeft}, right=${panelRight}):\n${JSON.stringify(offenders, null, 2)}`,
        ).toEqual([]);

        assertBlocksHoldTheirShape(await measureBlocks(page));
        assertHeadlineHoldsOneShape(await measureHeadlineForms(page));

        const { buttonRect, otherRects } = await measureResetAndContentBoxes(page);
        const overlapping = otherRects.filter((rect) => rectsOverlap(buttonRect, rect));
        expect(
          overlapping,
          `width=${width}: reset control overlaps content:\n${JSON.stringify({ buttonRect, overlapping }, null, 2)}`,
        ).toEqual([]);
      }

      await app.close();
    } finally {
      await app.close().catch(() => undefined);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
