'use client';

/**
 * The PVP screen: the account's standing, asked for the moment the tab opens and refreshed by
 * every duel result, then every duel the app saw settle while it was open, newest first, with
 * whether each one's film is held. The list is what the game reported — nothing on it is
 * predicted, and a duel the app was closed for is not on it, because the tap was not there to
 * see it.
 */
import { useCallback, useEffect, useState } from 'react';
import { cn, colClass, Tooltip } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { refreshPvpStanding, usePvpHistory } from '../../lib/pvp/use-pvp-history';
import { usePvpRefresh } from '../../lib/pvp/use-pvp-refresh';
import { useScreenRefreshRegistration } from '../../lib/refresh/screen-refresh-store';
import { DuelHistoryPanel } from './duel-history-panel';
import { ReplayPanel } from './replay-panel';
import { RivalsPanel } from './rivals-panel';
import { StandingPanel } from './standing-panel';

export function PvpView() {
  const state = usePvpHistory();
  const history = state.status === 'ready' ? state.history : null;
  const [openFilmId, setOpenFilmId] = useState<number | null>(null);
  const openRow = openFilmId === null ? null : (history?.rows.find((row) => row.filmId === openFilmId) ?? null);

  useEffect(() => {
    refreshPvpStanding();
  }, []);

  // The standing is its own read, not the account's, so the shell's refresh bar asks for it and
  // dates its line by when the standing was taken.
  const t = useCopy();
  const refresh = usePvpRefresh();
  const standingAge = useCallback((age: string) => sub(t.pvpStandingAge, { age }), [t]);
  useScreenRefreshRegistration('pvp', {
    capturedAt: history?.standing?.capturedAt ?? null,
    stale: false,
    busy: false,
    readState: refresh.state,
    onRefresh: refresh.request,
    ageLine: standingAge,
  });

  return (
    <Tooltip.Provider>
      <div data-testid="pvp-view" data-state={state.status} className={colClass}>
        <StandingPanel history={history} />
        <div className={cn('grid', 'gap-2.5', 'min-w-0', openFilmId === null ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]')}>
          <RivalsPanel history={history} />
          <ReplayPanel
            filmId={openFilmId}
            row={openRow}
            onClose={() => {
              setOpenFilmId(null);
            }}
          />
        </div>
        <DuelHistoryPanel
          history={history}
          openFilmId={openFilmId}
          onOpenReplay={(row) => {
            setOpenFilmId(row.filmId === openFilmId ? null : row.filmId);
          }}
        />
      </div>
    </Tooltip.Provider>
  );
}
