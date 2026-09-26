'use client';

import { useMemo, type ReactNode } from 'react';
import { HeroPeekStatsProvider } from '@bombfarm/game-art';
import { buildAccountRoster, rosterHeroPeekStats } from './account-roster';
import { useAccountView } from './use-account-view';

/** Every hero hover card in the window prints the sheet the Heroes detail pane totals for the account on hand. */
export function AccountHeroPeekStats({ children }: { children: ReactNode }) {
  const account = useAccountView();
  const view = account.status === 'loaded' ? account.view : null;
  const resolve = useMemo(() => rosterHeroPeekStats(view === null ? null : buildAccountRoster(view)), [view]);
  return <HeroPeekStatsProvider resolve={resolve}>{children}</HeroPeekStatsProvider>;
}
