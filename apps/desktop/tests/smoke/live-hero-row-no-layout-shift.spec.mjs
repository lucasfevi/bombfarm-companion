import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');

/**
 * The hero list's two numeric columns must hold still while their own digits change.
 *
 * This is measured rather than reviewed because the failure is invisible in markup and invisible
 * in a screenshot of a single frame: the app once set its figures in a face with no tabular
 * figures at all, where `1` rendered at barely half the width of `8` and the `tabular-nums` this
 * row and the countdown beside it both carried had no feature to switch on. Every reading
 * re-flowed as it counted, dragging the energy caret with it. A class assertion cannot catch
 * that — a passing one is exactly what the app had — and only the rendered geometry can, which is
 * why this lives in the smoke suite next to the earnings panel's own layout-shift spec rather
 * than in a unit test.
 *
 * The two properties asserted are the two halves of the fix, and each fails on its own: the
 * figure renders in a face whose digits are all one width, and it sits in a slot wide enough for
 * its longest value, so a row at 9% and a row at 100% put their caret in the same place.
 */
function electronExecutable() {
  return path.join(
    desktopRoot,
    'node_modules',
    'electron',
    'dist',
    process.platform === 'win32' ? 'electron.exe' : 'electron',
  );
}

async function launchHeroListApp() {
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-hero-row-shift-'));
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

  await page.waitForSelector('[data-testid="live-hero-list"]', { timeout: 60_000 });
  return { app, page };
}

/**
 * Widths of all ten digits in whatever font the given element actually resolved to, measured by
 * rendering each through a probe span carrying that element's own computed font. Two digits that
 * differ in width are the whole defect: no amount of reserved column stops the number itself from
 * re-flowing under them.
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
    const widthOf = (text) => {
      probe.textContent = text;
      return probe.getBoundingClientRect().width;
    };
    const widths = '0123456789'.split('').map((d) => Math.round(widthOf(d) * 100) / 100);
    probe.remove();
    return { fontFamily: style.fontFamily, fontSize: style.fontSize, widths };
  }, selector);
}

/** Every hero row's caret and reading geometry, for the rows that have a reading at all. */
function measureReadings(page) {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('[data-testid="live-hero-list"] > li')];
    return rows
      .map((row) => {
        const reading = row.querySelector('[data-testid$="-value"]');
        if (!reading) return null;
        const caret = [...row.querySelectorAll('span[aria-hidden="true"]')].find(
          (span) => span.textContent === '▾' || span.textContent === '▴',
        );
        const readingRect = reading.getBoundingClientRect();
        return {
          text: reading.textContent,
          readingLeft: Math.round(readingRect.left * 100) / 100,
          readingRight: Math.round(readingRect.right * 100) / 100,
          readingWidth: Math.round(readingRect.width * 100) / 100,
          readingFontSize: Number.parseFloat(getComputedStyle(reading).fontSize),
          caretLeft: caret ? Math.round(caret.getBoundingClientRect().left * 100) / 100 : null,
          caretFontSize: caret ? Number.parseFloat(getComputedStyle(caret).fontSize) : null,
        };
      })
      .filter((entry) => entry !== null && entry.text !== null && entry.text.includes('%'));
  });
}

test.describe('live hero row: the numbers hold still', () => {
  test('every energy reading is the same width, so the caret in front of it never moves', async () => {
    const { app, page } = await launchHeroListApp();
    try {
      const readings = await measureReadings(page);
      const detail = JSON.stringify(readings, null, 2);

      expect(readings.length, `no hero rows carried a reading:\n${detail}`).toBeGreaterThan(2);
      expect(
        new Set(readings.map((r) => r.text)).size,
        `every row read the same value, so this proves nothing:\n${detail}`,
      ).toBeGreaterThan(1);

      expect(new Set(readings.map((r) => r.readingWidth)).size, `readings differ in width:\n${detail}`).toBe(1);
      expect(new Set(readings.map((r) => r.readingRight)).size, `readings differ in right edge:\n${detail}`).toBe(1);

      const carets = readings.filter((r) => r.caretLeft !== null);
      expect(carets.length, `no direction caret rendered:\n${detail}`).toBeGreaterThan(1);
      expect(new Set(carets.map((r) => r.caretLeft)).size, `the caret moved between rows:\n${detail}`).toBe(1);
    } finally {
      await app.close();
    }
  });

  test('the caret reads larger than the figure it marks', async () => {
    const { app, page } = await launchHeroListApp();
    try {
      const readings = (await measureReadings(page)).filter((r) => r.caretFontSize !== null);
      const detail = JSON.stringify(readings, null, 2);

      expect(readings.length, `no direction caret rendered:\n${detail}`).toBeGreaterThan(0);
      for (const reading of readings) {
        expect(reading.caretFontSize, `caret is not larger than its reading:\n${detail}`).toBeGreaterThan(
          reading.readingFontSize,
        );
      }
    } finally {
      await app.close();
    }
  });

  /**
   * The countdown beside these readings is NOT measured here, and deliberately not asserted
   * either: this fixture's replayed capture carries no countdown models, so every countdown cell
   * renders the absent-value copy instead of a clock. Measuring that cell measures prose — the
   * first version of this test did, and read nine different digit widths off the sans fallback.
   * The countdown's own face is covered where it can actually be exercised, in
   * `countdown-value.test.tsx`.
   */
  test('the energy reading renders in a face whose digits are all one width', async () => {
    const { app, page } = await launchHeroListApp();
    try {
      const measured = await digitWidthsOf(page, '[data-testid="live-hero-list"] [data-testid$="-value"]');
      expect(
        new Set(measured.widths).size,
        `readings render digits at differing widths in ${measured.fontFamily}: ${JSON.stringify(measured.widths)}`,
      ).toBe(1);
    } finally {
      await app.close();
    }
  });
});
