import { useEffect, useState } from 'react';
import { createServerAllocationRequester } from './server-allocation-request';
import { useAccountView } from './use-account-view';

/** Nothing on screen waits on the answer, so the parse waits for idle rather than sharing the
 *  frames a fresh account read is painting. */
const IDLE_TIMEOUT_MS = 10_000;

/** Mounted by the main window alone: the compact Live window reaches a fixed channel set, and one
 *  window asking is enough — main attaches the readings to the account both windows read. */
export function useServerAllocationRequests(): void {
  const account = useAccountView();
  const view = account.status === 'loaded' ? account.view : null;
  const [requestFor] = useState(() =>
    createServerAllocationRequester((heroIds) => {
      void window.bfc?.invoke('account:readAllocations', heroIds).catch(() => undefined);
    }),
  );

  useEffect(() => {
    if (view === null) return;
    const handle = window.requestIdleCallback(
      () => {
        requestFor(view);
      },
      { timeout: IDLE_TIMEOUT_MS },
    );
    return () => {
      window.cancelIdleCallback(handle);
    };
  }, [view, requestFor]);
}
