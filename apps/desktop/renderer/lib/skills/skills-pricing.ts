/**
 * The Skill Tree screen's pricing, over the same inputs the Farm board prices from — so a node's
 * worth agrees with the board beside it. Pure, no React import.
 */
import { canonicalStringify } from '@bombfarm/contracts';
import {
  priceSkillTree,
  totalsFromLevels,
  type SkillCombatWindow,
  type SkillTotals,
  type SkillTreePricing,
  type SkillTreeState,
} from '@bombfarm/domain/skill-tree';
import { buildAccount, gateCombatWindow, resolveEnabledHeroIds, type FarmInputs } from '@bombfarm/farm/core';
import { farmBoardDepKey } from '../farm/farm-inputs';

/** The tree's totals as the server reports them, or rebuilt from the levels when it sent none. */
export function skillsTotalsOf(state: SkillTreeState): SkillTotals {
  return state.totals ?? totalsFromLevels(state);
}

/**
 * A value identity for everything the pricing recomputes from. The account view is re-read every
 * few seconds and re-allocated on every read, so the identity is by value — and, like the farm
 * board's own key, blind to the capture time each read stamps on every hero.
 */
export function skillsPricingKey(
  inputs: FarmInputs,
  state: SkillTreeState,
  phase: number,
  windows: { readonly gatePhase: number; readonly pvp: SkillCombatWindow | null },
): string {
  return canonicalStringify([farmBoardDepKey(inputs), state.levels, phase, windows]);
}

export function priceSkillsView(
  inputs: FarmInputs,
  state: SkillTreeState,
  totals: SkillTotals,
  phase: number,
  gatePhase: number,
  pvp: SkillCombatWindow | null,
): SkillTreePricing {
  return priceSkillTree({
    heroes: inputs.heroes,
    account: buildAccount(inputs),
    enabledHeroIds: resolveEnabledHeroIds(inputs),
    returnBonus: inputs.farmReturnBonus,
    phase,
    totals,
    state,
    gate: gateCombatWindow(inputs, gatePhase),
    pvp,
  });
}
