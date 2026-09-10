'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  DEFAULT_ROSTER_BOARD_SORT,
  EMPTY_ROSTER_BOARD_FILTER,
  heroPickOutcome,
  orderByRollQuality,
  rosterRowsShown,
  type RosterBoardFilter,
  type RosterBoardSort,
  type RosterHeroRow,
  type RosterViewMode,
} from '@bombfarm/hero/model';
import type { RosterToolbarActions } from '@bombfarm/hero/components';
import { usePlannerStore } from '@/shared/stores';
import { useHeroDraftActions } from './use-hero-draft-actions';

export type RosterView = {
  /** The whole roster — what the ability filter is offered against. */
  rows: readonly RosterHeroRow[];
  /** Filtered and ordered: what both presentations draw. */
  shownRows: readonly RosterHeroRow[];
  selectedId: string;
  sort: RosterBoardSort;
  filter: RosterBoardFilter;
  viewMode: RosterViewMode;
  actions: RosterToolbarActions;
  onSelectHeroId: (heroId: string) => void;
};

/**
 * How this app is looking at its roster right now, and what picking a hero from it does.
 *
 * All three settings are view-local and stored nowhere, exactly as the desktop's Heroes screen
 * holds them: they are ways of looking at the roster you are in front of, not preferences about
 * this account, and the planner tab — which IS about the work in hand — is the one thing here
 * that survives a reload.
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

  const [sort, setSort] = useState<RosterBoardSort>(DEFAULT_ROSTER_BOARD_SORT);
  const [filter, setFilter] = useState<RosterBoardFilter>(EMPTY_ROSTER_BOARD_FILTER);
  const [viewMode, setViewMode] = useState<RosterViewMode>('list');

  const rows = useMemo(() => orderByRollQuality(heroes), [heroes]);
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

  return { rows, shownRows, selectedId, sort, filter, viewMode, actions, onSelectHeroId };
}
