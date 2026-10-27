import { useEffect, useState } from 'react';
import { createServerAllocationRequester } from './server-allocation-request';
import { useAccountView } from './use-account-view';

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
    if (view !== null) requestFor(view);
  }, [view, requestFor]);
}
