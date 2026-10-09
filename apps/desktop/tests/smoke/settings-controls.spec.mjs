import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

/**
 * The Settings screen's controls, driven rather than merely drawn.
 *
 * Until now a smoke spec reached Settings only to read the market-currency selector, so every
 * other control on the screen was covered by component tests that render the section and by
 * wiring tests that stub the bridge — neither of which can show that a press reaches the stored
 * row and comes back. Each test here changes a control, leaves the tab, returns, and then
 * relaunches on the same user-data directory so the value is read back from what main persisted
 * and not from anything the renderer remembered.
 *
 * The five switches are located by role and accessible name rather than by `data-testid`, because
 * the accessible name is the thing a player's screen reader reads and a switch that lost it is
 * broken whether or not a test hook survives. Two of the five have no testid at all.
 *
 * Each switch's not-persisted warning is an always-mounted banner hidden by `aria-hidden` rather
 * than unmounted, so a successful write is asserted as `aria-hidden="true"` — `toBeHidden()` would
 * be a claim about `visibility`, which is a different thing from the slot being empty.
 *
 * Launcher shape, the `mkdtempSync` + `BFC_USER_DATA_DIR` relaunch pattern, and reading asserted
 * copy out of `en.ts` rather than hardcoding it are all `market-currency.spec.mjs`'s.
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

const EN_COPY_PATH = path.join(desktopRoot, 'renderer', 'lib', 'copy', 'en.ts');

function en(key) {
  const source = fs.readFileSync(EN_COPY_PATH, 'utf8');
  const match = source.match(new RegExp(`\\b${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!match) throw new Error(`settings-controls.spec.mjs: could not find copy key "${key}" in ${EN_COPY_PATH}`);
  return match[1];
}

async function launchApp(env) {
  const app = await electron.launch({
    executablePath: electronExecutable(),
    args: [desktopRoot],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      ELECTRON_ENABLE_LOGGING: '1',
      BFC_GAME_PROCESS: 'bfc-smoke-no-such-process.exe',
      // SAFETY: keeps the token reader away from any real session.cfg on this machine — see
      // i18n.spec.mjs for the full reasoning.
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      BFC_GAME_READER: 'fixture',
      BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_FIXTURE,
      ...env,
    },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  return { app, page };
}

async function acceptConsent(page) {
  const modal = page.getByTestId('consent-modal');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(modal).toBeHidden({ timeout: 15_000 });
}

/** A nav tab by its accessible name, scoped to the landmark — `getByRole` over the whole page
 *  matches every aria-label containing the word, and a positional index moves when a tab is
 *  inserted. The word becomes an `aria-label` once the bar is narrow enough to draw a glyph, and
 *  the accessible name is the same either way. */
function navTab(page, labelKey) {
  return page.locator('nav[aria-label="Main"]').getByRole('button', { name: en(labelKey), exact: true });
}

async function openSettings(page) {
  await navTab(page, 'settingsNavLabel').click();
  await expect(page.getByTestId('settings-view')).toBeVisible({ timeout: 20_000 });
}

async function leaveSettings(page) {
  await navTab(page, 'liveNavLabel').click();
  await expect(page.getByTestId('settings-view')).toHaveCount(0, { timeout: 20_000 });
}

/**
 * Every switch on the screen, with the value it ships at.
 *
 * `from` is the shipped default, so `to` is the flip each test drives. Usage ping is the one that
 * starts on, and turning it OFF is also the direction that cannot reach the network.
 */
const SWITCHES = [
  { field: 'alwaysOnTopMain', labelKey: 'settingsAlwaysOnTopMainLabel', warning: 'settings-always-on-top-warning', from: false },
  { field: 'alwaysOnTopMini', labelKey: 'settingsAlwaysOnTopMiniLabel', warning: 'settings-always-on-top-mini-warning', from: false },
  { field: 'restartGameOnExit', labelKey: 'settingsRestartGameOnExitLabel', warning: 'settings-restart-game-on-exit-warning', from: false },
  { field: 'forgeWritesEnabled', labelKey: 'settingsForgeWritesLabel', warning: 'settings-forge-writes-warning', from: false },
  { field: 'usagePingEnabled', labelKey: 'settingsUsagePingLabel', warning: 'settings-usage-ping-warning', from: true },
];

