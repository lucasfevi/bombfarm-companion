'use client';

import { useEffect, useMemo, useState } from 'react';
import { Banner, EmptyState, Panel } from '@bombfarm/ui';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import {
  deriveFarmPoolEntries,
  selectFarmBoardRows,
  selectFarmReRankActive,
  selectFarmReturnBonus,
  selectFieldSlots,
  selectHeroes,
  selectMaxPhase,
  selectPhasesViewPhase,
  selectPhasesViewPhaseChosen,
  usePlannerStore,
} from '@/shared/stores';
import {
  applyFarmFilters,
  DEFAULT_SORT,
  defaultFarmFilters,
  pickBestFarmRow,
  pickContentionNotice,
  sortFarmRows,
  type FarmFilters,
  type FarmSortDir,
  type FarmSortKey,
} from '@/features/phases/model/farm-ranking-view';
import { formatMitigationPct } from '@/features/phases/model/farm-ranking-format';
import { FarmRankingFilters } from './farm-ranking-filters';
import { FarmRotationPool } from './farm-rotation-pool';
import { FarmReturnBonus } from './farm-return-bonus';
import { FarmRankingTable } from './farm-ranking-table';
import { FarmRespecToolbar } from './farm-respec-toolbar';
import { FarmRespecPanel } from './farm-respec-panel';
import { FarmRespecRerankToggle } from './farm-respec-rerank-toggle';

/**
 * The board — filters + rotation pool + return bonus + table, or one of the four
 * empty states. Sort/filter state is `useState` here (MOD-13 — ephemeral, not
 * persisted); the pool and return bonus are store fields read via
 * `usePlannerStore(selectFarmBoardRows)` WITHOUT `useShallow` (the `selectAdvisorPipeline`
 * carve-out — shallow-comparing 600 rows on every write would defeat the memo).
 */
export function FarmRankingBoard({ t, lang }: { t: Strings; lang: Lang }) {
  const result = usePlannerStore(selectFarmBoardRows);
  const reRankActive = usePlannerStore(selectFarmReRankActive);
  const heroes = usePlannerStore(selectHeroes);
  const farmPoolOverrides = usePlannerStore((state) => state.farmPoolOverrides);
  const poolEntries = useMemo(
    () => deriveFarmPoolEntries(heroes, farmPoolOverrides),
    [heroes, farmPoolOverrides],
  );
  const returnBonus = usePlannerStore(selectFarmReturnBonus);
  const maxPhase = usePlannerStore(selectMaxPhase);
  const fieldSlots = usePlannerStore(selectFieldSlots);
  const currentPhase = usePlannerStore(selectPhasesViewPhase);
  const phasesViewPhaseChosen = usePlannerStore(selectPhasesViewPhaseChosen);
  const setPhasesViewPhase = usePlannerStore((state) => state.setPhasesViewPhase);
  const syncDefaultPhaseSelection = usePlannerStore((state) => state.syncDefaultPhaseSelection);
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

  // Read from `visibleRows` — after filtering, so a locked or filtered-out phase is never
  // auto-selected.
  const bestPhase = useMemo(() => pickBestFarmRow(visibleRows)?.phase ?? null, [visibleRows]);

  // Nothing chosen yet (fresh load, no click, no persisted phase): point the shared phase at the
  // current best gold/hr map instead of the store's phase-1 default. This writes the store rather
  // than highlighting locally because `phasesViewPhase` also drives the Phases explorer below —
  // a local-only highlight left the board claiming a row was current while seven panels beneath
  // it described phase 1. `syncDefaultPhaseSelection` leaves the phase unchosen and unpersisted,
  // so this re-runs against the best map on the next load and any real pick wins for good.
  useEffect(() => {
    if (phasesViewPhaseChosen || bestPhase == null) return;
    syncDefaultPhaseSelection(bestPhase);
  }, [phasesViewPhaseChosen, bestPhase, syncDefaultPhaseSelection]);

  function onSort(key: FarmSortKey) {
    setSort((previous) =>
      previous.key === key
        ? { key, direction: previous.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    );
  }

  // The row the player is actually looking at — contention is per-row, never an aggregate.
  const contention = useMemo(() => {
    if (result.reason != null) return null;
    return pickContentionNotice(
      result.rows.find((candidate) => candidate.phase === currentPhase) ?? pickBestFarmRow(visibleRows),
    );
  }, [result.reason, result.rows, currentPhase, visibleRows]);

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
        <div className="mb-3">
          <FarmRotationPool
            entries={poolEntries}
            heroes={heroes}
            onToggle={setFarmHeroEnabled}
            lang={lang}
            t={t}
          />
        </div>
      ) : null}
      {contention ? (
        <div className="mb-3" data-testid="farm-contention-notice">
          <Banner tone="warn" title={t.farmRankingContentionTitle}>
            {sub(t.farmRankingContentionDesc, {
              pct: `${formatMitigationPct(contention.pct)}%`,
              slots: String(fieldSlots ?? '—'),
            })}
          </Banner>
        </div>
      ) : null}
      <FarmRespecToolbar t={t} />
      <FarmRespecPanel t={t} lang={lang} />
      {result.reason !== 'no-roster' ? (
        <div className="mb-2 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
          <FarmRankingFilters
            filters={filters}
            onChange={setFilters}
            maxPhaseKnown={maxPhaseKnown}
            lang={lang}
            t={t}
          />
          <FarmReturnBonus value={returnBonus} onChange={setFarmReturnBonus} t={t} />
        </div>
      ) : null}
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
        <>
          <FarmRespecRerankToggle t={t} />
          <FarmRankingTable
            rows={visibleRows}
            sort={sort}
            onSort={onSort}
            currentPhase={currentPhase}
            onActivate={setPhasesViewPhase}
            lang={lang}
            t={t}
            reRankActive={reRankActive}
          />
        </>
      )}
    </Panel>
  );
}
