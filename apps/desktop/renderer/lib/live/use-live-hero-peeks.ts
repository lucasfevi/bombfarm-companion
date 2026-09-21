import { useCallback, useMemo } from 'react';
import { heroPeekData, type HeroPeekData } from '@bombfarm/game-art';
import { buildAccountRoster, type AccountRoster } from '../account/account-roster';
import { useAccountView } from '../account/use-account-view';

const NO_PEEKS: ReadonlyMap<string, HeroPeekData> = new Map();

/**
 * One card per roster hero, keyed by the game's own hero id — the same id a live row carries and
 * the same id an inventory item's `equippedBy` holds, so either finds its card by id alone. Built
 * once per roster, not per row and not per tick: the rows are memoised on their props, and a card
 * rebuilt on every fast-channel tick would re-render every row four times a second.
 */
export function rosterHeroPeeks(roster: AccountRoster | null): ReadonlyMap<string, HeroPeekData> {
  if (roster === null) return NO_PEEKS;
  return new Map(roster.heroes.map((hero) => [hero.id, heroPeekData(hero)]));
}

export function useLiveHeroPeeks(): (heroId: string) => HeroPeekData | undefined {
  const accountViewState = useAccountView();
  const view = accountViewState.status === 'loaded' ? accountViewState.view : null;
  const roster = useMemo(() => (view === null ? null : buildAccountRoster(view)), [view]);
  const peeks = useMemo(() => rosterHeroPeeks(roster), [roster]);
  return useCallback((heroId: string) => peeks.get(heroId), [peeks]);
}
