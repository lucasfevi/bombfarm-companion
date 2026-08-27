import { test, expect, _electron as electron } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installCollector, readCollectorApi, looksUnminified } from './render-count-collector.mjs';
import { aggregateCommits } from './render-count-aggregate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, '..', '..');
const ACCOUNT_FULL_FIXTURE = path.join(__dirname, '..', 'fixtures', 'account-full.json');
const OUT_PATH = path.join(__dirname, 'out', 'render-count-capture.json');

/**
 * Render-profiling instrument for the live-tab groundwork. Reuses the launcher shape of
 * `auto-recompute.spec.mjs` (`electronExecutable()`, `launchApp()`, `dismissConsent()`,
 * `goToPlanning()`, and its `raiseFirstHeroBaseAttackAtomically()` mutation — read, not edited)
 * and adds a React commit collector on top, installed on the Electron `BrowserContext` before
 * the first window navigates.
 *
 * Measures three things in one run (one Electron launch is expensive; the phases share it,
 * exactly like `auto-recompute.spec.mjs`'s own negative-then-positive structure):
 *
 * 1. A quiet window (only `capturedAt` moving, same ~50ms fixture ticks `auto-recompute.spec.mjs`
 *    proves produce zero `account:changed` events) — recorded, not gated to zero. Measured: it is
 *    NOT zero, and not because of anything account-related. `game-reader-service.ts`'s
 *    `updateStatus()` compares the *whole* next status object, including a freshly generated
 *    `updatedAt`, against the previous one — so on fixture ticks (which call it with a fresh
 *    timestamp every ~50ms) the comparison is always "changed" and `game:status` fires every
 *    tick. `app/page.tsx`'s `bfc.on('game:status', (next) => setStatus(next))` applies every one
 *    of those pushes unconditionally, and that state lives above `PlanningView`, so it recommits
 *    the whole visible tree on a ~50ms cadence regardless of which tab is open or whether account
 *    data changed at all. This is a real, pre-existing defect independent of the
 *    `accountChangeKey` path this instrument was commissioned to watch — out of scope to fix
 *    here (only `game-reader-service.ts`/`app/page.tsx` would need to change, and this task's
 *    brief is instrument-only), so it is recorded as a measurement rather than asserted to zero.
 * 2. The one fixture mutation known to change what the panel prints — raising the first hero's
 *    `birth_stats.dmg` — must commit at least one component more than the phase-1 background
 *    rate accounts for, and its per-component tally is recorded.
 * 3. That same mutation touches exactly one hero out of the fixture's roster, so its total
 *    render count IS the answer to "what does a one-hero change cost" — there is no second,
 *    narrower mutation known to move the rendered output, so this reuses phase 2's capture
 *    rather than inventing one.
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

/**
 * `BrowserContext.addInitScript` only binds future navigations, and Electron's main process has
 * already started loading the first window's document by the time `electron.launch()` resolves
 * control back here — there is no hook earlier than this to install into, so the reloaded
 * document is the one every measurement below runs against.
 *
 * Reloading immediately after the first `app-ready` was measured to abort the whole app, not
 * just the reload: `net::ERR_ABORTED loading '.../index.html'`, logged by the main process as
 * `boot.failed`, followed by `app.quit()` — reproduced with both `page.reload()` and
 * `app.evaluate(...).webContents.reload()`, both `CDP`- and main-process-issued. Isolated with
 * timestamped logging around each step: `app-ready` becoming visible is not proof the frame has
 * finished settling — reloading too soon after it lands during a window (measured: order of a
 * few hundred ms to ~1s right after a fresh build, i.e. cold OS file/page caches; still present,
 * just narrower, on an already-built one) where Chromium aborts the new navigation instead of
 * queuing it. A fixed settle wait after `app-ready`, confirmed empirically (10/10 clean runs
 * immediately after a fresh build, both reload mechanisms) fixes it; the reload call itself was
 * not the defect. Kept as a main-process `webContents.reload()` anyway — no CDP navigation
 * command competing with Electron's own for the same frame is one less thing to reason about,
 * even though the settle wait alone was sufficient in testing.
 *
 * Liveness has to prove the reload actually produced a fresh document, not just that
 * `hookInstalled`/`sawCommit` read true — a hook object is only proof if it exists in a document
 * that genuinely reloaded. A random marker written before the reload and checked for absence
 * after is exactly that proof: it can only still be there if the old JS context survived (i.e.
 * the reload was a no-op), which a real navigation can never produce.
 */
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
      BFC_TOKEN_PATH_OVERRIDE: path.join(desktopRoot, 'tests', 'render-count', '.no-such-session.cfg'),
      ...env,
    },
  });
  try {
    const page = await app.firstWindow();
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });
    // See the settle-window note above — reloading right after this resolves is measured to
    // abort the navigation on a cold build. Not a magic number: comfortably past the worst case
    // measured (order of ~1s), not tuned to the minimum that happens to pass.
    await page.waitForTimeout(2_000);

    const preReloadMarker = await page.evaluate(() => {
      const marker = `pre-reload-${Math.random()}`;
      window.__BFC_PRE_RELOAD_MARKER__ = marker;
      return marker;
    });

    await installCollector(app.context());
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].webContents.reload();
    });
    await page.waitForSelector('[data-testid="app-ready"]', { timeout: 60_000 });

    const liveness = await page.evaluate((expectedMarker) => {
      const api = window.__BFC_RENDER_COUNT__;
      return {
        markerSurvived: window.__BFC_PRE_RELOAD_MARKER__ === expectedMarker,
        hookInstalled: api ? api.hookInstalled : false,
        sawCommit: api ? api.sawCommit : false,
      };
    }, preReloadMarker);

    if (liveness.markerSurvived) {
      throw new Error(
        'render-count instrument: the pre-reload marker survived the reload — the document ' +
          'was never actually re-navigated, so the collector init script (registered right ' +
          "before the reload) cannot have run either. hookInstalled/sawCommit would be lying " +
          'if trusted on their own here.',
      );
    }
    if (!liveness.hookInstalled || !liveness.sawCommit) {
      throw new Error(
        'render-count instrument: the reload genuinely happened (marker gone) but the React ' +
          'DevTools hook never attached before the app rendered — the collector init script ' +
          'did not run, or ran too late.',
      );
    }

    return { app, page };
  } catch (err) {
    await app.close().catch(() => undefined);
    throw err;
  }
}

