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

/** The committed capture is 60 records at one record per 100 ms: a pass is six seconds, so the
 *  window below spans several wraps of it. */
const REPLAY_PASS_SECONDS = 6;
const OBSERVE_PASSES = 4;
const SAMPLE_INTERVAL_MS = 40;

function readCopyValue(filePath, key) {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) throw new Error(`could not find copy key "${key}" in ${filePath}`);
  return match[1];
}

const en = (key) => readCopyValue(EN_COPY_PATH, key);
const pt = (key) => readCopyValue(PT_BR_COPY_PATH, key);

/** The panels whose boxes must not move, and the Damage panel's own parts. */
const BOX_TEST_IDS = [
  'live-earnings',
  'live-map',
  'live-heroes',
  'live-damage',
  'live-damage-team',
  'live-damage-scroller',
  'live-damage-unattributed',
];

/** The heroes panel is as tall as its list, and the list fills in as the roster arrives, so only
 *  where it starts and how wide it is can be held to account for the Damage panel above it. */
const HEIGHT_FREE_TEST_IDS = new Set(['live-heroes']);

/** `lg`: below this window width the Damage and Heroes panels each take the full width. Measured:
 *  side by side, the heroes row's energy bar is wider than its own reading only from a 1017px
 *  window, and is nothing at all at the 960px minimum. */
const SIDE_BY_SIDE_FROM = 1024;
const WIDE_WINDOW = 1280;
const NARROW_WINDOW = 1000;
const MIN_WINDOW_WIDTH = 960;
/** The energy bar is the heroes row's flexible part; it must be at least as wide as the reading
 *  column (3rem) beside it, or it is not a bar. */
const MIN_ENERGY_BAR_PX = 48;

function navButton(page, index) {
  return page.locator('nav[aria-label="Main"] button').nth(index);
}

/** Sets the content width of the real window, lifting the minimum first so a width below it can
 *  also be asked for, and reports the width the page actually got. */
async function setContentWidth(app, page, width) {
  await app.evaluate(
    ({ BrowserWindow }, size) => {
      const win = BrowserWindow.getAllWindows()[0];
      win?.setMinimumSize(200, 200);
      win?.setContentSize(size.width, size.height);
    },
    { width, height: 1000 },
  );
  await expect.poll(() => page.evaluate(() => window.innerWidth), { timeout: 10_000 }).toBe(width);
}

const LIVE_PANEL_IDS = ['live-earnings', 'live-map', 'live-damage', 'live-heroes'];

async function panelRects(page) {
  return page.evaluate((ids) => {
    return Object.fromEntries(
      ids.map((id) => {
        const box = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect();
        return [id, { left: box.left, top: box.top, right: box.right, bottom: box.bottom, height: box.height }];
      }),
    );
  }, LIVE_PANEL_IDS);
}

/**
 * Launches against the replayed fixture account with the consent dialog still up, so the caller
 * can start measuring before the first frame is allowed in. `capture` points the replay at another
 * file; a path that does not exist leaves the stream attached to nothing, which is the state
 * before any damage has ever arrived.
 */
async function launchWithConsentPending(tmpPrefix, capture) {
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
      BFC_LIVE_SOURCE: 'replay',
      ...(capture === undefined ? {} : { BFC_REPLAY_CAPTURE: capture }),
      BFC_USER_DATA_DIR: userDataDir,
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      ELECTRON_ENABLE_LOGGING: '1',
    },
  });

  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  const consentModal = page.getByTestId('consent-modal');
  await expect(consentModal).toBeVisible({ timeout: 30_000 });

  const acceptConsent = async () => {
    await page.getByTestId('consent-accept').click();
    await expect(consentModal).toBeHidden({ timeout: 15_000 });
    await expect(page.getByTestId('live-damage')).toBeVisible({ timeout: 30_000 });
  };

  return { app, page, userDataDir, acceptConsent };
}

async function closeApp(app, userDataDir) {
  await app.close().catch(() => undefined);
  fs.rmSync(userDataDir, { recursive: true, force: true });
}

/** Samples the boxes and the panel's own state in the page itself, on a timer, because a hidden
 *  window runs no animation frames and a measurement taken from here would only see the moments
 *  Playwright happened to ask. */
