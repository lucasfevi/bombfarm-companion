'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountReadRequestState } from '../account/use-account-read-request';
import { usePvpHistory } from './use-pvp-history';

type Bridge = NonNullable<Window['bfc']>;

/** A read that lands announces itself on `pvp:changed`; one that never does (a body the
 *  server refused, a paced-out request) must not leave the button working forever. */
const WORKING_CEILING_MS = 8_000;

function bridgeOf(): Bridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { bfc?: Bridge }).bfc ?? null;
}

/** The standing's own refresh: asks main to read the state and the ranking now, and reports
 *  working until the next push lands — the same three states the account refresh control draws. */
export function usePvpRefresh(): { readonly state: AccountReadRequestState; readonly request: () => void } {
  const history = usePvpHistory();
  const [state, setState] = useState<AccountReadRequestState>({ kind: 'idle' });
  const appliedAtPress = useRef<number | null>(null);

  useEffect(() => {
    if (state.kind !== 'working') return;
    if (appliedAtPress.current !== null && history.applied !== appliedAtPress.current) {
      setState({ kind: 'idle' });
      return;
    }
    const timer = window.setTimeout(() => {
      setState({ kind: 'idle' });
    }, WORKING_CEILING_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state, history.applied]);

  const request = useCallback(() => {
    const bridge = bridgeOf();
    if (!bridge) {
      setState({ kind: 'refused', reason: 'unavailable' });
      return;
    }
    appliedAtPress.current = history.applied;
    setState({ kind: 'working' });
    void bridge
      .invoke('pvp:refresh')
      .then((result) => {
        if (!result.ok) setState({ kind: 'refused', reason: result.reason });
      })
      .catch(() => {
        setState({ kind: 'refused', reason: 'unavailable' });
      });
  }, [history.applied]);

  return { state, request };
}
