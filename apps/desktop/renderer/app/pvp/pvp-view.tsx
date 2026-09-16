'use client';

/**
 * The PVP screen: the account's standing, asked for the moment the tab opens and refreshed by
 * every duel result, then every duel the app saw settle while it was open, newest first, with
 * whether each one's film is held. The list is what the game reported — nothing on it is
 * predicted, and a duel the app was closed for is not on it, because the tap was not there to
 * see it.
 */
import { useEffect } from 'react';
import { colClass, Tooltip } from '@bombfarm/ui';
import { refreshPvpStanding, usePvpHistory } from '../../lib/pvp/use-pvp-history';
import { DuelHistoryPanel } from './duel-history-panel';
import { StandingPanel } from './standing-panel';

export function PvpView() {
  const state = usePvpHistory();
  const history = state.status === 'ready' ? state.history : null;

  useEffect(() => {
    refreshPvpStanding();
  }, []);

  return (
    <Tooltip.Provider>
      <div data-testid="pvp-view" data-state={state.status} className={colClass}>
        <StandingPanel history={history} />
        <DuelHistoryPanel history={history} />
      </div>
    </Tooltip.Provider>
  );
}