function startRecording(page) {
  return page.evaluate(
    ({ boxIds, intervalMs }) => {
      const box = (id) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (el === null) return null;
        const rect = el.getBoundingClientRect();
        return [rect.left, rect.top, rect.width, rect.height].map((value) => Math.round(value * 100) / 100);
      };
      window.__damageSamples = [];
      window.__damageRecorder = setInterval(() => {
        const rowElements = [...document.querySelectorAll('tr[data-testid^="live-damage-row-"]')];
        const rows = rowElements.length;
        const propsSum = rowElements.reduce(
          (sum, row) => sum + (Number.parseFloat(row.querySelectorAll('td')[3]?.textContent ?? '') || 0),
          0,
        );
        const session = document.querySelector('[data-testid="live-damage-team-dps-session"]');
        const unattributed = document.querySelector('[data-testid="live-damage-unattributed"]');
        window.__damageSamples.push({
          boxes: Object.fromEntries(boxIds.map((id) => [id, box(id)])),
          rows,
          propsSum,
          session: session === null ? null : session.textContent,
          unattributed: unattributed === null ? null : unattributed.textContent,
        });
      }, intervalMs);
    },
    { boxIds: BOX_TEST_IDS, intervalMs: SAMPLE_INTERVAL_MS },
  );
}

async function stopRecording(page) {
  return page.evaluate(() => {
    clearInterval(window.__damageRecorder);
    return window.__damageSamples;
  });
}

/** Sizes, plus where each box sits relative to the earnings panel — the one thing a banner above
 *  the screen (a gap line, say) cannot change, so launches in different stream states compare. */
function shapeOf(boxes) {
  const origin = boxes['live-earnings'];
  return Object.fromEntries(
    Object.entries(boxes).map(([id, box]) => [
      id,
      box === null || origin === null
        ? null
        : {
            width: box[2],
            ...(HEIGHT_FREE_TEST_IDS.has(id) ? {} : { height: box[3] }),
            left: box[0] - origin[0],
            top: box[1] - origin[1],
          },
    ]),
  );
}

async function measureShape(page) {
  const boxes = await page.evaluate((ids) => {
    return Object.fromEntries(
      ids.map((id) => {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (el === null) return [id, null];
        const rect = el.getBoundingClientRect();
        return [id, [rect.left, rect.top, rect.width, rect.height].map((value) => Math.round(value * 100) / 100)];
      }),
    );
  }, BOX_TEST_IDS);
  return shapeOf(boxes);
}

