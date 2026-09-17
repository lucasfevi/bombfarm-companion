import {
  priceSkillTree,
  totalsFromLevels,
  type SkillTotals,
  type SkillTreePricing,
  type SkillTreeState,
} from '@bombfarm/domain/skill-tree';
import { buildAccount, farmDepsEqual, resolveEnabledHeroIds } from '@bombfarm/farm/core';
import type { PlannerStore } from '@/shared/stores/planner-store';
import { farmInputsOf, readFarmDepTuple } from '@/shared/stores/selectors/farm-ranking-selectors';

export function skillsTotalsOf(state: SkillTreeState): SkillTotals {
  return state.totals ?? totalsFromLevels(state);
}

let pricingStamp = 0;
let lastPricingIdentity: {
  deps: readonly unknown[];
  levels: Readonly<Record<string, number>>;
  phase: number;
  maxPhase: number | null;
  fieldSlots: number | null;
} | null = null;

export function skillsPricingKey(store: PlannerStore): string | null {
  const stored = store.skillTree;
  if (stored == null || store.phase === null) return null;
  const deps = readFarmDepTuple(store);
  const levels = stored.levels;
  const { phase, maxPhase, fieldSlots } = store;
  if (
    lastPricingIdentity !== null &&
    lastPricingIdentity.phase === phase &&
    lastPricingIdentity.maxPhase === maxPhase &&
    lastPricingIdentity.fieldSlots === fieldSlots &&
    lastPricingIdentity.levels === levels &&
    farmDepsEqual(lastPricingIdentity.deps, deps)
  ) {
    return String(pricingStamp);
  }
  lastPricingIdentity = { deps, levels, phase, maxPhase, fieldSlots };
  pricingStamp += 1;
  return String(pricingStamp);
}

export function priceSkillsView(
  store: PlannerStore,
  state: SkillTreeState,
  totals: SkillTotals,
  phase: number,
): SkillTreePricing {
  const inputs = farmInputsOf(store);
  return priceSkillTree({
    heroes: inputs.heroes,
    account: buildAccount(inputs),
    enabledHeroIds: resolveEnabledHeroIds(inputs),
    returnBonus: inputs.farmReturnBonus,
    phase,
    totals,
    state,
  });
}
