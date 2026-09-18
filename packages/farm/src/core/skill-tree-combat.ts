import {
  fieldSlotsForSkillTree,
  gateWindowSecs,
  skillTreeGateRosterIds,
  type SkillCombatWindow,
} from '@bombfarm/domain/skill-tree';
import { buildAccount, computeFarmTeamBuffs, resolveEnabledHeroIds } from './farm-compute';
import type { FarmInputs } from './farm-inputs';

/** A timed clear of `gatePhase` by the strongest squad the field can seat, from the Farm board's own pool. */
export function gateCombatWindow(inputs: FarmInputs, gatePhase: number): SkillCombatWindow {
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
