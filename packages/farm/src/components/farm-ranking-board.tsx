'use client';

import { useEffect, useMemo, useState } from 'react';
import { Banner, EmptyState, Panel } from '@bombfarm/ui';
import { FIELD_SLOTS_MAX } from '@bombfarm/domain/casa-slots';
import type { ReturnBonusMode } from '@bombfarm/domain/farm-rate';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { sub, type FarmCopy, type Lang } from '../copy';
import type { FarmPoolEntry, FarmRankingResult, FarmRespecGate } from '../core';
import type { FarmRespecProposal, FarmRespecStatus } from '../model/farm-respec-view';
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
} from '../model/farm-ranking-view';
import { formatMitigationPct } from '../model/farm-ranking-format';
import { FarmRankingFilters } from './farm-ranking-filters';
import { FarmRotationPool } from './farm-rotation-pool';
import { FarmReturnBonus } from './farm-return-bonus';
import { FarmRankingTable } from './farm-ranking-table';
import { FarmRespecToolbar } from './farm-respec-toolbar';
import { FarmRespecPanel } from './farm-respec-panel';
import { FarmRespecRerankToggle } from './farm-respec-rerank-toggle';
import type { FarmStatLabels } from './stat-labels';

/** The advisor's four values, grouped so the board's own bag stays about the ranking. */
export type FarmRespecBoardData = {
  gate: FarmRespecGate;
  /** Already narrowed to a FRESH proposal by the host — a stale one arrives as `null`. */
  view: FarmRespecProposal | null;
  status: FarmRespecStatus;
  panelOpen: boolean;
};

/**
 * Everything the board reads, and everything it writes, in two bags.
 *
 * Grouped rather than spread flat because the board is the whole screen: nineteen values as
 * nineteen parameters is the prop-drilled god-component the 8-prop budget exists to catch, and
 * `FarmRankingTable` below already groups its own sort pair for the same reason. The field names
 * are the host's store field names on purpose, so a host's connector is a flat, rename-free copy
 * and a reviewer comparing the two can see a missing field rather than translate two vocabularies
 * first — the same contract `FarmInputs` keeps for the compute.
 */
export type FarmRankingBoardData = {
  result: FarmRankingResult;
  reRankActive: boolean;
  heroes: readonly HeroRecord[];
  poolEntries: FarmPoolEntry[];
  returnBonus: ReturnBonusMode;
  maxPhase: number | null;
  fieldSlots: number | null;
  currentPhase: number;
  phasesViewPhaseChosen: boolean;
  statLabels: FarmStatLabels;
  respec: FarmRespecBoardData;
  /** The table scrollport's height. Omitted, the table keeps the fixed height it has always
   *  had — a host that draws the board inside a window it does not control passes its own. */
  tableScrollportHeightPx?: number;
};

export type FarmRankingBoardActions = {
  setPhasesViewPhase: (phase: number) => void;
  syncDefaultPhaseSelection: (phase: number) => void;
  setFarmHeroEnabled: (heroId: string, enabled: boolean) => void;
  setFarmReturnBonus: (mode: ReturnBonusMode) => void;
  setFarmRespecPanelOpen: (open: boolean) => void;
  setFarmRespecReRank: (next: boolean) => void;
  runFarmRespec: () => void;
};

/**
 * The board — filters + rotation pool + return bonus + table, or one of the four
 * empty states. Sort/filter state is `useState` here (ephemeral, not persisted); every other
 * value arrives as a prop, so this component holds no store of its own and both hosts render it
 * from their own state.
 */
export function FarmRankingBoardView({
  t,
  lang,
  data,
  actions,
}: {
  t: FarmCopy;
  lang: Lang;
  data: FarmRankingBoardData;
  actions: FarmRankingBoardActions;
}) {
  const {
    result,
    reRankActive,
    heroes,
    poolEntries,
    returnBonus,
    maxPhase,
    fieldSlots,
    currentPhase,
    phasesViewPhaseChosen,
    statLabels,
    respec,
    tableScrollportHeightPx,
  } = data;
  const {
    setPhasesViewPhase,
    syncDefaultPhaseSelection,
    setFarmHeroEnabled,
    setFarmReturnBonus,
    setFarmRespecPanelOpen,
    setFarmRespecReRank,
    runFarmRespec,
  } = actions;

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
  // current best gold/hr map instead of the host's phase-1 default. This writes the host's state
  // rather than highlighting locally because the same phase also drives the Phases explorer below
  // — a local-only highlight left the board claiming a row was current while seven panels beneath
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
      fieldSlots,
    );
  }, [result.reason, result.rows, currentPhase, visibleRows, fieldSlots]);

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
          <Banner
            tone="warn"
            title={
              contention.atMaxSlots
                ? t.farmRankingContentionTitleMaxSlots
                : t.farmRankingContentionTitle
            }
          >
            {sub(
              contention.atMaxSlots
                ? t.farmRankingContentionDescMaxSlots
                : t.farmRankingContentionDesc,
              {
                pct: `${formatMitigationPct(contention.pct, lang)}%`,
                cost: `${formatMitigationPct(contention.costPct, lang)}%`,
                slots: String(fieldSlots ?? '—'),
                max: String(FIELD_SLOTS_MAX),
              },
            )}
          </Banner>
        </div>
      ) : null}
      <FarmRespecToolbar
        t={t}
        lang={lang}
        data={{ gate: respec.gate, status: respec.status, panelOpen: respec.panelOpen }}
        onOptimize={runFarmRespec}
      />
      <FarmRespecPanel
        t={t}
        lang={lang}
        data={{
          view: respec.view,
          status: respec.status,
          panelOpen: respec.panelOpen,
          heroes,
          statLabels,
        }}
        onClose={() => setFarmRespecPanelOpen(false)}
      />
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
          <FarmRespecRerankToggle
            t={t}
            hasProposal={respec.view != null}
            active={reRankActive}
            onToggle={setFarmRespecReRank}
          />
          <FarmRankingTable
            rows={visibleRows}
            sort={sort}
            onSort={onSort}
            currentPhase={currentPhase}
            onActivate={setPhasesViewPhase}
            lang={lang}
            t={t}
            display={{ reRankActive, scrollportHeightPx: tableScrollportHeightPx }}
          />
        </>
      )}
    </Panel>
  );
}
