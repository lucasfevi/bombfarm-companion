import { computeTeamBuffsOverRotation, type TeamBuffId } from '../team-buffs';
import type { HeroPlanContext } from './types';

/**
 * The roster-wide aura total EVERY optimize-scope hero experiences — nobody is excluded (issue
 * #132): a hero's own rank counts toward the total exactly like every other carrier's, at that
 * hero's own duty (from the previous fixed-point round). Because the result does not depend on
 * which hero is asking, callers compute it ONCE per round — `evaluateRoster` does exactly that.
 *
 * A duty-map adapter over `computeTeamBuffsOverRotation`, so the damage objective prices auras
 * in the same form as the gold objective and the Farm board: the expected value of the CAPPED
 * sum over independently present carriers. Summing rank × duty and clamping afterwards, which
 * this did before, asserted that two part-time carriers of one capped aura keep it at the cap
 * the whole time — true of a staggered rotation, not of a hand-played one.
 */
export function computeRosterAuras(
  contexts: HeroPlanContext[],
  dutyByHeroId: Record<string, number>,
): Record<TeamBuffId, number> {
  const presence = contexts.map((ctx) =>
    ctx.scope === 'optimize' ? (dutyByHeroId[ctx.heroId] ?? 0) : 0,
  );
  return computeTeamBuffsOverRotation(contexts, presence);
}
