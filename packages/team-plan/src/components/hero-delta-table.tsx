'use client';

import { useMemo } from 'react';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { Accordion, Panel, Tooltip, accordionStackClass, panelHClass, panelTitleClass } from '@bombfarm/ui';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { Lang } from '@bombfarm/hero/copy';
import type { TeamPlanScreenCopy } from '../copy';
import { buildGearFlowRows, groupGearFlowRows, removedRowsByOriginHero } from '../model/gear-flow-rows';
import { HeroDeltaRow, type HeroDeltaRoster } from './hero-delta-row';
import type { HeroGearFlow } from './hero-proposed-gear';

export function HeroDeltaTable({
  t,
  lang,
  plan,
  heroes,
  inventoryItems,
}: {
  t: TeamPlanScreenCopy;
  lang: Lang;
  plan: TeamPlan;
  heroes: readonly HeroRecord[];
  inventoryItems: readonly InventoryItem[];
}) {
  const roster: HeroDeltaRoster = useMemo(() => {
    const heroByScopeKey = new Map(heroes.map((hero) => [hero.sourceId ?? hero.id, hero]));
    const heroNameFallback = (heroId: string) =>
      plan.perHero.find((row) => row.heroId === heroId)?.heroName ?? heroId;
    return { heroByScopeKey, heroNameFallback };
  }, [heroes, plan]);

  const gearByHeroId = useMemo(() => {
    const flowRows = buildGearFlowRows(plan, [...inventoryItems]);
    const flowGroups = groupGearFlowRows(
      flowRows,
      plan.perHero.map((row) => row.heroId),
    );
    const flowRowsByHero = new Map(
      flowGroups.filter((group) => group.heroId).map((group) => [group.heroId as string, group.rows]),
    );
    const removedRowsByHero = removedRowsByOriginHero(flowGroups);
    const crowdedField = plan.regime === 'saturated';

    const map = new Map<string, HeroGearFlow>();
    for (const row of plan.perHero) {
      map.set(row.heroId, {
        rows: flowRowsByHero.get(row.heroId) ?? [],
        removed: removedRowsByHero.get(row.heroId) ?? [],
        crowdedField,
      });
    }
    return map;
  }, [plan, inventoryItems]);

  const firstHeroId = plan.perHero[0]?.heroId;
  // Remount when a new plan lands so the first row opens again after Optimize.
  const accordionKey = [
    plan.planDps,
    plan.currentDps,
    plan.run.rounds,
    plan.run.evaluations,
    plan.run.elapsedMs,
    plan.perHero.map((row) => row.heroId).join(','),
  ].join(':');

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.teamPlanHeroDeltaTitle}</h2>
      </div>
      <Tooltip.Provider delay={200} closeDelay={80}>
        <Accordion.Root
          key={accordionKey}
          multiple
          defaultValue={firstHeroId ? [firstHeroId] : []}
          className={accordionStackClass}
        >
          {plan.perHero.map((row) => (
            <HeroDeltaRow
              key={row.heroId}
              t={t}
              lang={lang}
              plan={plan}
              row={row}
              roster={roster}
              gear={gearByHeroId.get(row.heroId) ?? { rows: [], removed: [], crowdedField: false }}
            />
          ))}
        </Accordion.Root>
      </Tooltip.Provider>
    </Panel>
  );
}
