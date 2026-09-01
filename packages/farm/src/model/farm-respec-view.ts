/**
 * Pure view model for the Farm Respec Advisor — PURE, no React. Everything here decides what to
 * render without knowing how; every branching decision the panel needs lives here so the
 * components have none of their own to get wrong.
 *
 * Zero rate arithmetic, and zero point arithmetic too — the shared `DeltaTable` ledger primitive
 * now derives the per-key change from `current`/`target` itself, so this file no longer computes
 * a delta of its own. Every field below is the solver's own field, read and passed through.
 */
import { SHEET_PANEL_KEYS, type SheetKey } from '@bombfarm/domain/planner-constants';
// Type-only imports erase at compile time — this file never becomes a runtime importer of
// @bombfarm/domain/farm-optimize.
import type {
  FarmRespecFrontierEntry,
  FarmRespecHeroEntry,
  FarmRespecOutcome,
  FarmRespecResult,
} from '@bombfarm/domain/farm-optimize';

/**
 * The on-demand result, keyed by the EXACT dependency tuple that produced it — the staleness key
 * AND the memo key, compared element-wise by whichever store holds it. Plain data with no store
 * library in it, so it is declared here, beside the only code that reads it, and the host app's
 * store re-exports it rather than owning it.
 */
export type FarmRespecProposal = {
  deps: readonly unknown[];
  result: FarmRespecResult;
};

export type FarmRespecStatus = 'idle' | 'solving' | 'done' | 'failed';

export type FarmRespecKeyRow = {
  key: SheetKey;
  current: number;
  target: number;
  keep: boolean;
};

/**
 * All eight keys, in `SHEET_PANEL_KEYS` order. `target` is the ABSOLUTE value to set after the
 * respec — a respec refunds every point, so a diff alone is not executable at the moment the
 * player needs it. The change column the player uses to judge whether a move is worth performing
 * (the game does not display per-stat spent points) is `DeltaTable`'s own `target - current`, not
 * a field this file carries. Luck's `keep` is true for every input — the solver freezes it, so that
 * subtraction naturally yields 0 there too.
 */
export function buildHeroCardRows(entry: FarmRespecHeroEntry): FarmRespecKeyRow[] {
  return SHEET_PANEL_KEYS.map((key) => ({
    key,
    current: entry.currentPts[key],
    target: entry.proposedPts[key],
    keep: key === 'luck',
  }));
}

export type FarmRespecHeroGroups = {
  changed: readonly FarmRespecHeroEntry[];
  unchanged: readonly FarmRespecHeroEntry[];
};

/**
 * The hero cards split into the ones the player has to act on and the ones they do not, in
 * `result.heroes`' own order within each group.
 *
 * A PARTITION, never a filter: every entry lands in exactly one group and the two lengths always
 * sum to the input's, so an unchanged hero is still always rendered — just grouped after the
 * changed ones instead of interleaved between them, where its two short lines left a full-height
 * hole in the grid.
 */
export function partitionHeroEntries(result: FarmRespecResult): FarmRespecHeroGroups {
  const changed: FarmRespecHeroEntry[] = [];
  const unchanged: FarmRespecHeroEntry[] = [];
  for (const entry of result.heroes) (entry.changed ? changed : unchanged).push(entry);
  return { changed, unchanged };
}

export type FarmRespecPaybackKind = 'hours' | 'no-change';

/**
 * Exactly one of two kinds — never a third branch, never a fallback glyph.
 *
 * A third kind used to cover "the proposed build earns LESS gold than today", reachable only
 * under the chests objective. The optimizer is gold-only now, and the search always compares the
 * current build as one of its own candidates, so the winner's gold can never come in under it:
 * a null `paybackHours` means the two are EQUAL, and nothing else.
 */
export function resolvePaybackKind(result: FarmRespecResult): FarmRespecPaybackKind {
  return result.paybackHours != null ? 'hours' : 'no-change';
}

