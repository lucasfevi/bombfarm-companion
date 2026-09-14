import { formatItemRosterTooltip } from '@bombfarm/domain/game-labels';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { FARM_RESPEC_WORTH_MAKING_PCT } from '@bombfarm/farm/core';
import { formatCompactNumber } from '@bombfarm/ui';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import type { HeroRecord } from '@/shared/lib/storage';

export type PlanActionRow = {
  kind: 'move' | 'equip' | 'forge' | 'reset';
  text: string;
  contribution: string | null;
};

export type PlanActions = { rows: PlanActionRow[]; moves: number; resets: number };

function itemNamer(inventory: readonly InventoryItem[], strings: Strings, lang: Lang) {
  const byId = new Map(inventory.map((item) => [item.id, item]));
  return (itemId: string, defId: string): string => {
    const item = byId.get(itemId);
    if (item == null) return defId;
    return formatItemRosterTooltip({ ...item, upgrade: 0 }, lang, strings.rankLv).title;
  };
}

function heroNamer(heroes: readonly HeroRecord[]) {
  const byPlanId = new Map(heroes.map((hero) => [hero.sourceId ?? hero.id, hero.name]));
  return (heroId: string): string => byPlanId.get(heroId) ?? heroId;
}

function signedCompact(value: number, lang: Lang): string {
  const compact = formatCompactNumber(value, lang, 1);
  return value >= 0 ? `+${compact}` : compact;
}

export function planActions(
  plan: TeamPlan,
  inventory: readonly InventoryItem[],
  heroes: readonly HeroRecord[],
  strings: Strings,
  lang: Lang,
): PlanActions {
  const itemName = itemNamer(inventory, strings, lang);
  const heroName = heroNamer(heroes);
  const equips = plan.moveList.filter((action) => action.phase === 'equip');

  const rows: PlanActionRow[] = [
    ...equips.map((action): PlanActionRow => {
      const vars = { item: itemName(action.itemId, action.defId), hero: heroName(action.toHeroId ?? '') };
      return action.fromHeroId != null
        ? { kind: 'move', text: sub(strings.homeCardOptimizerActionMove, vars), contribution: null }
        : { kind: 'equip', text: sub(strings.homeCardOptimizerActionEquip, vars), contribution: null };
    }),
    ...plan.forgeList.map(
      (action): PlanActionRow => ({
        kind: 'forge',
        text: sub(strings.homeCardOptimizerActionForge, {
          item: itemName(action.itemId, action.defId),
          from: action.from,
          to: action.to,
        }),
        contribution: null,
      }),
    ),
    ...plan.pointResets.map(
      (action): PlanActionRow => ({
        kind: 'reset',
        text: sub(strings.homeCardOptimizerActionReset, { hero: heroName(action.heroId) }),
        contribution: signedCompact(action.rosterGainObjective, lang),
      }),
    ),
  ];

  const moves = new Set([...plan.moveList, ...plan.forgeList].map((action) => action.itemId)).size;
  return { rows, moves, resets: plan.pointResets.length };
}

export function gainPct(plan: TeamPlan): number {
  return plan.currentDps > 0 ? ((plan.planDps - plan.currentDps) / plan.currentDps) * 100 : 0;
}

export function belowFloor(plan: TeamPlan): boolean {
  return gainPct(plan) < FARM_RESPEC_WORTH_MAKING_PCT;
}
