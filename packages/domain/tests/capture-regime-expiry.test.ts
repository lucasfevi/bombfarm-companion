/**
 * Self-proving regression for `helpers/capture-regime.ts`'s runtime skip, exercised against a
 * REAL committed capture rather than a fake one — `sheet-math/save-20260813-5heroes.json`
 * predates the 2026-08-18 balance patch (see `fixtures/sheet-math/README.md`).
 *
 * The test below is EXPECTED to report skipped, not passed: `skipIfBefore` must stop it before
 * the `throw` on the next line ever runs. If the expiry mechanism's date comparison were ever
 * inverted or broken, this reports a hard FAILURE (the thrown error) instead of quietly passing —
 * the same loud-or-nothing posture `skipIfBefore` itself is for.
 */
import { describe, it } from 'vitest';
import { skipIfBefore } from './helpers/capture-regime';

describe('capture-regime expiry — fires on a real pre-patch capture', () => {
  it('a value assertion against save-20260813-5heroes.json reports EXPIRED, not passed', (ctx) => {
    skipIfBefore(
      ctx,
      'save-20260813-5heroes.json',
      '2026-08-18',
      'crit chance and cooldown were restated as percent-of-base by the 2026-08-18 patch.',
    );
    throw new Error(
      'unreachable: save-20260813-5heroes.json was captured 2026-08-13, before 2026-08-18, so ' +
        'skipIfBefore must have skipped this test before this line — if you see this failure, the ' +
        'expiry mechanism itself is broken.',
    );
  });
});
