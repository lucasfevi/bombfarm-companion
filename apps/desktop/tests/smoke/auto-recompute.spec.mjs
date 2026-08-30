import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
// The offline fixture, not account-full: the positive half below asserts a change reaches a
// rendered screen, and account-full carries zero items so the Inventory screen would show its
// empty state either side of the mutation.
const ACCOUNT_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-offline.json');

/**
 * Change detection end to end, both directions in one run.
 *
 * **Why ~100 quiet commits produce zero `account:changed` events, and that is correct, not a
 * broken wiring.** `GameReaderService`'s fixture ticker (`BFC_GAME_READER=fixture`) commits an
 * account every `pollAttachedMs` (50 ms) with a fresh `capturedAt` and an otherwise
 * byte-identical body — ~20 commits/s, ~100 in 5 s. The notifier gates `account:changed`
 * on `accountChangeKey(payload)`, which never reads `capturedAt`, so every one of
 * those commits produces the SAME key as the last emitted one and is suppressed. The **positive**
 * half of this same run then rewrites the fixture file with a genuinely different value and
 * asserts exactly one notification follows — proving the negative half's zero isn't because
 * nothing is wired, but because nothing relevant changed.
 *
 * Launcher shape shared with the other smoke specs (its `BFC_TOKEN_PATH_OVERRIDE`, its
 * `BFC_GAME_PROCESS` pin, its `acceptConsent()` helper and the reasoning below) and
 * `account-restart.spec.mjs`'s `mkdtempSync` + `BFC_USER_DATA_DIR` pattern and its
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
      // reasons unrelated to the change detection under test (same reasoning as
      // account-restart.spec.mjs).
      BFC_GAME_PROCESS: 'bfc-smoke-no-such-process.exe',
      // SAFETY (reproduced in every smoke spec that launches independently): redirects
      // session-token-file.ts's sessionCfgPath() away
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

async function goToInventory(page) {
  await acceptConsent(page);
  await page.getByRole('button', { name: 'Inventory' }).click();
  await page.waitForSelector('[data-testid="inventory-view"]', { timeout: 15_000 });
}

/**
 * Reads the fixture copy, drops one gear item, and writes it back ATOMICALLY — write-to-temp
 * then rename, so a tick reading mid-write can never observe a torn file.
 * `fixture-account.ts`'s `loadOverridePayload()` re-reads this path on every tick; a partial
 * read would make `JSON.parse` throw inside `tickFixture`, which `tick()`'s own try/catch
 * swallows into a `stale` status and a dropped commit — a self-inflicted flake this avoids.
 *
 * Gear (wire `category` 0), specifically: it is the one kind the Inventory screen never stacks,
 * so exactly one card leaves the grid and the assertion is a card count rather than a string
 * compare against a label that a future reword would move. Returns the item it removed so the
 * caller can say what it did when the count fails to move.
 */
function dropOneGearItemAtomically(fixtureCopyPath) {
  const payload = JSON.parse(fs.readFileSync(fixtureCopyPath, 'utf8'));
  const items = Array.isArray(payload.items) ? payload.items : [];
  const index = items.findIndex((item) => item?.category === 0);
  if (index < 0) throw new Error('auto-recompute.spec.mjs: fixture copy has no gear item to drop');
  const [dropped] = items.splice(index, 1);

  const tmpPath = `${fixtureCopyPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload));
  fs.renameSync(tmpPath, fixtureCopyPath);
  return dropped;
}

test.describe('auto-recompute smoke — 100 quiet commits, then one real change', () => {
  test('~100 fixture commits produce 0 account:changed events; one atomic rewrite produces exactly 1, and the rendered screen changes', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-auto-recompute-'));
    // The committed apps/desktop/tests/fixtures/account-offline.json is NEVER written to — every
    // mutation below targets this per-test copy inside the temp directory.
    const fixtureCopyPath = path.join(userDataDir, 'account-offline.json');
    fs.copyFileSync(ACCOUNT_FIXTURE, fixtureCopyPath);

    try {
      const { app, page } = await launchApp({
        BFC_GAME_READER: 'fixture',
        BFC_FIXTURE_ACCOUNT_FILE: fixtureCopyPath,
        BFC_USER_DATA_DIR: userDataDir,
      });
      try {
        await goToInventory(page);
        await page.waitForSelector('[data-testid="inventory-card"]', { timeout: 20_000 });

        const cards = page.getByTestId('inventory-card');
        const cardsBefore = await cards.count();
        expect(cardsBefore).toBeGreaterThan(0);

        // Install the counter FROM THE TEST — zero production probe surface. Installed
        // only after the view has already rendered once, so it counts exactly the notifications
        // that happen from this point forward.
        await page.evaluate(() => {
          window.__bfcAccountChanged = 0;
          window.bfc.on('account:changed', () => {
            window.__bfcAccountChanged += 1;
          });
        });

        // Negative half: ~100 fixture commits at pollAttachedMs=50 (≈5s), every one carrying an
        // identical body (only capturedAt moves) — the correct behaviour is zero notifications.
        await page.waitForTimeout(5_000);
        const countAfterQuietPeriod = await page.evaluate(() => window.__bfcAccountChanged);
        expect(countAfterQuietPeriod).toBe(0);

        expect(await cards.count()).toBe(cardsBefore);

        // Positive half: one real change, written atomically. fixture-account.ts re-reads
        // BFC_FIXTURE_ACCOUNT_FILE on every tick, so this is picked up within one 50 ms tick.
        const dropped = dropOneGearItemAtomically(fixtureCopyPath);

        await expect
          .poll(async () => page.evaluate(() => window.__bfcAccountChanged), { timeout: 15_000, intervals: [200] })
          .toBe(1);

        await expect
          .poll(async () => cards.count(), {
            timeout: 15_000,
            intervals: [200],
            message: `dropping gear item ${dropped?.id} never removed a card from the grid`,
          })
          .toBe(cardsBefore - 1);

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