test.describe('live damage panel: no layout shift smoke', () => {
  for (const windowWidth of [WIDE_WINDOW, NARROW_WINDOW]) {
    test(`renders under replay with its title, and nothing outside it moves across first paint, first damage, rows appearing and replay wraps, in a ${String(windowWidth)}px window`, async () => {
      test.setTimeout(180_000);
      const { app, page, userDataDir, acceptConsent } = await launchWithConsentPending('bfc-damage-layout-');

      try {
        await setContentWidth(app, page, windowWidth);
        await startRecording(page);
        await acceptConsent();
        await expect(page.getByTestId('live-damage').locator('h2')).toHaveText(en('liveDamageTitle'));

        await page.waitForTimeout(REPLAY_PASS_SECONDS * OBSERVE_PASSES * 1000);
        const samples = await stopRecording(page);

        const withPanel = samples.filter((sample) => sample.boxes['live-damage'] !== null);
        expect(withPanel.length, 'the recorder saw the panel for most of the window').toBeGreaterThan(
          (REPLAY_PASS_SECONDS * OBSERVE_PASSES * 1000) / SAMPLE_INTERVAL_MS / 2,
        );

        const sawDamage = withPanel.filter((sample) => sample.session !== null && sample.session !== '—');
        expect(sawDamage.length, 'Team DPS printed a figure once frames arrived').toBeGreaterThan(0);

        const moved = [];
        for (const id of BOX_TEST_IDS) {
          const distinct = new Set(
            withPanel.map((sample) => JSON.stringify(HEIGHT_FREE_TEST_IDS.has(id) ? sample.boxes[id]?.slice(0, 3) : sample.boxes[id])),
          );
          if (distinct.size > 1) moved.push({ id, boxes: [...distinct] });
        }
        expect(moved, `boxes that changed between samples:\n${JSON.stringify(moved, null, 2)}`).toEqual([]);

        expect(Math.max(...withPanel.map((sample) => sample.rows)), 'hero rows appeared in the table').toBeGreaterThan(0);
      } finally {
        await closeApp(app, userDataDir);
      }
    });
  }

  test('the panel and its siblings have the same shape before any damage has arrived as while it is flowing', async () => {
    test.setTimeout(180_000);
    const idle = await launchWithConsentPending('bfc-damage-idle-', path.join(os.tmpdir(), 'bfc-no-such-capture.bfcc'));
    let idleShape;
    try {
      await idle.acceptConsent();
      await expect(idle.page.getByTestId('live-damage-team-dps-session')).toHaveText('—');
      idleShape = await measureShape(idle.page);
    } finally {
      await closeApp(idle.app, idle.userDataDir);
    }

    const flowing = await launchWithConsentPending('bfc-damage-flowing-');
    try {
      await flowing.acceptConsent();
      await expect(flowing.page.getByTestId('live-damage-team-dps-session')).not.toHaveText('—', { timeout: 30_000 });
      await flowing.page.waitForTimeout(REPLAY_PASS_SECONDS * 1000);
      const flowingShape = await measureShape(flowing.page);

      for (const id of BOX_TEST_IDS) {
        expect(idleShape[id], `${id} exists with no damage`).not.toBeNull();
        expect(flowingShape[id], `${id} changed shape once damage arrived`).toEqual(idleShape[id]);
      }
    } finally {
      await closeApp(flowing.app, flowing.userDataDir);
    }
  });

  test('the Unattributed row keeps the table columns once it has figures, and the table never scrolls sideways', async () => {
    test.setTimeout(180_000);
    const { app, page, userDataDir, acceptConsent } = await launchWithConsentPending('bfc-damage-columns-');

    try {
      await acceptConsent();
      await expect(page.getByTestId('live-damage-unattributed').locator('td').nth(0)).toHaveText(en('liveDamageUnattributedLabel'), {
        timeout: 30_000,
      });

      for (const width of [MIN_WINDOW_WIDTH, NARROW_WINDOW, SIDE_BY_SIDE_FROM, WIDE_WINDOW]) {
        await setContentWidth(app, page, width);
        const lefts = await page.evaluate(() => {
          const edges = (selector) => [...document.querySelectorAll(selector)].map((el) => Math.round(el.getBoundingClientRect().left * 10) / 10);
          const scroller = document.querySelector('[data-testid="live-damage-scroller"]');
          return {
            head: edges('[data-testid="live-damage-scroller"] thead th'),
            unattributed: edges('[data-testid="live-damage-unattributed"] td'),
            scrollWidth: scroller.scrollWidth,
            clientWidth: scroller.clientWidth,
          };
        });

        expect(lefts.head, `five column heads at ${String(width)}px`).toHaveLength(5);
        expect(lefts.unattributed, `Unattributed keeps the columns at ${String(width)}px`).toEqual(lefts.head);
        expect(lefts.scrollWidth, `the table scrolls sideways at ${String(width)}px`).toBeLessThanOrEqual(lefts.clientWidth);
      }
    } finally {
      await closeApp(app, userDataDir);
    }
  });

  test('side by side from the breakpoint, every Heroes row shows its content unclipped, in both languages', async () => {
    test.setTimeout(180_000);
    const { app, page, userDataDir, acceptConsent } = await launchWithConsentPending('bfc-damage-heroes-fit-');

    const measureRows = () =>
      page.evaluate(() => {
        const rows = [...document.querySelectorAll('[data-testid="live-hero-list"] > li')];
        return {
          rows: rows.length,
          overflowing: rows.filter((row) => row.scrollWidth > row.clientWidth + 1).length,
          escaping: rows.flatMap((row) => {
            const edge = row.getBoundingClientRect().right;
            return [...row.querySelectorAll('*')]
              .filter((el) => !el.closest('.sr-only') && el.getBoundingClientRect().right > edge + 0.5)
              .map((el) => el.textContent);
          }),
          truncated: rows.flatMap((row) =>
            [...row.querySelectorAll('*')]
              .filter((el) => !el.closest('.sr-only') && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
              .map((el) => el.textContent),
          ),
          barWidths: [...document.querySelectorAll('[data-testid^="live-energy-"]:not([data-testid$="-value"])')].map(
            (bar) => bar.getBoundingClientRect().width,
          ),
        };
      });

    try {
      await acceptConsent();
      await expect(page.locator('[data-testid="live-hero-list"] > li').first()).toBeVisible({ timeout: 30_000 });

      const fit = async (language) => {
        for (const width of [SIDE_BY_SIDE_FROM, WIDE_WINDOW]) {
          await setContentWidth(app, page, width);
          const measured = await measureRows();
          const where = `${language} at ${String(width)}px: ${JSON.stringify(measured)}`;

          expect(measured.rows, where).toBeGreaterThan(0);
          expect(measured.overflowing, `a row overflows, ${where}`).toBe(0);
          expect(measured.escaping, `content leaves its row, ${where}`).toEqual([]);
          expect(measured.truncated, `content is clipped, ${where}`).toEqual([]);
          for (const barWidth of measured.barWidths) {
            expect(barWidth, `an energy bar is narrower than its reading, ${where}`).toBeGreaterThanOrEqual(MIN_ENERGY_BAR_PX);
          }
        }
      };

      await setContentWidth(app, page, WIDE_WINDOW);
      await fit('English');

      await navButton(page, 10).click();
      const select = page.getByRole('combobox', { name: en('settingsLanguageLabel') });
      await select.waitFor({ state: 'visible', timeout: 10_000 });
      await select.click();
      await page.getByRole('option', { name: en('settingsLanguageOptionPortuguese') }).click();
      await navButton(page, 0).click();
      await expect(page.getByTestId('live-damage').locator('h2')).toHaveText(pt('liveDamageTitle'), { timeout: 15_000 });
      await fit('Portuguese');
    } finally {
      await closeApp(app, userDataDir);
    }
  });

  test('a full field fits its reservation: no scrollbar, no clipped row, rows 40px under a 32px header', async () => {
    test.setTimeout(180_000);
    const { app, page, userDataDir, acceptConsent } = await launchWithConsentPending('bfc-damage-fit-');

    try {
      await acceptConsent();
      const scroller = page.getByTestId('live-damage-scroller');
      const slots = await scroller.evaluate((el) => (Number.parseFloat(getComputedStyle(el).maxHeight) - 32) / 40);
      expect(Number.isInteger(slots), 'the reserved height is one header plus whole 40px rows').toBe(true);
      await expect(page.locator('tr[data-testid^="live-damage-row-"]')).toHaveCount(slots, { timeout: 30_000 });

      const fit = await scroller.evaluate((el) => {
        const scrollerRect = el.getBoundingClientRect();
        const head = el.querySelector('thead th').getBoundingClientRect();
        return {
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          headHeight: head.height,
          rows: [...el.querySelectorAll('tbody tr')].map((row) => {
            const rect = row.getBoundingClientRect();
            return { height: rect.height, top: rect.top - scrollerRect.top, bottom: scrollerRect.bottom - rect.bottom };
          }),
        };
      });

      expect(fit.scrollHeight, `a scrollbar appeared:\n${JSON.stringify(fit)}`).toBeLessThanOrEqual(fit.clientHeight);
      expect(fit.headHeight).toBeCloseTo(32, 0);
      expect(fit.rows).toHaveLength(slots);
      for (const row of fit.rows) {
        expect(row.height, `a row is not 40px tall:\n${JSON.stringify(fit)}`).toBeCloseTo(40, 0);
        expect(row.top).toBeGreaterThanOrEqual(0);
        expect(row.bottom, `a row is clipped at the bottom:\n${JSON.stringify(fit)}`).toBeGreaterThanOrEqual(-0.5);
      }
    } finally {
      await closeApp(app, userDataDir);
    }
  });

  test('side by side from the breakpoint: Damage under earnings, Heroes under map, edges matching, the same height', async () => {
    test.setTimeout(180_000);
    const { app, page, userDataDir, acceptConsent } = await launchWithConsentPending('bfc-damage-placement-wide-');

    try {
      await acceptConsent();
      for (const width of [WIDE_WINDOW, SIDE_BY_SIDE_FROM]) {
        await setContentWidth(app, page, width);
        const { 'live-earnings': earnings, 'live-map': map, 'live-damage': damage, 'live-heroes': heroes } = await panelRects(page);
        const where = `at ${String(width)}px`;

        expect(earnings.top, `earnings and map share a row ${where}`).toBeCloseTo(map.top, 0);
        expect(damage.left, `Damage's left edge is earnings' ${where}`).toBeCloseTo(earnings.left, 0);
        expect(damage.right, `Damage's right edge is earnings' ${where}`).toBeCloseTo(earnings.right, 0);
        expect(heroes.left, `Heroes' left edge is map's ${where}`).toBeCloseTo(map.left, 0);
        expect(heroes.right, `Heroes' right edge is map's ${where}`).toBeCloseTo(map.right, 0);
        expect(damage.top, `Damage starts the row under earnings and map ${where}`).toBeGreaterThanOrEqual(
          Math.max(earnings.bottom, map.bottom) - 0.5,
        );
        expect(heroes.top, `Heroes starts where Damage does ${where}`).toBeCloseTo(damage.top, 0);
        expect(heroes.height, `Heroes is as tall as Damage ${where}`).toBeCloseTo(damage.height, 0);
      }

      const parents = await page.evaluate(() => {
        const parentOf = (id) => document.querySelector(`[data-testid="${id}"]`)?.parentElement ?? null;
        return new Set(['live-earnings', 'live-map', 'live-damage', 'live-heroes'].map(parentOf)).size;
      });
      expect(parents, 'the four panels are cells of one grid').toBe(1);
    } finally {
      await closeApp(app, userDataDir);
    }
  });

  test('stacked below the breakpoint: Damage then Heroes, each across both columns, the earnings and map row unchanged', async () => {
    test.setTimeout(180_000);
    const { app, page, userDataDir, acceptConsent } = await launchWithConsentPending('bfc-damage-placement-narrow-');

    try {
      await acceptConsent();
      await setContentWidth(app, page, WIDE_WINDOW);
      const wideRow = await panelRects(page);

      for (const width of [NARROW_WINDOW, SIDE_BY_SIDE_FROM - 1]) {
        await setContentWidth(app, page, width);
        const { 'live-earnings': earnings, 'live-map': map, 'live-damage': damage, 'live-heroes': heroes } = await panelRects(page);
        const where = `at ${String(width)}px`;

        expect(earnings.top, `earnings and map still share a row ${where}`).toBeCloseTo(map.top, 0);
        expect(earnings.right - earnings.left, `earnings keeps its width ${where}`).toBeCloseTo(
          wideRow['live-earnings'].right - wideRow['live-earnings'].left,
          0,
        );
        expect(damage.left, `Damage starts at the earnings edge ${where}`).toBeCloseTo(earnings.left, 0);
        expect(damage.right, `Damage ends at the map's right edge ${where}`).toBeCloseTo(map.right, 0);
        expect(heroes.left, `Heroes starts at the earnings edge ${where}`).toBeCloseTo(earnings.left, 0);
        expect(heroes.right, `Heroes ends at the map's right edge ${where}`).toBeCloseTo(map.right, 0);
        expect(damage.top, `Damage is under earnings and map ${where}`).toBeGreaterThanOrEqual(
          Math.max(earnings.bottom, map.bottom) - 0.5,
        );
        expect(heroes.top, `Heroes is under Damage ${where}`).toBeGreaterThanOrEqual(damage.bottom - 0.5);
      }
    } finally {
      await closeApp(app, userDataDir);
    }
  });

  test('the earnings Reset restarts the damage session too: the per-hero props fall back from what they had reached', async () => {
    test.setTimeout(180_000);
    const { app, page, userDataDir, acceptConsent } = await launchWithConsentPending('bfc-damage-reset-');

    try {
      await startRecording(page);
      await acceptConsent();
      await expect
        .poll(async () => (await page.evaluate(() => window.__damageSamples.at(-1)?.propsSum ?? 0)), { timeout: 40_000 })
        .toBeGreaterThanOrEqual(8);

      const before = await page.evaluate(() => {
        window.__resetAt = window.__damageSamples.length;
        return window.__damageSamples.at(-1).propsSum;
      });
      await page.getByTestId('live-earnings-reset').click();
      await page.waitForTimeout(1_500);
      const samples = await stopRecording(page);

      const after = samples.slice(await page.evaluate(() => window.__resetAt));
      const lowest = Math.min(...after.map((sample) => sample.propsSum));
      expect(lowest, `props never fell below ${String(before)} after the Reset`).toBeLessThan(before / 2);
    } finally {
      await closeApp(app, userDataDir);
    }
  });

  test('titles the panel in Portuguese once the language is switched', async () => {
    test.setTimeout(180_000);
    const { app, page, userDataDir, acceptConsent } = await launchWithConsentPending('bfc-damage-pt-');

    try {
      await acceptConsent();
      await navButton(page, 10).click();
      const select = page.getByRole('combobox', { name: en('settingsLanguageLabel') });
      await select.waitFor({ state: 'visible', timeout: 10_000 });
      await select.click();
      await page.getByRole('option', { name: en('settingsLanguageOptionPortuguese') }).click();
      await navButton(page, 0).click();

      await expect(page.getByTestId('live-damage').locator('h2')).toHaveText(pt('liveDamageTitle'), { timeout: 15_000 });
    } finally {
      await closeApp(app, userDataDir);
    }
  });
});
