/**
 * The corpus's captures are named `save-YYYYMMDD-...` / `payload-YYYYMMDD-...` (see
 * `fixtures/sheet-math/README.md`, `fixtures/farm-rate/README.md`), and the game has moved
 * through several balance regimes since the earliest ones were taken. A test that reads a capture
 * to check STRUCTURE (does it parse, does the roster have the right shape) survives a regime
 * change; a test that asserts a specific NUMBER off the same capture does not — the number was
 * true of the game on the capture's date, and nothing says so on the test itself.
 *
 * This module gives value-asserting tests a single, mechanical way to say which regime they
 * depend on and skip themselves — loudly, with a reason — the moment their capture predates it,
 * instead of quietly asserting a number nobody has re-checked. It replaces nothing existing (no
 * committed test is changed to use it): it is the primitive that should exist before the NEXT
 * value-asserting test is written, and the mechanism that would have caught the captures this
 * repo already had to hand-skip (see `tools/fixture-corpus-parity.test.mjs`'s F8 manifest) had it
 * existed when those tests were written.
 *
 * CONVENTION: a test file whose assertions read specific numbers off a named capture should
 * import {@link skipIfBefore} and call it as the first statement of every such test (or once per
 * `describe`, via `beforeEach`), naming the capture, the regime boundary its numbers depend on,
 * and why. That call is what makes the test IDENTIFIABLE as a value test, separately from a
 * structural one reading the same file (which calls neither this module nor asserts a specific
 * number, and so keeps passing across a regime change by construction).
 *
 * Deliberately per-call rather than a single global cutoff: this repo has already lived through
 * three regime boundaries that do not collapse into one date (2026-08-15, -18 and -23, each
 * reshaping a different mechanic — see `fixtures/sheet-math/README.md` and
 * `points-within-level-budget.test.ts`'s `NON_CURRENT_REGIME_CAPTURES`), so a test names the
 * boundary its OWN claim depends on rather than trusting a shared constant that could be true for
 * one mechanic and false for another on the same date.
 */
import type { TestContext } from 'vitest';

// `(?:^|[/\\])` rather than `(?:^|\/)`: callers build the `dir/filename` shape with `path.join`,
// which emits `\` on Windows, and this repo is developed and CI'd on Windows.
const CAPTURE_DATE_PATTERN = /(?:^|[/\\])(?:save|payload)-(\d{4})(\d{2})(\d{2})-/;

/**
 * Throws rather than returning `undefined` on a name it cannot parse: a silent `undefined` here
 * would make {@link isBefore} vacuously `false` for a typo'd or non-capture filename, which is
 * the false-all-clear this module exists to avoid elsewhere.
 */
export function captureDateOf(fixtureName: string): string {
  const match = CAPTURE_DATE_PATTERN.exec(fixtureName);
  if (!match) {
    throw new Error(
      `capture-regime: "${fixtureName}" does not carry a "save-YYYYMMDD-" or "payload-YYYYMMDD-" ` +
        'capture date. Only fixtures named that way can be regime-checked this way.',
    );
  }
  const [, year, month, day] = match;
  return `${year}-${month}-${day}`;
}

export function isBefore(fixtureName: string, regimeBoundary: string): boolean {
  // Both sides are zero-padded YYYY-MM-DD, so lexicographic string comparison is date comparison.
  return captureDateOf(fixtureName) < regimeBoundary;
}

/**
 * A runtime `context.skip()`, not a `.skip(...)` literal — needs no entry in the static skip
 * manifests (`tools/fixture-corpus-parity.test.mjs`, `source-surface.test.ts`), which police
 * skips nobody explained; the explanation here is generated from the capture's own date instead.
 *
 * @param ctx The test's {@link TestContext} (the callback's first argument in `it('...', (ctx) => ...)`).
 * @param fixtureName The capture this test's assertions read specific numbers from.
 * @param regimeBoundary The `YYYY-MM-DD` this test's numbers depend on the game being at or past.
 * @param reason What changed at that boundary that this test's numbers assume (one sentence).
 */
export function skipIfBefore(ctx: TestContext, fixtureName: string, regimeBoundary: string, reason: string): void {
  const capturedOn = captureDateOf(fixtureName);
  ctx.skip(
    capturedOn < regimeBoundary,
    `${fixtureName} was captured ${capturedOn}, before ${regimeBoundary} — ${reason} This capture's ` +
      'numbers are EXPIRED, not verified: nobody has re-checked them against the current game.',
  );
}