async function acceptConsent(page) {
  // Accept: the app shows a permission gate with no navigation until consent is granted, so
  // nothing below is reachable otherwise.
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

function raiseFirstHeroBaseAttackAtomically(fixtureCopyPath) {
  const payload = JSON.parse(fs.readFileSync(fixtureCopyPath, 'utf8'));
  const heroes = Array.isArray(payload.heroes) ? payload.heroes : [];
  const firstHero = heroes[0];
  if (!firstHero) throw new Error('render-count.spec.mjs: fixture copy has no heroes to mutate');
  if (!firstHero.birth_stats || typeof firstHero.birth_stats.dmg !== 'number') {
    throw new Error("render-count.spec.mjs: fixture copy's first hero has no birth_stats.dmg to mutate");
  }
  firstHero.birth_stats.dmg = 1000;

  const tmpPath = `${fixtureCopyPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload));
  fs.renameSync(tmpPath, fixtureCopyPath);
}

/**
 * The web perf harness treats "renders recorded with 0ms total commit duration" as a dead
 * profiler. Measured here: that signal does not carry over. `fiber.actualDuration` is only
 * populated by React's profiling build (`react-dom/profiling`, or `next build --profile`) or
 * inside a `<React.Profiler>` — none of which the desktop renderer's real `next build renderer`
 * output uses, so `totalCommitDurationMs` is 0 for every capture here regardless of whether the
 * collector is alive. Building a profiling variant to get real durations would mean disabling
 * minification too (component names are already confirmed mangled below), which the web side
 * already tried and rejected for exactly this reason — it stops measuring what actually ships.
 * The liveness proof that survives instead is `hookInstalled && sawCommit` at the baseline
 * render, checked once above before any phase runs, plus each phase's own
 * `componentRenders > 0` assertion where a real render is expected.
 */

test.describe('render-count instrument', () => {
  test('quiet reads render nothing; a one-hero fixture change renders, and the cost is recorded', async () => {
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bfc-render-count-'));
    const fixtureCopyPath = path.join(userDataDir, 'account-full.json');
    fs.copyFileSync(ACCOUNT_FULL_FIXTURE, fixtureCopyPath);

    const capture = {
      capturedAt: new Date().toISOString(),
      hookInstalled: false,
      sawCommit: false,
      quiet: null,
      quietWindowMs: null,
      oneHeroChange: null,
      oneHeroChangeWindowMs: null,
      oneHeroChangeNetOfBackground: null,
      unminifiedComponentKeys: null,
    };

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

        // launchApp() already proved liveness (marker gone + hook attached) right after the
        // reload; this re-checks the same collector survived the in-app navigation to Planning.
        const baselineApi = await readCollectorApi(page);
        capture.hookInstalled = baselineApi.hookInstalled;
        capture.sawCommit = baselineApi.sawCommit;
        if (!baselineApi.hookInstalled || !baselineApi.sawCommit) {
          throw new Error(
            'render-count instrument: the collector was alive right after launch but is not ' +
              'anymore after navigating to Planning.',
          );
        }

        const gainBefore = await page.getByTestId('next-point-gain').innerText();

        // The first paint still has a few post-mount effects to settle (measured: tooltip
        // portal/motion setup for the ranking table's rows) on top of the `game:status` churn
        // described in the module doc comment — and that churn never truly goes quiet, so a
        // "wait until no commits for Nms" primitive (the web perf harness's `waitForQuiet`)
        // cannot work here: it would wait for a state that structurally never occurs. A fixed
        // settle delay is the honest substitute — it only needs to outlast the one-time mount
        // effects, not the ongoing background rate that phase 1 below measures on purpose.
        await page.waitForTimeout(1_000);

        // Phase 1 (quiet window): ~100 fixture commits at pollAttachedMs=50 (~5s), all
        // planning-identical (only capturedAt moves) — auto-recompute.spec.mjs's own negative
        // half. See the module doc comment: this is measured, not gated to zero — a real,
        // unrelated `game:status` re-render source keeps this above zero regardless of account
        // data.
        const quietWindowMs = 5_000;
        await page.evaluate(() => window.__BFC_RENDER_COUNT__.reset());
        await page.waitForTimeout(quietWindowMs);
        const quietCommits = await page.evaluate(() => window.__BFC_RENDER_COUNT__.commits);
        capture.quiet = aggregateCommits(quietCommits);
        capture.quietWindowMs = quietWindowMs;

        const gainStillUnchanged = await page.getByTestId('next-point-gain').innerText();
        expect(gainStillUnchanged).toBe(gainBefore);

        // Phase 2/3 (one real, one-hero change): raises heroes[0].birth_stats.dmg — the mutation
        // auto-recompute.spec.mjs establishes is the one that actually moves the rendered
        // output for this fixture.
        const changeWindowStart = await page.evaluate(() => {
          window.__BFC_RENDER_COUNT__.reset();
          return performance.now();
        });
        raiseFirstHeroBaseAttackAtomically(fixtureCopyPath);

        await expect
          .poll(async () => page.getByTestId('next-point-gain').innerText(), {
            timeout: 15_000,
            intervals: [200],
          })
          .not.toBe(gainBefore);

        // Settle tail, mirroring auto-recompute.spec.mjs's post-change window.
        await page.waitForTimeout(1_000);
        const changeWindowEnd = await page.evaluate(() => performance.now());
        const changeCommits = await page.evaluate(() => window.__BFC_RENDER_COUNT__.commits);
        capture.oneHeroChange = aggregateCommits(changeCommits);
        capture.oneHeroChangeWindowMs = changeWindowEnd - changeWindowStart;

        expect(capture.oneHeroChange.componentRenders, 'one-hero-change componentRenders').toBeGreaterThan(0);

        // The same `game:status` churn from phase 1 keeps ticking during this window too — it is
        // not something the one-hero mutation caused, so it is estimated out here rather than
        // left to inflate "the cost of a one-hero change". `quiet`'s own rate is the best
        // available estimate of that background floor; this is a measurement aid, not a gate.
        const backgroundRatePerMs = capture.quiet.componentRenders / capture.quietWindowMs;
        const expectedBackground = Math.round(backgroundRatePerMs * capture.oneHeroChangeWindowMs);
        capture.oneHeroChangeNetOfBackground = Math.max(
          0,
          capture.oneHeroChange.componentRenders - expectedBackground,
        );

        capture.unminifiedComponentKeys = Object.keys(capture.oneHeroChange.renderTally).filter(looksUnminified);

        await app.close();
      } finally {
        await app.close().catch(() => undefined);
      }
    } finally {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }

    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, `${JSON.stringify(capture, null, 2)}\n`, 'utf8');
    // eslint-disable-next-line no-console
    console.log(`[render-count] wrote ${OUT_PATH}`);
    // eslint-disable-next-line no-console
    console.log(
      `[render-count] quiet.componentRenders=${capture.quiet.componentRenders} (over ${capture.quietWindowMs}ms) ` +
        `oneHeroChange.componentRenders=${capture.oneHeroChange.componentRenders} ` +
        `(netOfBackground=${capture.oneHeroChangeNetOfBackground}) ` +
        `oneHeroChange.distinctComponents=${capture.oneHeroChange.distinctComponents}`,
    );
  });
});
