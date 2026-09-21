'use client';

import { useCallback, useState } from 'react';
import type { AccountReadRefusal, UpdateStatus } from '@bombfarm/contracts';

/** Why a feed's press started nothing: the account read's reasons, plus the two only the update
 *  check has — a build with no channel to ask, and an update already past the checking stage. */
export type FeedRefusal = AccountReadRefusal | 'updates_off' | 'updates_busy';

export type FeedPressState = { kind: 'idle' } | { kind: 'working' } | { kind: 'refused'; reason: FeedRefusal };

/**
 * What a check that came back without checking means. Main's check answers with the status as it
 * stands when it cannot run: a build with no channel stays `disabled`; a download in flight or an
 * update waiting for a restart stays where it is, because a check would invalidate the transfer;
 * an updater that never loaded reports `error` without ever stamping a check. A check that ran
 * stamps `lastCheckedAt` whatever it found.
 */
export function updateCheckRefusal(status: UpdateStatus): FeedRefusal | null {
  if (status.phase === 'disabled') return 'updates_off';
  if (status.phase === 'downloading' || status.phase === 'ready') return 'updates_busy';
  if (status.phase === 'error' && status.lastCheckedAt === null) return 'unavailable';
  return null;
}

/** The update feed's own press: working from the press until main's check answers, then idle,
 *  or refused with the reason the answer carries. */
export function useUpdateCheck(
  updateStatus: UpdateStatus | null,
  check: () => Promise<UpdateStatus | null>,
): { readonly state: FeedPressState; readonly request: () => void } {
  const [pressed, setPressed] = useState<FeedPressState>({ kind: 'idle' });

  const request = useCallback(() => {
    setPressed({ kind: 'working' });
    void check()
      .then((status) => {
        if (status === null) {
          setPressed({ kind: 'refused', reason: 'unavailable' });
          return;
        }
        const reason = updateCheckRefusal(status);
        setPressed(reason === null ? { kind: 'idle' } : { kind: 'refused', reason });
      })
      .catch(() => {
        setPressed({ kind: 'refused', reason: 'unavailable' });
      });
  }, [check]);

  const state: FeedPressState = pressed.kind !== 'working' && updateStatus?.phase === 'checking' ? { kind: 'working' } : pressed;
  return { state, request };
}
