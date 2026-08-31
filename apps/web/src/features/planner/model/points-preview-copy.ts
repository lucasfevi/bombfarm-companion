import type { ReoptResult } from '@bombfarm/domain/points-reopt';
import type { HeroFarmOptimizeOutcome, HeroFarmOptimizeResult } from '@bombfarm/domain/farm-hero-optimize';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import type { Strings } from '@/shared/i18n';
import type { ReactNode } from 'react';
import { renderTemplateWithPct } from './render-template-with-pct';

/**
 * `1e-9` mirrors `points-reopt-search.ts`'s own `EPS` — the same floating-point floor the
 * search itself uses to decide "strictly improving".
 */
const GAIN_EPS = 1e-9;

/**
 * A preview carries the target it was searched under, because the two targets are denominated
 * in different units — sustained DPS for one hero, gold per hour for the whole rotation — and
 * nothing downstream may present one as the other.
 */
export type PointsPreview =
  | { mode: 'dps'; pts: Record<SheetKey, number>; result: ReoptResult }
  | { mode: 'farm'; pts: Record<SheetKey, number>; result: HeroFarmOptimizeResult };

export type OptimizeResultDisplay =
  | { kind: 'kept'; text: string }
  | { kind: 'delta'; node: ReactNode; tone: 'up' };

/**
 * Selects the Tier 2 result line, branching on `gainPct`, deliberately NOT on
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

/**
 * The farm target's result line. `null` for the outcomes that produced no comparison at all —
 * those are reported by {@link farmOptimizeNotice} instead, which says why rather than printing
 * a 0% that would read as "your build is already right".
 */
export function farmOptimizeResultDisplay(
  strings: Strings,
  result: Pick<HeroFarmOptimizeResult, 'outcome' | 'gainPct'>,
  formatNumber: (n: number, d?: number) => string,
): OptimizeResultDisplay | null {
  if (result.outcome === 'nothingToGain') {
    return { kind: 'kept', text: strings.optimizeBuildFarmKeptCurrent };
  }
  if (result.outcome !== 'improved' || result.gainPct <= GAIN_EPS) return null;
  return {
    kind: 'delta',
    tone: 'up',
    node: renderTemplateWithPct(strings.optimizeBuildFarmResultLine, formatNumber(result.gainPct, 1)),
  };
}

/** The mode-dispatched result line — the one entry point the panel renders. */
export function previewResultDisplay(
  strings: Strings,
  preview: PointsPreview,
  formatNumber: (n: number, d?: number) => string,
): OptimizeResultDisplay | null {
  return preview.mode === 'dps'
    ? optimizeResultDisplay(strings, preview.result, formatNumber)
    : farmOptimizeResultDisplay(strings, preview.result, formatNumber);
}

/**
 * Why a farm search produced no comparison. `emptyPool` / `heroNotInPool` read identically to a
 * player — there is no rotation to score against — and are deliberately not distinguished, the
 * same collapse the Next point panel's own fallback note makes. `noBudget` is absent because the
 * button is already disabled with its own reason in that state.
 */
export function farmOptimizeNotice(strings: Strings, outcome: HeroFarmOptimizeOutcome): string | null {
  if (outcome === 'emptyPool' || outcome === 'heroNotInPool') return strings.optimizeBuildFarmNoPool;
  if (outcome === 'degenerate' || outcome === 'noFeasiblePhase') return strings.optimizeBuildFarmNoRate;
  return null;
}

/** Apply is a no-op when the search found no measurable gain (spec edge case) — writing an
 *  equally-scoring reshuffle would force an unwanted respec note for zero player benefit. */
export function hasApplicableGain(preview: PointsPreview): boolean {
  if (preview.mode === 'dps') return preview.result.gainPct > GAIN_EPS;
  return preview.result.outcome === 'improved' && preview.result.gainPct > GAIN_EPS;
}