function switchFor(page, control) {
  return page.getByRole('switch', { name: en(control.labelKey) });
}

/** Every switch's `aria-checked`, as a field -> 'true' | 'false' | null map, so a mismatch can be
 *  reported as the set of offenders rather than as the first failed expectation. */
async function readSwitches(page) {
  const state = {};
  for (const control of SWITCHES) {
    state[control.field] = await switchFor(page, control).getAttribute('aria-checked');
  }
  return state;
}

function flippedState() {
  return Object.fromEntries(SWITCHES.map((control) => [control.field, String(!control.from)]));
}

function mismatches(actual, expected) {
  return Object.keys(expected)
    .filter((field) => actual[field] !== expected[field])
    .map((field) => `${field}: ${String(actual[field])} (expected ${expected[field]})`);
}

/**
 * The ten sections, in the order a player reads them.
 *
 * Titles come out of `en.ts`, never written here: a section renamed in copy and not here would
 * fail this on a word rather than on an order, which is the wrong thing to report.
 */
const SECTION_TITLE_KEYS = [
  'settingsLanguageSectionTitle',
  'settingsWindowSectionTitle',
  'settingsGameSectionTitle',
  'settingsForgeSectionTitle',
  'settingsMarketSectionTitle',
  'settingsConsentSectionTitle',
  'settingsUsageSectionTitle',
  'settingsDiagnosticsSectionTitle',
  'settingsUpdatesSectionTitle',
  'settingsSupportSectionTitle',
];

/**
 * The section headings in document order.
 *
 * `SettingsSection` draws its title as the heading inside its own header `div`, which is the
 * section's first child — so the selector stops one level short of the bodies. That matters: every
 * switch's always-mounted warning is a `Banner`, and a `Banner` with a title draws a heading of the
 * same level. Reading every heading under the view would interleave four warning titles among the
 * ten section names and make the order assertion read as a different claim than it is.
 */
function sectionTitles(page) {
  return page.locator('[data-testid="settings-view"] > section > div:first-child > h2').allTextContents();
}

