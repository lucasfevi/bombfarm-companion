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
 * its `BFC_GAME_PROCESS` pin, its `dismissConsent()` decline and the reasoning below — read, not
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
      // from the real %APPDATA%/Godot/app_userdata/BombFarm/session.cfg. dismissConsent() below
      // declines, so this is defense-in-depth rather than load-bearing today — but if consent
      // were ever accepted (here or by a future edit), the next account-refresh cycle would
      // otherwise open whichever real session.cfg exists on the machine running this suite and
      // issue a live, authenticated request using the real player's token, purely as a side
      // effect of a test run. Pointed at a path that deliberately does not exist:
      // readSessionToken degrades that to token_unavailable (no network call at all).
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'smoke', '.no-such-session.cfg'),
      ...env,
    },
  });
  const page = await app.firstWindow();
  await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
  return { app, page };
}

async function dismissConsent(page) {
  // Decline, never accept (planning-advice.spec.mjs's reasoning, reproduced): accepting switches
  // on accountRefresh, whose token_unavailable view then unconditionally shadows the fixture
  // reader through mergeStoredIntoLive (index.ts:94-98 prefers accountRefresh.getLastView() once
  // consent is granted) and can never be `resolved` — the exact defect T-fix-6 fixed from the
  // other side. Declining keeps consentGranted false, so account:get/the notifier never even look
  // at accountRefresh's view; both serve the fixture reader's own (genuinely resolved) cache.
  const modal = page.getByTestId('consent-modal');
  await expect(modal).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('consent-decline').click();
  await expect(modal).toBeHidden({ timeout: 15_000 });
}

async function goToPlanning(page) {
  await dismissConsent(page);
  await page.getByRole('button', { name: 'Planning' }).click();
  await page.waitForSelector('[data-testid="planning-view"]', { timeout: 15_000 });
}

/**
 * Reads the fixture copy, raises the first hero's Crit Damage stat by +100, and writes it back
 * ATOMICALLY — write-to-temp then rename, so a tick reading mid-write can never observe a torn
 * file. `fixture-account.ts`'s `loadOverridePayload()` re-reads this path on every tick; a
 * partial read would make `JSON.parse` throw inside `tickFixture`, which `tick()`'s own
 * try/catch swallows into a `stale` status and a dropped commit — a self-inflicted flake this
 * avoids.
 *
 * NOT a level bump (that was this test's original, flawed mutation): raising level rescales the
 * hero's whole sheet by the same factor that its own next-point marginal value scales by, so
 * `next-point-gain`'s ratio barely moves — verified numerically against this exact fixture,
 * raising this hero's level 55 -> 75 moves `dpsGainPct` by < 1e-9, invisible at
 * `formatGainPct`'s `toFixed(1)` precision (both render `"+6.6%"`).
 *
 * Crit Damage's marginal-point value is a fixed rarity-based constant
 * (`POINT_GAIN.critDmgPctOfBase * BASE_ROLLS[rarity].critDmg`,
 * packages/domain/src/model/points-rank.ts) — independent of the hero's current stat — so
 * spending a real stat point there does shrink the ratio. Verified numerically against this
 * exact fixture (`h-aurora`, Épico rarity): `+100` lands inside the exact-one-point band
 * (inferSpentPoints resolves it to `pts.critDmg === 1`, no `nonIntegerPoints` residual — the
 * band runs ~94.5 to ~102.5, so `+100` sits comfortably clear of both edges), moving the
 * top-ranked `next-point-gain` from `dpsGainPct = 6.62354463130661` ("+6.6%") to
 * `dpsGainPct = 6.212084445522947` ("+6.2%") — a real, rendered, end-to-end difference, not a
 * precision artifact.
 */
function raiseFirstHeroCritDmgAtomically(fixtureCopyPath) {
  const payload = JSON.parse(fs.readFileSync(fixtureCopyPath, 'utf8'));
  const heroes = Array.isArray(payload.heroes) ? payload.heroes : [];
  const firstHero = heroes[0];
  if (!firstHero) throw new Error('auto-recompute.spec.mjs: fixture copy has no heroes to mutate');
  if (!firstHero.stats || typeof firstHero.stats.crit_dmg !== 'number') {
    throw new Error("auto-recompute.spec.mjs: fixture copy's first hero has no stats.crit_dmg to mutate");
  }
  firstHero.stats.crit_dmg += 100;

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
        raiseFirstHeroCritDmgAtomically(fixtureCopyPath);

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
