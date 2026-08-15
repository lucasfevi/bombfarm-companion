'use client';

import { useMemo, useState } from 'react';
import { Banner, EmptyState, Panel } from '@bombfarm/ui';
import type { Lang, Strings } from '@/shared/i18n';
import {
  deriveFarmPoolEntries,
  selectFarmRankingRows,
  selectFarmReturnBonus,
  selectHeroes,
  selectMaxPhase,
  selectPhasesViewPhase,
  usePlannerStore,
} from '@/shared/stores';
import {
  applyFarmFilters,
  DEFAULT_SORT,
  defaultFarmFilters,
  sortFarmRows,
  type FarmFilters,
  type FarmSortDir,
  type FarmSortKey,
} from '@/features/phases/model/farm-ranking-view';
import { FarmRankingFilters } from './farm-ranking-filters';
import { FarmRotationPool } from './farm-rotation-pool';
import { FarmReturnBonus } from './farm-return-bonus';
import { FarmRankingTable } from './farm-ranking-table';
import { FarmRespecToolbar } from './farm-respec-toolbar';

/**
 * The board — filters + rotation pool + return bonus + table, or one of the four
 * empty states. Sort/filter state is `useState` here (MOD-13 — ephemeral, not
 * persisted); the pool and return bonus are store fields read via
 * `usePlannerStore(selectFarmRankingRows)` WITHOUT `useShallow` (the `selectAdvisorPipeline`
 * carve-out — shallow-comparing 600 rows on every write would defeat the memo).
 */
export function FarmRankingBoard({ t, lang }: { t: Strings; lang: Lang }) {
  const result = usePlannerStore(selectFarmRankingRows);
  const heroes = usePlannerStore(selectHeroes);
  const farmPoolOverrides = usePlannerStore((state) => state.farmPoolOverrides);
  const poolEntries = useMemo(
    () => deriveFarmPoolEntries(heroes, farmPoolOverrides),
    [heroes, farmPoolOverrides],
  );
  const returnBonus = usePlannerStore(selectFarmReturnBonus);
  const maxPhase = usePlannerStore(selectMaxPhase);
  const currentPhase = usePlannerStore(selectPhasesViewPhase);
  const setPhasesViewPhase = usePlannerStore((state) => state.setPhasesViewPhase);
  const setFarmHeroEnabled = usePlannerStore((state) => state.setFarmHeroEnabled);
  const setFarmReturnBonus = usePlannerStore((state) => state.setFarmReturnBonus);

  const [filters, setFilters] = useState<FarmFilters>(defaultFarmFilters);
  const [sort, setSort] = useState<{ key: FarmSortKey; direction: FarmSortDir }>(DEFAULT_SORT);

  const maxPhaseKnown = maxPhase != null;

  const visibleRows = useMemo(() => {
    const effectiveFilters = { ...filters, unlockedOnly: maxPhaseKnown && filters.unlockedOnly };
    const filtered = applyFarmFilters(result.rows, effectiveFilters);
    return sortFarmRows(filtered, sort.key, sort.direction);
  }, [result.rows, filters, sort, maxPhaseKnown]);

  function onSort(key: FarmSortKey) {
    setSort((previous) =>
      previous.key === key
        ? { key, direction: previous.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    );
  }

  const empty =
    result.reason === 'no-roster'
      ? { title: t.farmRankingEmptyNoRosterTitle, description: t.farmRankingEmptyNoRosterDesc }
      : result.reason === 'no-heroes-enabled'
        ? { title: t.farmRankingEmptyNoHeroesTitle, description: t.farmRankingEmptyNoHeroesDesc }
        : result.reason == null && visibleRows.length === 0
          ? { title: t.farmRankingEmptyNoMatchesTitle, description: t.farmRankingEmptyNoMatchesDesc }
          : null;

  return (
    <Panel data-testid="farm-ranking">
      <h2 className="m-0 mb-2.5 text-[13px] font-bold tracking-[0.04em] uppercase">
        {t.farmRankingTitle}
      </h2>
      {result.reason !== 'no-roster' ? (
        <div className="mb-3 flex flex-col gap-2.5">
          <FarmRotationPool entries={poolEntries} onToggle={setFarmHeroEnabled} t={t} />
          <div className="flex flex-wrap items-end justify-between gap-3">
            <FarmRankingFilters
              filters={filters}
              onChange={setFilters}
              maxPhaseKnown={maxPhaseKnown}
              t={t}
            />
            <FarmReturnBonus value={returnBonus} onChange={setFarmReturnBonus} t={t} />
          </div>
        </div>
      ) : null}
      <FarmRespecToolbar t={t} lang={lang} />
      {result.reason === 'compute-failed' ? (
        <div data-testid="farm-ranking-empty">
          <Banner tone="warn" title={t.farmRankingEmptyComputeFailedTitle}>
            {t.farmRankingEmptyComputeFailedDesc}
          </Banner>
        </div>
      ) : empty ? (
        <div data-testid="farm-ranking-empty">
          <EmptyState title={empty.title} description={empty.description} />
        </div>
      ) : (
        <FarmRankingTable
          rows={visibleRows}
          sortKey={sort.key}
          sortDir={sort.direction}
          onSort={onSort}
          currentPhase={currentPhase}
          onActivate={setPhasesViewPhase}
          lang={lang}
          t={t}
        />
      )}
    </Panel>
  );
}
