import { computeTeamBuffsOverRotation, type TeamBuffId } from '../team-buffs';
import type { HeroPlanContext } from './types';

/**
 * Which of the plan's heroes are on the rotation an objective prices.
 *
 * Optimize and leave-alone both farm; only donate does not. That matches the estimator's own
 * rule, which drops a hero the game will not field (`battleAllowed === false`) — the very
 * condition the plan turns into a default donate scope. An explicit Donate says the player is
 * stripping the hero for parts, so it leaves the rotation too.
 */
export function isSquadScope(scope: HeroPlanContext['scope']): boolean {
  return scope === 'optimize' || scope === 'leaveAlone';
}

/**
 * The roster-wide aura total EVERY fielded hero experiences — nobody on the rotation is excluded
 * (PR #139): a carrier's own rank counts toward the total exactly like every other carrier's,
 * at that hero's own duty (from the previous fixed-point round). A hero the player leaves alone
 * still stands on the field, so its aura counts too, at the duty its untouched build sustains;
 * only a donated hero, which the game will not field, is out. Because the result does not depend
 * on which hero is asking, callers compute it ONCE per round — `evaluateRoster` does exactly that.
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
    isSquadScope(ctx.scope) ? (dutyByHeroId[ctx.heroId] ?? 0) : 0,
  );
  return computeTeamBuffsOverRotation(contexts, presence);
}
