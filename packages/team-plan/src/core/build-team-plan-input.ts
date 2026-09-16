import type { TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import type { TeamPlanInputs } from './team-plan-inputs';
import type { TeamPlanControls } from './team-plan-controls';
import { resolveHeroScope } from './hero-scope';
import { resolveTeamPlanTargetPhase } from './plan-lifecycle';

export function buildTeamPlanInput(
  inputs: TeamPlanInputs,
  controls: TeamPlanControls,
): TeamPlanInput {
  const treeSheet = {
    danoStatic: inputs.treeDanoTotal,
    energyPct: inputs.treeEnergy,
    speedPct: inputs.treeSpeed,
    critChancePct: inputs.treeCritChance,
    critDmgPct: inputs.treeCritDmg,
    luckFlatPct: inputs.treeLuckFlatPct,
  };

  const heroes = inputs.heroes.map((hero) => ({
    heroId: hero.sourceId ?? hero.id,
    name: hero.name,
    level: hero.level,
    stars: hero.stars,
    rarity: hero.rarity,
    ...(hero.birth !== undefined ? { birth: hero.birth } : {}),
    abilities: hero.abilities,
    pts: hero.pts,
    loadout: hero.loadout,
    ...(hero.battleAllowed !== undefined ? { battleAllowed: hero.battleAllowed } : {}),
    runes: hero.runes,
  }));

  return {
    heroes,
    inventory: inputs.inventory.items,
    account: {
      treeSheet,
      houseIdx: inputs.houseIdx,
      houseLevel: inputs.houseLevel,
      phase: inputs.phase,
      mitigationPct: inputs.mitigationPct,
      slots: inputs.slots,
      // FIELD concurrency cap, not the House recovery number above — `inputs.slots` is a
      // pre-`skills.field_slots` fallback only, not a synonym for it.
      fieldSlots: inputs.fieldSlots ?? inputs.slots,
      // The scorer's duty cycle divides by this — the save's own House cycle when it carried
      // one, else the `HOUSES` table.
      cycleSecs: inputs.houseCycleSecs,
      // The (house, level) `cycleSecs` above is anchored to.
      cycleSecsHouseIdx: inputs.houseCycleSecsHouseIdx,
      cycleSecsLevel: inputs.houseCycleSecsLevel,
      // Read by the farm objective only, and it refuses to plan without `maxPhase` — supplied
      // here so a caller switching a plan to gold cannot silently get the 600-phase ceiling.
      teamCoinPct: inputs.treeTeamCoinPct,
      xpMult: inputs.treeXpMult,
      maxPhase: inputs.maxPhase,
    },
    // Must match the scope board: missing keys use battleAllowed defaults (Donate when
    // disabled), never a hard-coded Optimize — that silently scored Donate-looking heroes.
    scopeByHeroId: Object.fromEntries(
      inputs.heroes.map((hero) => {
        const key = hero.sourceId ?? hero.id;
        return [key, resolveHeroScope(hero, controls.scopeByHeroId)];
      }),
    ),
    forgeFloor: controls.forgeFloor,
    objective: controls.objective,
    // Which kinds of change the plan may propose. The domain drops the forge floor above to 0 by
    // itself when gear is off the table, so this field alone decides it — the controls' stored
    // floor is never suppressed here.
    allowedChanges: controls.allowedChanges,
    // Both objectives drop their field-crowding term under this, and the plan fills every empty
    // slot it has an item for — see the domain field for why that is an opt-in mis-pricing.
    ignoreFieldCrowding: controls.ignoreFieldCrowding,
    // Both objectives hold these auras at their cap under this — the same opt-in shape.
    aurasAtCap: controls.aurasAtCap,
    // Both objectives score here. Null is the objective's own default: gold sweeps for its best
    // phase, damage stays on the account's own.
    targetPhase: resolveTeamPlanTargetPhase(inputs, controls),
  };
}
