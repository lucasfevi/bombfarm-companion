import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');

/**
 * Two scenarios, one launcher (`account-restart.spec.mjs`'s structure and `getByTestId` idiom —
 * read, not edited).
 *
 * Scenario A proves the milestone's headline claim end to end: a seeded, birth-carrying account
 * (via the `AD-039` `BFC_FIXTURE_ACCOUNT_FILE` seam) renders real next-point advice with the
 * game "not running", and selecting a second hero updates the detail area (MPV-01, MPV-02,
 * MPV-13).
 *
 * Scenario B proves the withhold rule end to end, but via the state this repo's actual committed
 * fixture (`packages/game-data/fixtures/hero-record.json`) triggers — not the one tasks.md's own
 * prose originally assumed. That file has no `birth_stats` on its one hero ("Lorne"), so
 * `parseAccountPayload` rejects the **whole file** before any per-section skills/casa check ever
 * runs (design.md §2.5, verified independently here); `availability` is `'rejected'`, not
 * `'partial'` with a `withheld-dps` notice on a rendered roster. SPEC_DEVIATION, recorded
 * plainly: this scenario asserts the rejection empty-state (reason `missingBirthStats`, hero name
 * "Lorne", zero roster rows, zero next-point-ranking) rather than a `withheld-dps` notice next to
 * a real roster row, because that is what this fixture actually produces end to end, and is
 * itself a complete proof of the same rule (no fallback number ever renders) — just via the
 * whole-file-reject path instead of the per-section-withhold path.
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

async function launchApp(env) {
  const app = await electron.launch({
    executablePath: electronExecutable(),
    args: [desktopRoot],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BFC_FLAVOR: 'dev',
      ELECTRON_ENABLE_LOGGING: '1',
      // Same reasoning as account-restart.spec.mjs: never let a real BombFarm process on the
      // runner machine make "game running" true for reasons unrelated to this feature.
      BFC_GAME_PROCESS: 'bfc-smoke-no-such-process.exe',
      // Same reasoning as consent-modal.spec.mjs (SAFETY, T-fix-4): redirects
      // session-token-file.ts's sessionCfgPath() away from the real
      // %APPDATA%/Godot/app_userdata/BombFarm/session.cfg. `acceptConsent()` below grants, so
      // this is load-bearing: without it the next account-refresh cycle would open whichever real
      // session.cfg exists on the machine running this suite and issue a live, authenticated
      // request using the real player's token, purely as a side effect of a test run. Pointed at
      // a path that deliberately does not exist: readSessionToken degrades that to
      // `token_unavailable` (no network call at all).
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      ...env,
    },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  return { app, page };
}

async function acceptConsent(page) {
  // Accept: the app shows a permission gate instead of its content until consent is granted, so
  // nothing below is reachable otherwise. Accepting is safe for a fixture-backed suite now that a
  // refresh cycle which resolves no section commits nothing — it can no longer overwrite the
  // fixture reader's resolved sections with a token_unavailable placeholder.
  const modal = page.getByTestId('consent-modal');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-accept').click();
  await expect(modal).toBeHidden({ timeout: 15_000 });
}

async function goToPlanning(page) {
  await acceptConsent(page);
  await page.getByRole('button', { name: 'Planning' }).click();
  await page.waitForSelector('[data-testid="planning-view"]', { timeout: 15_000 });
}

test.describe('planning advice smoke (MP3 F2)', () => {
  test('Scenario A — a seeded birth-carrying account renders real advice, and selecting a hero updates the detail area', async () => {
    // Isolated per-test user-data dir (account-restart.spec.mjs's pattern) — never the
    // developer's real %APPDATA% flavor directory, so the ConsentModal starts unanswered and
    // deterministically, and no real session.cfg or account DB is anywhere nearby.
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-planning-advice-'));
    try {
      const { app, page } = await launchApp({
        BFC_GAME_READER: 'fixture',
        BFC_FIXTURE_ACCOUNT_FILE: ACCOUNT_FULL_FIXTURE,
        BFC_USER_DATA_DIR: userDataDir,
      });
      try {
        await goToPlanning(page);

        await page.waitForSelector('[data-testid="roster-list"]', { timeout: 20_000 });
        await expect(page.getByTestId('roster-row-h-aurora')).toBeVisible();
        await expect(page.getByTestId('roster-row-h-borealis')).toBeVisible();

        await expect(page.getByTestId('next-point-top-stat')).toBeVisible({ timeout: 20_000 });
        await expect(page.getByTestId('next-point-gain')).toBeVisible();

        const firstDetailName = await page.getByTestId('hero-detail-name').innerText();
        expect(firstDetailName.length).toBeGreaterThan(0);

        // Select the second hero — the detail area must update without a full page transition and
        // without re-reading the account (MPV-13, use-account-view.test.ts's own invoke-count
        // guarantee at the unit layer; this is the end-to-end half).
        await page.getByTestId('roster-row-h-borealis').getByRole('button').click();
        await expect(page.getByTestId('hero-detail-name')).not.toHaveText(firstDetailName, { timeout: 10_000 });
        const secondDetailName = await page.getByTestId('hero-detail-name').innerText();
        expect(secondDetailName).toContain('Borealis');

        await app.close();
      } finally {
        await app.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  test('Scenario B — the committed fixture (no birth_stats) rejects the whole file, so no numbers ever render, only the reason and hero name', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-planning-advice-'));
    try {
      const { app, page } = await launchApp({
        BFC_GAME_READER: 'fixture',
        BFC_USER_DATA_DIR: userDataDir,
        // Deliberately no BFC_FIXTURE_ACCOUNT_FILE — exercises the committed
        // packages/game-data/fixtures/hero-record.json path.
      });
      try {
        await goToPlanning(page);

        // Give the fixture producer at least one tick to commit before asserting the rejected
        // state is what's actually rendered (not a pre-tick loading placeholder).
        await expect
          .poll(
            async () => {
              const view = await page.evaluate(async () => {
                const bridge = window.bfc;
                if (!bridge) throw new Error('preload bridge missing');
                return bridge.invoke('account:get');
              });
              return view.payload.fidelity?.heroes?.status;
            },
            { timeout: 30_000 },
          )
          .toBe('resolved');

        await expect(page.getByText('Lorne')).toBeVisible({ timeout: 15_000 });

        // No roster, no ranking table — the whole-file reject withholds everything, never a
        // partial sheet.
        await expect(page.getByTestId('roster-list')).toHaveCount(0);
        await expect(page.getByTestId('next-point-ranking')).toHaveCount(0);
        await expect(page.getByTestId('hero-detail')).toHaveCount(0);

        await app.close();
      } finally {
        await app.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
