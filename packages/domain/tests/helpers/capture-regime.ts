import { beforeEach, type TestContext } from 'vitest';
import { skipUnlessInRegime, type Mechanic } from './capture-regime-core';

export * from './capture-regime-core';

/**
 * The whole-suite form, for a value suite whose capture has expired and for which NO admissible
 * capture exists in the corpus yet.
 *
 * WHY THIS IS NOT THE QUIET SKIP {@link assertInRegime} EXISTS TO PREVENT. That function is the
 * right answer when an admissible capture exists and the suite is pointed at the wrong one: the
 * fix is a one-line re-point, and failing loudly is what prompts it. It is the wrong answer when
 * the corpus holds nothing the suite could be re-pointed AT, because then "fail loudly" is a
 * standing red that no one can clear, and a standing red is how a suite stops being read.
 *
 * A held suite is NOT visible on its own: a skip is counted, but a counted skip in a green run
 * reads as green. Between 2026-08-28 and 2026-09-16 twenty-four suites and 845 tests were held
 * this way while three admissible captures sat in the registry unread. The manifest guard named
 * above is what makes the hold cost something — the entry must be written when the hold starts
 * and deleted when the suite is re-pointed.
 */
export function holdSuiteUntilInRegime(capturePath: string, mechanic: Mechanic): void {
  beforeEach((ctx: TestContext) => {
    skipUnlessInRegime(ctx, capturePath, mechanic);
  });
}
