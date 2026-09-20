'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountReadRequestState } from '../account/use-account-read-request';
import { useMarketSnapshot } from '../market/use-market-snapshot';

type Bridge = NonNullable<Window['bfc']>;

/** A check that ran announces itself on `market:changed`; one the bridge lost must not leave the
 *  item reading forever. */
const WORKING_CEILING_MS = 15_000;

function bridgeOf(): Bridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { bfc?: Bridge }).bfc ?? null;
}

/** The price list's own press: asks main to check the published file now, and reports working
 *  until the view it produced lands — the same three states every other feed's press has. */
export function useMarketCheck(): { readonly state: AccountReadRequestState; readonly request: () => void } {
  const { state: market } = useMarketSnapshot();
  const [state, setState] = useState<AccountReadRequestState>({ kind: 'idle' });
  const appliedAtPress = useRef<number | null>(null);

  useEffect(() => {
    if (state.kind !== 'working') return;
    if (appliedAtPress.current !== null && market.applied !== appliedAtPress.current) {
      setState({ kind: 'idle' });
      return;
    }
    const timer = window.setTimeout(() => {
      setState({ kind: 'idle' });
    }, WORKING_CEILING_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [state, market.applied]);

  const request = useCallback(() => {
    const bridge = bridgeOf();
    if (!bridge) {
      setState({ kind: 'refused', reason: 'unavailable' });
      return;
    }
    appliedAtPress.current = market.applied;
    setState({ kind: 'working' });
    void bridge
      .invoke('market:check')
      .then((result) => {
        if (!result.ok) setState({ kind: 'refused', reason: result.reason });
      })
      .catch(() => {
        setState({ kind: 'refused', reason: 'unavailable' });
      });
  }, [market.applied]);

  return { state, request };
}
