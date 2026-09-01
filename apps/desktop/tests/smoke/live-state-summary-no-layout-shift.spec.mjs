import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');

/**
 * The state summary's four counts must hold their row still as their own digits change.
 *
 * These badges are content-sized in a wrapping flex row, so the width of any one count is the
 * whole row's geometry: a roster crossing nine heroes in one state widens that badge and shoves
 * every badge after it sideways, mid-tick. Both halves of the fix are asserted here and each
 * fails on its own — the face renders all ten digits at one width, and each count sits in a slot
 * wide enough for two of them.
 *
 * Driven by writing the counts rather than by waiting for the replayed capture to produce them:
 * that capture never leaves single digits, so a test that only watched it would assert the 9 → 10
 * crossing never happens and pass without ever measuring it. Writing `textContent` is the same
 * technique `live-earnings-no-layout-shift.spec.mjs` drives its headline forms with.
 */
const COUNT_TEST_IDS = [
  'live-state-summary-on-field-count',
  'live-state-summary-recovering-count',
  'live-state-summary-queued-count',
  'live-state-summary-benched-count',
];

const BADGE_TEST_IDS = [
  'live-state-summary-on-field',
  'live-state-summary-recovering',
  'live-state-summary-queued',
  'live-state-summary-benched',
];

function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

async function launchLiveApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-state-summary-shift-'));
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
  await expect(consentModal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(consentModal).toBeHidden({ timeout: 15_000 });

  await page.waitForSelector('[data-testid="live-state-summary"]', { timeout: 60_000 });
  return { app, page };
}

/**
 * Proves the four counts are really on screen and really rendering digits before anything is
 * measured off them. Without this the suite's own trap is open: a fixture that stopped mounting
 * the summary, or that rendered a dash in place of every count, would leave the geometry
 * assertions comparing one absent element against another and passing for the wrong reason.
 */
function readCounts(page) {
  return page.evaluate((testIds) => {
    return testIds.map((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`);
      return {
        id,
        present: el !== null,
        text: el === null ? null : el.textContent.trim(),
        width: el === null ? null : el.getBoundingClientRect().width,
      };
    });
  }, COUNT_TEST_IDS);
}

/**
 * Widths of all ten digits in whatever font the count actually resolved to, measured through a
 * probe carrying that element's own computed font. Two digits that differ in width are half the
 * defect on their own: no reserved slot stops the number re-flowing inside it.
 */
function digitWidthsOf(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`element not found: ${sel}`);
    const style = getComputedStyle(el);
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    probe.style.font = style.font;
    probe.style.fontFamily = style.fontFamily;
    probe.style.fontSize = style.fontSize;
    probe.style.fontWeight = style.fontWeight;
    document.body.appendChild(probe);
    const widths = '0123456789'.split('').map((d) => {
      probe.textContent = d;
      return Math.round(probe.getBoundingClientRect().width * 100) / 100;
    });
    probe.remove();
    return { fontFamily: style.fontFamily, fontSize: style.fontSize, widths };
  }, selector);
}

/** Every badge's box, measured with all four counts written to `text`. */
function measureRowAt(page, text) {
  return page.evaluate(
    ({ countIds, badgeIds, value }) => {
      for (const id of countIds) {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (!el) throw new Error(`count not found: ${id}`);
        el.textContent = value;
      }
      const boxes = {};
      for (const id of badgeIds) {
        const el = document.querySelector(`[data-testid="${id}"]`);
        if (!el) throw new Error(`badge not found: ${id}`);
        const r = el.getBoundingClientRect();
        boxes[id] = {
          left: Math.round(r.left * 100) / 100,
          right: Math.round(r.right * 100) / 100,
          width: Math.round(r.width * 100) / 100,
        };
      }
      return boxes;
    },
    { countIds: COUNT_TEST_IDS, badgeIds: BADGE_TEST_IDS, value: text },
  );
}

test.describe('live state summary: the counts hold their row still', () => {
  test('all four counts are mounted and rendering digits', async () => {
    const { app, page } = await launchLiveApp();
    try {
      const counts = await readCounts(page);
      const detail = JSON.stringify(counts, null, 2);

      for (const count of counts) {
        expect(count.present, `count "${count.id}" is not mounted:\n${detail}`).toBe(true);
        expect(count.width, `count "${count.id}" has no box:\n${detail}`).toBeGreaterThan(0);
        expect(count.text, `count "${count.id}" did not render digits:\n${detail}`).toMatch(/^\d+$/);
      }
    } finally {
      await app.close();
    }
  });

  test('the counts render in a face whose digits are all one width', async () => {
    const { app, page } = await launchLiveApp();
    try {
      const measured = await digitWidthsOf(page, `[data-testid="${COUNT_TEST_IDS[0]}"]`);
      expect(
        new Set(measured.widths).size,
        `counts render digits at differing widths in ${measured.fontFamily}: ${JSON.stringify(measured.widths)}`,
      ).toBe(1);
    } finally {
      await app.close();
    }
  });

  test('no badge moves or resizes as its count crosses from one digit to two', async () => {
    const { app, page } = await launchLiveApp();
    try {
      const atOne = await measureRowAt(page, '9');
      const atTwo = await measureRowAt(page, '10');
      const detail = JSON.stringify({ atOne, atTwo }, null, 2);

      // The row is only proof if it was actually measured — an empty box map would compare
      // equal to another empty box map and pass.
      expect(Object.keys(atOne).length, `no badges were measured:\n${detail}`).toBe(BADGE_TEST_IDS.length);
      for (const id of BADGE_TEST_IDS) {
        expect(atOne[id].width, `badge "${id}" has no box:\n${detail}`).toBeGreaterThan(0);
      }

      expect(atTwo, `a badge moved or resized as its count gained a digit:\n${detail}`).toEqual(atOne);
    } finally {
      await app.close();
    }
  });

  test('every digit-pair holds the same row, so no particular pair of digits is what makes it fit', async () => {
    const { app, page } = await launchLiveApp();
    try {
      const shapes = {};
      for (const value of ['0', '8', '11', '88', '10', '99']) {
        shapes[value] = await measureRowAt(page, value);
      }
      const detail = JSON.stringify(shapes, null, 2);
      const distinct = new Set(Object.values(shapes).map((boxes) => JSON.stringify(boxes)));
      expect(distinct.size, `the badge row changed shape across digit values:\n${detail}`).toBe(1);
    } finally {
      await app.close();
    }
  });
});
