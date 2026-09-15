/**
 * The one judgement the Heroes screen's reference panels need, kept out of JSX so it is proved
 * rather than eyeballed.
 *
 * It exists because this screen is READ-ONLY and composes no rotation pool. It draws the account
 * the shared seam already holds and changes nothing: no stepper, no optimise button, no slot
 * editor, no control that touches either loadout. That is expressed by supplying none of the
 * panels' optional editing callbacks, and the panels' own readings turn every such control off.
 */
import type { PointValue, RankMode } from '@bombfarm/domain/model';
import type { NextPointRankingInput } from '@bombfarm/hero/components';

/**
 * What the next-point panel is handed. The ranking itself is an input — the rows come straight off
 * the hero's own pipeline run, and nothing is computed here or read from a store.
 *
 * Farm mode is scored against a rotation pool the host has to compose: its enabled set, its live
 * draft, its max phase. This screen composes none, so the farm answer is not "no rows" — an empty
 * ranking would read as "nothing is worth a point" — but the damage ranking plus the outcome that
 * says why farming could not be answered. `emptyPool` is the literal truth here, and the panel
 * turns it into the note that names it.
 */
export function heroNextPointRanking(
  rankMode: RankMode,
  ranking: readonly PointValue[],
): NextPointRankingInput {
  return {
    rows: ranking,
    fallback: rankMode === 'farm' ? 'emptyPool' : null,
    addedToPool: false,
  };
}