const TERMINAL_OUTCOMES: readonly FarmRespecOutcome[] = [
  'emptyPool',
  'allDegenerate',
  'noBudget',
  'noFeasiblePhase',
];

export type FarmRespecPanelState =
  | { kind: 'solving' }
  | { kind: 'failed' }
  | { kind: 'terminal'; outcome: FarmRespecOutcome }
  | { kind: 'result'; result: FarmRespecResult; budgetExhausted: boolean };

/**
 * Every branch the panel can be in, collapsed into one discriminated value so the component has
 * no `if`/`switch` of its own over `status`/`outcome`. The four terminal outcomes are unreachable
 * behind the Tier 1 gate in normal play (each carries `gainPct: 0`) but render a single named
 * state rather than a blank panel if the seam is ever reached anyway.
 */
export function resolvePanelState(
  view: FarmRespecProposal | null,
  status: FarmRespecStatus,
): FarmRespecPanelState {
  if (status === 'solving') return { kind: 'solving' };
  if (status === 'failed') return { kind: 'failed' };
  if (view == null) {
    // Unreachable through the panel's own mount gate (it only renders resolvePanelState's
    // result when a view exists or status is solving/failed) — kept total rather than partial.
    return { kind: 'solving' };
  }
  const { result } = view;
  if (TERMINAL_OUTCOMES.includes(result.outcome)) {
    return { kind: 'terminal', outcome: result.outcome };
  }
  return { kind: 'result', result, budgetExhausted: result.budgetExhausted };
}

export type FarmRespecPhaseChange =
  | { kind: 'both-null' }
  | { kind: 'same'; phase: number }
  | { kind: 'moved'; currentPhase: number | null; recommendedPhase: number | null };

/**
 * Whether the Phase tile has one label to show or two. `currentPhase`/`recommendedPhase` are
 * independently nullable (the solver returns null when nothing is feasible on that side), so `'moved'`
 * covers every combination of one side null and the other not, not just a genuine two-sided move.
 * `'same'` fires only when BOTH sides are the identical non-null phase — the no-op proposal that
 * would otherwise print `Normal 1-1 (#51) -> Normal 1-1 (#51)`.
 */
export function resolvePhaseChange(result: FarmRespecResult): FarmRespecPhaseChange {
  const { currentPhase, recommendedPhase } = result;
  if (currentPhase == null && recommendedPhase == null) return { kind: 'both-null' };
  if (currentPhase != null && currentPhase === recommendedPhase) {
    return { kind: 'same', phase: currentPhase };
  }
  return { kind: 'moved', currentPhase, recommendedPhase };
}

/**
 * Passes `result.frontier` through UNCHANGED — the solver guarantees cost-ascending order, and this
 * file does not sort, filter or reverse it. An empty frontier (one searchable hero) yields `null`
 * — a "render nothing" signal — rather than an empty array to map over.
 */
export function resolveFrontierEntries(
  result: FarmRespecResult,
): readonly FarmRespecFrontierEntry[] | null {
  return result.frontier.length > 0 ? result.frontier : null;
}

/**
 * The heroes a frontier tier actually respecs, named. `entry.heroes` is EVERY enabled hero — a
 * tier carries a complete squad allocation, with the ones it does not touch pinned to their
 * current build — so rendering it prints the whole rotation pool under a "1 hero" label. The
 * tier's own heroes are `entry.heroIds`, which is what `heroCount` counts, so the names come
 * from there and the count can never disagree with the list.
 *
 * An id with no matching entry falls back to the id itself rather than being dropped: a silently
 * shorter list would contradict `heroCount` again, which is the bug this exists to fix.
 */
export function resolveFrontierHeroNames(entry: FarmRespecFrontierEntry): string[] {
  return entry.heroIds.map(
    (heroId) => entry.heroes.find((hero) => hero.heroId === heroId)?.heroName ?? heroId,
  );
}
