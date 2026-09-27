'use client';

import { useMemo } from 'react';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { Accordion, Icon, Panel, Select, Tooltip, accordionStackClass, panelHClass, panelTitleClass } from '@bombfarm/ui';
import { inventorySortDirectionClass, inventorySortGroupClass, inventorySortSelectClass } from '@bombfarm/game-art';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { Lang } from '@bombfarm/hero/copy';
import type { TeamPlanScreenCopy } from '../copy';
import { buildGearFlowRows, groupGearFlowRows, removedRowsByOriginHero } from '../model/gear-flow-rows';
import {
  TEAM_PLAN_RESULT_SORT_KEYS,
  firstResultSortDirection,
  sortTeamPlanResultRows,
  type TeamPlanResultSort,
  type TeamPlanResultSortKey,
} from '../model/result-order';
import { HeroDeltaRow, type HeroDeltaRoster } from './hero-delta-row';
import type { ForgeQueueAction } from './hero-forge-queue';
import type { HeroGearFlow } from './hero-proposed-gear';

/** Exhaustive by construction: a new sort key is a compile error here, not a blank option. */
const SORT_KEY_LABEL = {
  name: 'teamPlanResultSortName',
  delta: 'teamPlanResultSortDelta',
  deltaPct: 'teamPlanResultSortDeltaPct',
  after: 'teamPlanResultSortAfter',
  before: 'teamPlanResultSortBefore',
  level: 'teamPlanResultSortLevel',
} as const satisfies Record<TeamPlanResultSortKey, keyof TeamPlanScreenCopy>;

/**
 * Which rows are open, and the order they are in, are the host's state, not this table's: the desktop unmounts the screen on
 * every tab change and the web on every route change, and a row the player opened to read must
 * still be open, in the order they chose, when they come back. `null` is the default set — the first hero — which both
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
  sort,
  onSortChange,
  forgeQueueAction,
}: {
  t: TeamPlanScreenCopy;
  lang: Lang;
  plan: TeamPlan;
  heroes: readonly HeroRecord[];
  inventoryItems: readonly InventoryItem[];
  openHeroIds: readonly string[] | null;
  onOpenHeroIdsChange: (heroIds: readonly string[]) => void;
  sort: TeamPlanResultSort;
  onSortChange: (next: TeamPlanResultSort) => void;
  forgeQueueAction: ForgeQueueAction | undefined;
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

  const rows = useMemo(() => sortTeamPlanResultRows(plan.perHero, sort), [plan.perHero, sort]);

  const firstHeroId = rows[0]?.heroId;
  const openValue = useMemo(
    () => (openHeroIds === null ? (firstHeroId === undefined ? [] : [firstHeroId]) : [...openHeroIds]),
    [openHeroIds, firstHeroId],
  );

  return (
    <Panel>
      <Tooltip.Provider delay={200} closeDelay={80}>
        <div className={panelHClass}>
          <h2 className={panelTitleClass}>{t.teamPlanHeroDeltaTitle}</h2>
          <ResultSortControl t={t} sort={sort} onSortChange={onSortChange} />
        </div>
        <Accordion.Root multiple value={openValue} onValueChange={onOpenHeroIdsChange} className={accordionStackClass}>
          {rows.map((row) => (
            <HeroDeltaRow
              key={row.heroId}
              t={t}
              lang={lang}
              plan={plan}
              row={row}
              roster={roster}
              gear={gearByHeroId.get(row.heroId) ?? { rows: [], removed: [], crowdedField: false }}
              forgeQueueAction={forgeQueueAction}
            />
          ))}
        </Accordion.Root>
      </Tooltip.Provider>
    </Panel>
  );
}

/** The Inventory's own sort pair — a key and a direction sharing one outline — as the Heroes
 *  roster uses it, so ordering a list of heroes looks the same wherever it happens. */
function ResultSortControl({
  t,
  sort,
  onSortChange,
}: {
  t: TeamPlanScreenCopy;
  sort: TeamPlanResultSort;
  onSortChange: (next: TeamPlanResultSort) => void;
}) {
  const ascending = sort.direction === 'asc';
  const directionLabel = ascending ? t.teamPlanResultSortAscending : t.teamPlanResultSortDescending;
  return (
    <span className={inventorySortGroupClass} data-testid="team-plan-result-sort">
      <Select
        size="compact"
        value={sort.key}
        onChange={(event) => {
          const key = event.target.value as TeamPlanResultSortKey;
          onSortChange({ key, direction: firstResultSortDirection(key) });
        }}
        aria-label={t.teamPlanResultSortLabel}
        className={inventorySortSelectClass}
      >
        {TEAM_PLAN_RESULT_SORT_KEYS.map((key) => (
          <option key={key} value={key}>
            {t[SORT_KEY_LABEL[key]]}
          </option>
        ))}
      </Select>
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          onClick={() => {
            onSortChange({ ...sort, direction: ascending ? 'desc' : 'asc' });
          }}
          aria-label={directionLabel}
          className={inventorySortDirectionClass}
        >
          <Icon name={ascending ? 'sort-ascending' : 'sort-descending'} size="sm" />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup>
              <p className="m-0 text-xs text-ink">{directionLabel}</p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </span>
  );
}
