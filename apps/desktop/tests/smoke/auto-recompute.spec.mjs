import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');

/**
 * MP3 F3 (design.md `AD-048`, tasks.md T7) — LHP-15 end to end, both directions in one run.
 *
 * **Why ~100 quiet commits produce zero `account:changed` events, and that is correct, not a
 * broken wiring.** `GameReaderService`'s fixture ticker (`BFC_GAME_READER=fixture`) commits an
 * account every `pollAttachedMs` (50 ms) with a fresh `capturedAt` and an otherwise
 * byte-identical body — ~20 commits/s, ~100 in 5 s. `AD-043`'s notifier gates `account:changed`
 * on `accountChangeKey(payload)`, which never reads `capturedAt` (`AD-044`), so every one of
 * those commits produces the SAME key as the last emitted one and is suppressed. The **positive**
 * half of this same run then rewrites the fixture file with a genuinely different value and
 * asserts exactly one notification follows — proving the negative half's zero isn't because
 * nothing is wired, but because nothing relevant changed.
 *
 * Launcher shape reused verbatim from `planning-advice.spec.mjs` (its `BFC_TOKEN_PATH_OVERRIDE`,
 * its `BFC_GAME_PROCESS` pin, its `acceptConsent()` helper and the reasoning below — read, not
 * edited) and `account-restart.spec.mjs`'s `mkdtempSync` + `BFC_USER_DATA_DIR` pattern and its
 * `page.evaluate(() => window.bfc.invoke(...))` idiom.
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
      // Never let a real BombFarm process on the runner machine make "game running" true for
      // reasons unrelated to this feature (same reasoning as account-restart.spec.mjs and
      // planning-advice.spec.mjs).
      BFC_GAME_PROCESS: 'bfc-smoke-no-such-process.exe',
      // SAFETY (T-fix-4, planning-advice.spec.mjs's own comment, reproduced here because this
      // spec launches independently): redirects session-token-file.ts's sessionCfgPath() away
      // from the real %APPDATA%/Godot/app_userdata/BombFarm/session.cfg. acceptConsent() below
      // grants, so this is load-bearing: without it the next account-refresh cycle would open
      // whichever real session.cfg exists on the machine running this suite and issue a live,
      // authenticated request using the real player's token, purely as a side effect of a test
      // run. Pointed at a path that deliberately does not exist:
      // readSessionToken degrades that to token_unavailable (no network call at all).
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

/**
 * Reads the fixture copy, raises the first hero's BASE attack roll, and writes it back
 * ATOMICALLY — write-to-temp then rename, so a tick reading mid-write can never observe a torn
 * file. `fixture-account.ts`'s `loadOverridePayload()` re-reads this path on every tick; a
 * partial read would make `JSON.parse` throw inside `tickFixture`, which `tick()`'s own
 * try/catch swallows into a `stale` status and a dropped commit — a self-inflicted flake this
 * avoids.
 *
 * The mutation has to change what the panel actually PRINTS, which is a much narrower target
 * than changing the sheet. Measured against this exact fixture: raising level, rarity, or any
 * current-stat value — including the Crit Damage bump this spec used to make — leaves the whole
 * rendered ranking byte-identical, because the top row's marginal value is structural for this
 * hero and the differences land below `formatGainPct`'s `toFixed(1)`. Crit Damage +100 moves the
 * top row's gain from 4.545454545454564 to 4.545454545454519; both print `"+4.5%"`.
 *
 * Raising the base attack roll instead changes which stat ranks FIRST — attack at 4.5% gives way
 * to energy at 1.1% — so both `next-point-top-stat` and `next-point-gain` visibly move. It is
 * also the meaningful version of the change: a hero with a much larger base attack gains less
 * from another attack point than from an energy one.
 */
function raiseFirstHeroBaseAttackAtomically(fixtureCopyPath) {
  const payload = JSON.parse(fs.readFileSync(fixtureCopyPath, 'utf8'));
  const heroes = Array.isArray(payload.heroes) ? payload.heroes : [];
  const firstHero = heroes[0];
  if (!firstHero) throw new Error('auto-recompute.spec.mjs: fixture copy has no heroes to mutate');
  if (!firstHero.birth_stats || typeof firstHero.birth_stats.dmg !== 'number') {
    throw new Error("auto-recompute.spec.mjs: fixture copy's first hero has no birth_stats.dmg to mutate");
  }
  firstHero.birth_stats.dmg = 1000;

  const tmpPath = `${fixtureCopyPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload));
  fs.renameSync(tmpPath, fixtureCopyPath);
}

test.describe('auto-recompute smoke (MP3 F3) — 100 quiet commits, then one real change', () => {
  test('~100 fixture commits produce 0 account:changed events; one atomic rewrite produces exactly 1, and the rendered advice changes', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-auto-recompute-'));
    // The committed apps/desktop/tests/fixtures/account-full.json is NEVER written to — every
    // mutation below targets this per-test copy inside the temp directory.
    const fixtureCopyPath = path.join(userDataDir, 'account-full.json');
    fs.copyFileSync(ACCOUNT_FULL_FIXTURE, fixtureCopyPath);

    try {
      const { app, page } = await launchApp({
        BFC_GAME_READER: 'fixture',
        BFC_FIXTURE_ACCOUNT_FILE: fixtureCopyPath,
        BFC_USER_DATA_DIR: userDataDir,
      });
      try {
        await goToPlanning(page);
        await page.waitForSelector('[data-testid="roster-list"]', { timeout: 20_000 });
        await expect(page.getByTestId('next-point-gain')).toBeVisible({ timeout: 20_000 });

        const gainBefore = await page.getByTestId('next-point-gain').innerText();

        // Install the counter FROM THE TEST — zero production probe surface (AD-048). Installed
        // only after the view has already rendered once, so it counts exactly the notifications
        // that happen from this point forward.
        await page.evaluate(() => {
          window.__bfcAccountChanged = 0;
          window.bfc.on('account:changed', () => {
            window.__bfcAccountChanged += 1;
          });
        });

        // Negative half: ~100 fixture commits at pollAttachedMs=50 (≈5s), all planning-identical
        // (only capturedAt moves) — the correct behaviour is zero notifications.
        await page.waitForTimeout(5_000);
        const countAfterQuietPeriod = await page.evaluate(() => window.__bfcAccountChanged);
        expect(countAfterQuietPeriod).toBe(0);

        const gainStillUnchanged = await page.getByTestId('next-point-gain').innerText();
        expect(gainStillUnchanged).toBe(gainBefore);

        // Positive half: one real change, written atomically. fixture-account.ts re-reads
        // BFC_FIXTURE_ACCOUNT_FILE on every tick, so this is picked up within one 50 ms tick.
        raiseFirstHeroBaseAttackAtomically(fixtureCopyPath);

        await expect
          .poll(async () => page.evaluate(() => window.__bfcAccountChanged), { timeout: 15_000, intervals: [200] })
          .toBe(1);

        await expect
          .poll(async () => page.getByTestId('next-point-gain').innerText(), { timeout: 15_000, intervals: [200] })
          .not.toBe(gainBefore);

        // Settle for a further tick window and assert the counter is EXACTLY 1, not merely >=1 —
        // one real change, one notification, never a flurry from the surrounding quiet commits.
        await page.waitForTimeout(1_000);
        const finalCount = await page.evaluate(() => window.__bfcAccountChanged);
        expect(finalCount).toBe(1);

        await app.close();
      } finally {
        await app.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });
});
