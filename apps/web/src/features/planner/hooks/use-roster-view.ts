'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  heroPickOutcome,
  orderByRollQuality,
  ownedRosterBoardFilter,
  rosterRowsShown,
  type LeaderboardStatSource,
  type LeaderboardView,
  type RosterBoardFilter,
  type RosterBoardSort,
  type RosterHeroRow,
  type RosterViewMode,
  type ShowcaseView,
} from '@bombfarm/hero/model';
import type { RosterToolbarActions } from '@bombfarm/hero/components';
import { selectTreeSheetTotals, usePlannerStore } from '@/shared/stores';
import { loadRosterView, saveRosterView } from '../model/roster-view-storage';
import { useHeroDraftActions } from './use-hero-draft-actions';

export type RosterView = {
  /** The whole roster — what the ability filter is offered against. */
  rows: readonly RosterHeroRow[];
  /** Filtered and ordered: what both presentations draw. */
  shownRows: readonly RosterHeroRow[];
  selectedId: string;
  sort: RosterBoardSort;
  /** The filter as applied: any remembered ability this roster owns none of is dropped. */
  filter: RosterBoardFilter;
  viewMode: RosterViewMode;
  actions: RosterToolbarActions;
  /** The table's own column order and squad/bench narrowing. */
  leaderboardView: LeaderboardView;
  onLeaderboardView: (next: LeaderboardView) => void;
  /** The board's own switches — whether its cards print their levels. */
  showcaseView: ShowcaseView;
  onShowcaseView: (next: ShowcaseView) => void;
  /** What the table's statistics are composed against — the tree the Stats panel reads. */
  statSource: LeaderboardStatSource;
  onSelectHeroId: (heroId: string) => void;
};

/**
 * How this app is looking at its roster right now, and what picking a hero from it does.
 *
 * Every setting here is remembered across visits and reloads, exactly as the desktop's Heroes
 * screen remembers them, so coming back shows the roster the way it was left.
 *
 * Picking is a draft write, which is why this sits in the planner rather than beside the picker
 * dialog: `applyHero` commits the hero being edited and starts the autosave the strip above it
 * depends on. Selecting from the board also returns to the list, because the board covers the
 * planner and leaving the reader on it would swallow the click — the rule is
 * `heroPickOutcome`'s, proved once and shared with the desktop.
 */
export function useRosterView(): RosterView {
  const heroes = usePlannerStore((state) => state.heroes);
  const activeHeroId = usePlannerStore((state) => state.activeHeroId);
  const { applyHero } = useHeroDraftActions();

  // Read during the first render: the shell's mount gate means this never renders on the server.
  const [storedView] = useState(loadRosterView);
  const [sort, setSort] = useState<RosterBoardSort>(storedView.sort);
  const [storedFilter, setFilter] = useState<RosterBoardFilter>(storedView.filter);
  const [viewMode, setViewMode] = useState<RosterViewMode>(storedView.viewMode);
  const [leaderboardView, setLeaderboardView] = useState<LeaderboardView>(storedView.leaderboardView);
  const [showcaseView, setShowcaseView] = useState<ShowcaseView>(storedView.showcaseView);
  useEffect(() => {
    saveRosterView({ viewMode, sort, filter: storedFilter, leaderboardView, showcaseView });
  }, [viewMode, sort, storedFilter, leaderboardView, showcaseView]);
  const tree = usePlannerStore(useShallow(selectTreeSheetTotals));
  const statSource = useMemo<LeaderboardStatSource>(() => ({ tree }), [tree]);

  const rows = useMemo(() => orderByRollQuality(heroes), [heroes]);
  const filter = useMemo(() => ownedRosterBoardFilter(rows, storedFilter), [rows, storedFilter]);
  // Resolved from the WHOLE roster, never from the narrowed list: a filter is a question about
  // the roster, not a hero switch, so narrowing must not change which hero is being edited.
  const shownRows = useMemo(() => rosterRowsShown(rows, filter, sort), [rows, filter, sort]);
  const selectedId = activeHeroId ?? '';

  const onSelectHeroId = useCallback(
    (heroId: string) => {
      const hero = heroes.find((candidate) => candidate.id === heroId);
      if (hero === undefined) return;
      const outcome = heroPickOutcome(viewMode, heroId);
      applyHero(hero);
      if (outcome.showDetail) setViewMode('list');
    },
    [applyHero, heroes, viewMode],
  );

  const actions = useMemo(
    () => ({ onSort: setSort, onFilter: setFilter, onViewMode: setViewMode }),
    [],
  );

  return {
    rows,
    shownRows,
    selectedId,
    sort,
    filter,
    viewMode,
    actions,
    leaderboardView,
    onLeaderboardView: setLeaderboardView,
    showcaseView,
    onShowcaseView: setShowcaseView,
    statSource,
    onSelectHeroId,
  };
}
