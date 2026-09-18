import type { TreeSheetTotals } from '../birth-sheet';
import type { TreeState } from '../shims/storage';
import { SKILL_TREE, type SkillEffectKind, type SkillNode, type SkillTreeCatalog } from './catalog';
import { effectiveLevel } from './rules';
import type { SkillTotals, SkillTotalsKey, SkillTreeState } from './state';

export type TotalsComposition = 'additive' | 'geometric';

export type EffectTotalBinding = {
  readonly key: SkillTotalsKey;
  readonly composition: TotalsComposition;
  /** What the key reads with nothing bought: 0 for the `*_add` keys, 1 for the multipliers. */
  readonly base: 0 | 1;
};

/**
 * Effect kind → the totals key its levels build. Every row reproduces the server's own total
 * from the owned levels to machine precision on three accounts; `dmg_static` is not built by any
 * kind — it is the product `(1 + team_dmg_add) × geo_mult`, see {@link withDerivedTotals}.
 */
export const EFFECT_TOTAL_BINDINGS: Readonly<Record<SkillEffectKind, EffectTotalBinding>> = {
  team_dmg: { key: 'team_dmg_add', composition: 'additive', base: 0 },
  team_geo: { key: 'geo_mult', composition: 'geometric', base: 1 },
  g_crit_chance: { key: 'crit_chance_add', composition: 'additive', base: 0 },
  g_crit_dmg: { key: 'crit_dmg_add', composition: 'additive', base: 0 },
  g_speed: { key: 'speed_add', composition: 'additive', base: 0 },
  team_energia: { key: 'energia_add', composition: 'additive', base: 0 },
  team_coin: { key: 'coin_add', composition: 'additive', base: 0 },
  g_luck: { key: 'luck_add', composition: 'additive', base: 0 },
  team_xp: { key: 'xp_mult', composition: 'additive', base: 1 },
  vagas_campo: { key: 'vagas_campo', composition: 'additive', base: 0 },
  bag_tab: { key: 'bag_tabs_bonus', composition: 'additive', base: 0 },
};

export const EMPTY_SKILL_TOTALS: SkillTotals = {
  team_dmg_add: 0,
  crit_chance_add: 0,
  crit_dmg_add: 0,
  speed_add: 0,
  coin_add: 0,
  luck_add: 0,
  energia_add: 0,
  xp_mult: 1,
  geo_mult: 1,
  dmg_static: 1,
  vagas_campo: 0,
  bag_tabs_bonus: 0,
};

function withDerivedTotals(totals: Record<SkillTotalsKey, number>): SkillTotals {
  return { ...totals, dmg_static: (1 + totals.team_dmg_add) * totals.geo_mult };
}

/** `levels` more levels of `node` folded into `totals`. */
export function totalsWithNode(totals: SkillTotals, node: SkillNode, levels = 1): SkillTotals {
  const next: Record<SkillTotalsKey, number> = { ...totals };
  for (const effect of node.effects) {
    const binding = EFFECT_TOTAL_BINDINGS[effect.kind];
    if (binding.composition === 'geometric') {
      next[binding.key] *= (1 + effect.perLevel) ** levels;
    } else {
      next[binding.key] += effect.perLevel * levels;
    }
  }
  return withDerivedTotals(next);
}

/** The totals the owned levels add up to — the server's `totals`, rebuilt from the catalog. */
export function totalsFromLevels(state: SkillTreeState, catalog: SkillTreeCatalog = SKILL_TREE): SkillTotals {
  let totals = EMPTY_SKILL_TOTALS;
  for (const node of catalog.nodes) {
    const level = effectiveLevel(node, state);
    if (level > 0) totals = totalsWithNode(totals, node, level);
  }
  return totals;
}

export function fieldSlotsFromTotals(totals: SkillTotals, catalog: SkillTreeCatalog = SKILL_TREE): number {
  return catalog.fieldBaseSlots + totals.vagas_campo;
}

export function treeSheetFromTotals(totals: SkillTotals): TreeSheetTotals {
  return {
    danoStatic: totals.dmg_static,
    energyPct: totals.energia_add * 100,
    speedPct: totals.speed_add * 100,
    critChancePct: totals.crit_chance_add * 100,
    critDmgPct: totals.crit_dmg_add * 100,
    luckFlatPct: totals.luck_add * 100,
  };
}

export function treeStateFromTotals(totals: SkillTotals): TreeState {
  return {
    danoTotal: totals.dmg_static,
    critChance: totals.crit_chance_add * 100,
    critDmg: totals.crit_dmg_add * 100,
    speed: totals.speed_add * 100,
    energy: totals.energia_add * 100,
    teamCoinPct: totals.coin_add * 100,
    luckFlatPct: totals.luck_add * 100,
    xpMult: totals.xp_mult,
  };
}
