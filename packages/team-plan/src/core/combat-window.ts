import { PVP_SQUAD_SLOTS, PVP_WINDOW_SECS, gateWindowSecs, resolveGatePhase } from '@bombfarm/domain/combat-window';
import { resolveHeroScope } from './hero-scope';
import type { TeamPlanControls } from './team-plan-controls';
import type { TeamPlanInputs } from './team-plan-inputs';

/** The gate a Gate clear plan fights: the player's pick while it names a gate, else the account's
 *  next one. */
export function resolveTeamPlanGatePhase(
  inputs: Pick<TeamPlanInputs, 'phase'>,
  controls: Pick<TeamPlanControls, 'gatePhase'>,
): number {
  return resolveGatePhase(controls.gatePhase, inputs.phase ?? 1);
}

export function teamPlanGateWindowSecs(
  inputs: Pick<TeamPlanInputs, 'phase'>,
  controls: Pick<TeamPlanControls, 'gatePhase'>,
): number {
  return gateWindowSecs(resolveTeamPlanGatePhase(inputs, controls));
}

export { PVP_SQUAD_SLOTS, PVP_WINDOW_SECS };

/**
 * The squad a duel plan fields: every hero the scope board keeps on the field — Optimize and
 * Leave alone alike, since both fight — which is the player's pick of the duel squad. A donor is
 * out of the room.
 */
export function countPvpSquadHeroes(
  inputs: Pick<TeamPlanInputs, 'heroes'>,
  controls: Pick<TeamPlanControls, 'scopeByHeroId'>,
): number {
  return inputs.heroes.filter((hero) => resolveHeroScope(hero, controls.scopeByHeroId) !== 'donate').length;
}

/** How many heroes over the room's nine seats the scope board fields — zero when it fits. */
export function pvpSquadExcess(
  inputs: Pick<TeamPlanInputs, 'heroes'>,
  controls: Pick<TeamPlanControls, 'scopeByHeroId'>,
): number {
  return Math.max(0, countPvpSquadHeroes(inputs, controls) - PVP_SQUAD_SLOTS);
}
