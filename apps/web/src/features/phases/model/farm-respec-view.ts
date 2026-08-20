/**
 * Pure view model for the Farm Respec Advisor — PURE, no React. Everything here decides what to
 * render without knowing how; every branching decision the panel needs lives here so the
 * components have none of their own to get wrong.
 *
 * Zero rate arithmetic. The only arithmetic in this file is integer point subtraction
 * (`proposedPts[key] - currentPts[key]`), the one carve-out the design allows; everything else
 * is item A's own field, read and passed through.
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
import type { FarmRespecProposal, FarmRespecStatus } from '@/shared/stores/slices/phases-slice';

export type FarmRespecKeyRow = {
  key: SheetKey;
  current: number;
  target: number;
  delta: number;
  keep: boolean;
};

/**
 * All eight keys, in `SHEET_PANEL_KEYS` order. `target` is the ABSOLUTE value to set after the
 * respec — a respec refunds every point, so a diff alone is not executable at the moment the
 * player needs it. `delta` is the secondary column the player uses to judge whether a move is
 * worth performing (the game does not display per-stat spent points). Luck's `keep` is true and
 * its `delta` is 0 for every input — item A freezes it, so the one subtraction this file performs
 * naturally yields 0 there too.
 */
export function buildHeroCardRows(entry: FarmRespecHeroEntry): FarmRespecKeyRow[] {
  return SHEET_PANEL_KEYS.map((key) => ({
    key,
    current: entry.currentPts[key],
    target: entry.proposedPts[key],
    delta: entry.proposedPts[key] - entry.currentPts[key],
    keep: key === 'luck',
  }));
}

export type FarmRespecPaybackKind = 'hours' | 'no-gold-gain' | 'no-change';

/**
 * Exactly one of three kinds — never a fourth branch, never a fallback glyph. `paybackHours`
 * is `null` whenever the proposed build does not pay for itself in gold (reachable under the
 * chests objective), and the two `null` sub-cases read differently to the player: earning LESS
 * gold than today vs. earning the SAME gold as today.
 */
export function resolvePaybackKind(result: FarmRespecResult): FarmRespecPaybackKind {
  if (result.paybackHours != null) return 'hours';
  if (result.proposedGoldPerHour < result.currentGoldPerHour) return 'no-gold-gain';
  return 'no-change';
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
 * independently nullable (item A: null when nothing is feasible on that side), so `'moved'`
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
 * Passes `result.frontier` through UNCHANGED — item A guarantees cost-ascending order, and this
 * file does not sort, filter or reverse it. An empty frontier (one searchable hero) yields `null`
 * — a "render nothing" signal — rather than an empty array to map over.
 */
export function resolveFrontierEntries(
  result: FarmRespecResult,
): readonly FarmRespecFrontierEntry[] | null {
  return result.frontier.length > 0 ? result.frontier : null;
}
