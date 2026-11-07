import { test as base, expect, _electron } from '@playwright/test';
import { createViolationLog, guardEachTest, guardWorkerEnd } from './csp-guard.mjs';

const violations = createViolationLog();

export const electron = { launch: (options) => violations.launchWatched((launchOptions) => _electron.launch(launchOptions), options) };

/** Long enough for the reply to the `evaluate` that schedules the quit to get back first. */
const QUIT_DELAY_MS = 100;
/** Past the app's own eight-second wait for the tap to leave the game, with room to spare. */
const QUIT_DEADLINE_MS = 30_000;
const ACCESS_VIOLATION = 0xc0000005;

/**
 * Quits the way the app quits for a player, and returns once the process has gone: its exit code,
 * or null when it never left. For any spec that relaunches on the same data folder, where what the
 * run left behind matters. A spec with one launch can keep `app.close()`.
 *
 * `app.close()` calls `app.quit()` and drops its inspector socket straight after. On Windows that
 * crashed the main process in 3 launches of 12 (exit 0xC0000005, a null read on an unnamed thread
 * with socket code on its stack and none of the app's modules), inside the quit and before Chromium's
 * last write.
 * Quitting with the socket still open: none in 32, and none in 25 with no inspector at all. The
 * write it loses is `Local State`, which holds the key behind `safeStorage`. Chromium saves that file
 * about ten seconds after making the key, or at a clean exit, so a run shorter than that loses the
 * key: the next launch makes another, cannot read what the last one sealed, and starts signed out.
 */
export async function quitApp(app) {
  const child = app.process();
  const exited = new Promise((resolve) => {
    if (child.exitCode !== null) resolve(child.exitCode);
    else child.once('exit', (code) => resolve(code));
  });
  let deadline;
  const code = await app
    .evaluate(({ app: electronApp }, delay) => {
      setTimeout(() => electronApp.quit(), delay);
    }, QUIT_DELAY_MS)
    .then(() =>
      Promise.race([
        exited,
        new Promise((resolve) => {
          deadline = setTimeout(() => resolve(null), QUIT_DEADLINE_MS);
        }),
      ]),
    )
    .catch(() => null)
    .finally(() => clearTimeout(deadline));
  await app.close().catch(() => undefined);
  return code;
}

/** Fails on a quit that crashed or hung: the next launch would inherit whatever it failed to save. */
export function expectCleanExit(code) {
  const shown = code === ACCESS_VIOLATION ? 'an access violation' : String(code);
  expect(code, `the app exited with ${shown} instead of 0`).toBe(0);
}

export const test = base.extend({
  /** Violations a spec expects to provoke take them out here; whatever is left fails the test. */
  csp: [async ({}, use) => guardEachTest(use, violations), { auto: true }],
  cspAtWorkerEnd: [async ({}, use) => guardWorkerEnd(use, violations), { scope: 'worker', auto: true }],
});

export { expect };
