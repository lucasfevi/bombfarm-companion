'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountReadRefusal, AccountView } from '@bombfarm/contracts';
import { READ_PACING } from '@bombfarm/game-api';
import { useAccountView } from './use-account-view';

type Bridge = NonNullable<Window['bfc']>;

function bridgeOf(): Bridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { bfc?: Bridge }).bfc ?? null;
}

/** What the press is doing: nothing yet, a read in flight, or a read that never started and the
 *  reason it did not. */
export type AccountReadRequestState =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'refused'; reason: AccountReadRefusal };

export interface AccountReadRequest {
  readonly state: AccountReadRequestState;
  readonly request: () => void;
}

/**
 * The behaviour behind a Refresh that goes and reads the account, for every screen that offers
 * one. Taking the account the renderer already holds is not a refresh: the background cycle may
 * not have run since the screen took its copy, and then there is nothing newer to take. So the
 * press asks main to go and read, and what it finds arrives later as a push.
 *
 * `adopt` is the screen's own way of taking the account the renderer holds RIGHT NOW — pinning a
 * view, recomputing a board. It runs on the press whatever main answers, because a screen can be
 * behind the account already committed even when no new read is allowed to start, and it runs
 * again once the read has landed.
 */
export function useAccountReadRequest(adopt: () => void): AccountReadRequest {
  const accountViewState = useAccountView();
  const live = accountViewState.status === 'loaded' ? accountViewState.view : null;

  const [state, setState] = useState<AccountReadRequestState>({ kind: 'idle' });
  const liveRef = useRef(live);
  liveRef.current = live;
  const adoptRef = useRef(adopt);
  adoptRef.current = adopt;
  const liveAtPress = useRef<AccountView | null>(null);

  const request = useCallback(() => {
    liveAtPress.current = liveRef.current;
    adoptRef.current();
    const bridge = bridgeOf();
    if (!bridge) {
      setState({ kind: 'refused', reason: 'unavailable' });
      return;
    }
    setState({ kind: 'working' });
    void bridge
      .invoke('account:readNow')
      .then((result) => {
        if (!result.ok) setState({ kind: 'refused', reason: result.reason });
      })
      .catch(() => {
        setState({ kind: 'refused', reason: 'unavailable' });
      });
  }, []);

  // A read that changed nothing commits nothing and pushes nothing, so waiting on the push alone
  // would leave the button reading forever on an account that simply had no news. The floor is
  // the deadline because past it the button is pressable again anyway, and a control saying it is
  // working while it is ready to be pressed says the one thing that is not true.
  useEffect(() => {
    if (state.kind !== 'working') return;
    const settle = (): void => {
      adoptRef.current();
      setState({ kind: 'idle' });
    };
    if (live !== liveAtPress.current) {
      settle();
      return;
    }
    const timer = setTimeout(settle, READ_PACING.manualRefreshFloorMs);
    return () => {
      clearTimeout(timer);
    };
  }, [state, live]);

  return { state, request };
}
