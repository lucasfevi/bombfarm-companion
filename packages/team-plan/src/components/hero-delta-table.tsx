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

/**
 * Which rows are open is the host's state, not this table's: the desktop unmounts the screen on
 * every tab change and the web on every route change, and a row the player opened to read must
 * still be open when they come back. `null` is the default set — the first hero — which both
 * hosts restore whenever a new plan lands.
 */
export function HeroDeltaTable({
  t,
  lang,
  plan,
  heroes,
  inventoryItems,
  openHeroIds,
  onOpenHeroIdsChange,
}: {
  t: TeamPlanScreenCopy;
  lang: Lang;
  plan: TeamPlan;
  heroes: readonly HeroRecord[];
  inventoryItems: readonly InventoryItem[];
  openHeroIds: readonly string[] | null;
  onOpenHeroIdsChange: (heroIds: readonly string[]) => void;
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
  const openValue = useMemo(
    () => (openHeroIds === null ? (firstHeroId === undefined ? [] : [firstHeroId]) : [...openHeroIds]),
    [openHeroIds, firstHeroId],
  );

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.teamPlanHeroDeltaTitle}</h2>
      </div>
      <Tooltip.Provider delay={200} closeDelay={80}>
        <Accordion.Root multiple value={openValue} onValueChange={onOpenHeroIdsChange} className={accordionStackClass}>
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
