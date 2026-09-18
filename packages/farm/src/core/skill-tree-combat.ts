import {
  fieldSlotsForSkillTree,
  gateWindowSecs,
  PVP_WINDOW_SECS,
  skillTreeGateRosterIds,
} from '@bombfarm/domain/skill-tree';
import { buildAccount, computeFarmTeamBuffs, resolveEnabledHeroIds } from './farm-compute';
import type { FarmInputs } from './farm-inputs';

/** The combat window the Skill Tree's gate and PVP objectives price over: how long, who, where. */
export type SkillsCombatInput = {
  readonly windowSecs: number;
  readonly heroIds: readonly string[];
  readonly phase: number | null;
};

/** A timed clear of `gatePhase` by the strongest squad the field can seat, from the Farm board's own pool. */
export function gateCombatInput(inputs: FarmInputs, gatePhase: number): SkillsCombatInput {
  const account = buildAccount(inputs);
  return {
    windowSecs: gateWindowSecs(gatePhase),
    heroIds: skillTreeGateRosterIds({
      heroes: inputs.heroes,
      account,
      enabledHeroIds: resolveEnabledHeroIds(inputs),
      phase: gatePhase,
      fieldSlots: fieldSlotsForSkillTree(account),
      teamBuffs: computeFarmTeamBuffs(inputs),
    }),
    phase: gatePhase,
  };
}

/** A PVP window with no squad — the ranking waits rather than inventing one. */
export function emptyPvpCombatInput(): SkillsCombatInput {
  return { windowSecs: PVP_WINDOW_SECS, heroIds: [], phase: null };
}
