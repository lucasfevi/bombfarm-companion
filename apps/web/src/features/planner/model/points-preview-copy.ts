import type { ReoptResult } from '@bombfarm/domain/points-reopt';
import type { Strings } from '@/shared/i18n';
import type { ReactNode } from 'react';
import { renderTemplateWithPct } from './render-template-with-pct';

/**
 * `1e-9` mirrors `points-reopt-search.ts`'s own `EPS` — the same floating-point floor the
 * search itself uses to decide "strictly improving".
 */
const GAIN_EPS = 1e-9;

export type OptimizeResultDisplay =
  | { kind: 'kept'; text: string }
  | { kind: 'delta'; node: ReactNode; tone: 'up' };

/**
 * `AC-13` — selects the Tier 2 result line, branching on `gainPct`, deliberately NOT on
 * `ReoptResult.keptCurrent`.
 *
 * `keptCurrent` is `winner.name === 'current'` (`points-reopt.ts`) — which seed LINEAGE won,
 * not whether the returned vector equals the player's own. Every seed (including `'current'`)
 * gets its own best-improvement local search chained on top before the seeds are compared, so
 * a `'current'`-seeded lineage can still return a vector — and a `gainPct` — far from the
 * input: verified directly against `optimizeBuild` with a deliberately bad single-stat dump
 * (`pts.cdr = level`), which returns `keptCurrent: true` alongside a **251%** `gainPct`. Tier
 * 1's `findGateCandidate` has no local search, so its own `keptCurrent` genuinely does mean
 * "the winning vector is the unmodified input" — the two tiers' fields are not equivalent,
 * which is exactly why this function reads `gainPct` (the one number both tiers define the
 * same way: `(winner.score / s1Score − 1) × 100`, floored at 0) instead.
 */
export function optimizeResultDisplay(
  strings: Strings,
  result: Pick<ReoptResult, 'gainPct'>,
  formatNumber: (n: number, d?: number) => string,
): OptimizeResultDisplay {
  if (result.gainPct <= GAIN_EPS) {
    return { kind: 'kept', text: strings.optimizeBuildKeptCurrent };
  }
  return {
    kind: 'delta',
    tone: 'up',
    node: renderTemplateWithPct(strings.optimizeBuildResultLine, formatNumber(result.gainPct, 1)),
  };
}

/** Apply is a no-op when the search found no measurable gain (spec edge case) — writing an
 *  equally-scoring reshuffle would force an unwanted respec note for zero player benefit. */
export function hasApplicableGain(result: Pick<ReoptResult, 'gainPct'>): boolean {
  return result.gainPct > GAIN_EPS;
}