test.describe('settings controls smoke — driven, held across a tab switch, and read back from the stored row', () => {
  test('the sections are drawn top to bottom as language, the three about this machine, market, account access, usage, and the three at the end', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-settings-order-'));
    try {
      const { app, page } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        await acceptConsent(page);
        await openSettings(page);

        const expected = SECTION_TITLE_KEYS.map((key) => en(key));
        const found = (await sectionTitles(page)).map((title) => title.trim());
        expect(
          found,
          `the settings screen is a flat list with no index of its own, so this order is the only ` +
            `thing that says what a player reads first. Found, top to bottom: ` +
            `[${found.join(' | ')}]. Expected: [${expected.join(' | ')}]`,
        ).toEqual(expected);
      } finally {
        await app.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  test('every switch flips, keeps its new position across a tab switch, and a relaunch reads the same value out of the settings row', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-settings-controls-'));
    try {
      const { app: app1, page: page1 } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        await acceptConsent(page1);
        await openSettings(page1);

        const shipped = Object.fromEntries(SWITCHES.map((control) => [control.field, String(control.from)]));
        const atStart = await readSwitches(page1);
        expect(
          mismatches(atStart, shipped),
          'a switch on a fresh profile did not draw the value the contracts package ships as the ' +
            'default. These offenders disagree, as "field: actual (expected)"',
        ).toEqual([]);

        for (const control of SWITCHES) {
          const toggle = switchFor(page1, control);
          await expect(toggle).toBeVisible({ timeout: 10_000 });
          await toggle.click();
          await expect(toggle).toHaveAttribute('aria-checked', String(!control.from), { timeout: 10_000 });
        }

        const unwritten = [];
        for (const control of SWITCHES) {
          const warning = await page1.getByTestId(control.warning).getAttribute('aria-hidden');
          if (warning !== 'true') unwritten.push(`${control.field}: ${control.warning} aria-hidden=${String(warning)}`);
        }
        expect(
          unwritten,
          'a write that persisted leaves its warning slot empty and hidden. These offenders are ' +
            'reporting that the new value did not reach disk, which means the next launch will not ' +
            'have it',
        ).toEqual([]);

        await leaveSettings(page1);
        await openSettings(page1);
        expect(
          mismatches(await readSwitches(page1), flippedState()),
          'a switch lost its position when Settings was unmounted and mounted again, so the screen ' +
            'is drawing component state rather than the value main holds',
        ).toEqual([]);
      } finally {
        await app1.close().catch(() => undefined);
      }

      // Launch 2 on the SAME user-data dir: the only thing that can put the flipped values on the
      // screen now is the settings row the first launch wrote.
      const { app: app2, page: page2 } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        await expect(page2.getByTestId('consent-modal')).toHaveCount(0);
        await openSettings(page2);

        expect(
          mismatches(await readSwitches(page2), flippedState()),
          'a relaunch on the same profile did not draw the value the previous launch wrote. These ' +
            'offenders came back at the shipped default, which is the stored row failing to survive ' +
            'a restart',
        ).toEqual([]);

        const stored = await page2.evaluate(async () => window.bfc.invoke('settings:get'));
        const fromStore = Object.fromEntries(SWITCHES.map((control) => [control.field, String(stored[control.field])]));
        expect(
          mismatches(fromStore, flippedState()),
          'the settings row main reads back disagrees with what the screen was asked to store. ' +
            'These fields are the offenders',
        ).toEqual([]);
      } finally {
        await app2.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  test('the diagnostics button writes a file inside the profile it was launched with, and an immediate second press is refused by the rate limit', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-settings-diagnostics-'));
    try {
      const { app, page } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        await acceptConsent(page);
        await openSettings(page);

        const result = page.getByTestId('settings-diagnostics-save-result');
        await expect(result).toHaveAttribute('aria-hidden', 'true');

        await page.getByTestId('settings-diagnostics-save').click();
        await expect(result).toHaveAttribute('aria-hidden', 'false', { timeout: 15_000 });
        await expect(result).toContainText(en('settingsDiagnosticsSavedTitle'));

        const body = en('settingsDiagnosticsSavedBody');
        const [before, after] = body.split('{path}');
        const reported = await result.textContent();
        const atPath = reported.indexOf(before);
        expect(
          atPath,
          `the saved banner did not read as "${body}" — it said ${JSON.stringify(reported)}, so the ` +
            `path it claims to have written cannot be read out of it`,
        ).toBeGreaterThanOrEqual(0);
        const tail = reported.slice(atPath + before.length);
        const writtenPath = after === '' ? tail : tail.slice(0, tail.lastIndexOf(after));

        expect(
          fs.existsSync(writtenPath),
          `the banner named ${JSON.stringify(writtenPath)} as the file it wrote, and nothing is there`,
        ).toBe(true);
        // Through `realpathSync` on both sides: the temp directory this run was given can be a
        // short 8.3 path on Windows while the same directory resolves long elsewhere, and a raw
        // string prefix would then fail over a naming form rather than over where the file went.
        const insideProfile = fs
          .realpathSync(writtenPath)
          .toLowerCase()
          .startsWith(fs.realpathSync(userDataDir).toLowerCase());
        expect(
          insideProfile,
          `the diagnostics file landed at ${JSON.stringify(writtenPath)}, outside the profile this ` +
            `run was given (${JSON.stringify(userDataDir)}) — a bug-report dump must never write ` +
            `outside the user-data directory it belongs to`,
        ).toBe(true);

        // The ring spaces dumps, so the press right behind the first one is refused rather than
        // overwriting what a player was about to attach to a report.
        await page.getByTestId('settings-diagnostics-save').click();
        await expect(result).toContainText(en('settingsDiagnosticsNotSavedTitle'), { timeout: 15_000 });
        await expect(result).toContainText(en('settingsDiagnosticsReasonRateLimited'));
        await expect(result).toHaveAttribute('aria-hidden', 'false');
      } finally {
        await app.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  test('the updates section says this build does not update itself, and offers no control that would pretend otherwise', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-settings-updates-'));
    try {
      const { app, page } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        await acceptConsent(page);
        await openSettings(page);

        // The `dev` flavor declares no update channel and this suite launches unpackaged, which is
        // the one combination that reports `disabled`. The button is natively disabled there, so it
        // is deliberately never pressed: a press is the one thing that would reach a release feed.
        const check = page.getByTestId('settings-updates-check');
        await expect(check).toBeVisible({ timeout: 10_000 });
        await expect(check).toBeDisabled();
        await expect(check).toContainText(en('settingsUpdatesCheckAction'));

        const status = page.getByTestId('settings-updates-status');
        await expect(status).toHaveAttribute('aria-hidden', 'false');
        await expect(status).toContainText(en('settingsUpdatesStatusDisabled'));

        const absent = [];
        for (const testId of ['settings-updates-install', 'settings-updates-download', 'settings-updates-progress']) {
          if ((await page.getByTestId(testId).count()) > 0) absent.push(testId);
        }
        expect(
          absent,
          'these controls belong to a phase this build can never reach, so drawing one offers a ' +
            'player an action that does nothing',
        ).toEqual([]);

        const version = page.getByTestId('settings-updates-current-version');
        await expect(version).toHaveText(/^v\d/);
        expect(
          (await version.textContent()).trim(),
          'the version in Settings and the version in the top bar come from the same environment ' +
            'read, so two different strings mean one of them is stale',
        ).toBe((await page.getByTestId('app-version').textContent()).trim());
      } finally {
        await app.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  /**
   * Turning the account read off empties the nav and takes Settings down with it, so this gets its
   * own launch and its own profile — nothing can follow it inside the same app.
   *
   * What it covers is the visible half: the screen a player is left with, and the way back through
   * the disclosure. It does NOT prove the main-process ordering behind the button — that hooks
   * wanting to let go of a game session are awaited BEFORE the record is written, so nothing reads
   * a session past the moment consent stops covering it. That ordering has two checks of its own in
   * the main process, one reading the source and one proving the behaviour; this spec adds the
   * user-visible consequence and claims nothing about the order.
   */
  test('turning the account read off from Settings empties the nav, and the gate leads back through the disclosure', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-settings-revoke-'));
    try {
      const { app, page } = await launchApp({ BFC_USER_DATA_DIR: userDataDir });
      try {
        await acceptConsent(page);
        await openSettings(page);

        const tabsWhileGranted = await page.locator('nav[aria-label="Main"] button').count();
        expect(
          tabsWhileGranted,
          'the nav drew no tabs while consent was granted, so the count below would prove nothing',
        ).toBeGreaterThan(1);

        await page.getByTestId('settings-consent-revoke').click();

        await expect(page.getByTestId('settings-view')).toHaveCount(0, { timeout: 15_000 });
        await expect(page.getByTestId('consent-gate')).toBeVisible({ timeout: 15_000 });
        // The companion has no data source that does not need the account read, so there is no tab
        // left to offer — a nav that kept its tabs would lead to screens with nothing behind them.
        await expect(page.locator('nav[aria-label="Main"] button')).toHaveCount(0);

        const modal = page.getByTestId('consent-modal');
        await page.getByTestId('consent-gate-read-again').click();
        await expect(modal).toBeVisible({ timeout: 15_000 });
        await page.getByTestId('consent-accept').click();

        await expect(page.getByTestId('consent-gate')).toHaveCount(0, { timeout: 15_000 });
        await expect(page.locator('nav[aria-label="Main"] button')).toHaveCount(tabsWhileGranted, {
          timeout: 15_000,
        });
        await expect(navTab(page, 'settingsNavLabel')).toBeVisible();

        const record = await page.evaluate(async () => window.bfc.invoke('consent:get'));
        expect(
          record.decision,
          'the re-grant has to reach the real consent handler, not just close the modal',
        ).toBe('granted');
      } finally {
        await app.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
