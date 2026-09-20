'use client';

/**
 * Where a screen tells the shell how to refresh it. The shell draws one refresh bar under the top
 * bar for every tab, and a screen whose numbers come from a copy of its own — the Farm board, the
 * Forge bag, the Optimizer snapshot, the PVP standing — registers here while it is mounted, so the
 * bar's age line and its button are that screen's. A screen that registers nothing gets the bar's
 * default: the age of the live account read, and a press that asks main to read it again.
 *
 * Keyed by tab id rather than held as "the current screen" so the shell looks up the tab it is
 * showing and never a screen that is still unmounting behind a switch.
 */
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { AccountReadRequestState } from '../account/use-account-read-request';

export interface ScreenRefreshState {
  /** The age the bar prints: when the read the screen's numbers came from was taken. */
  readonly capturedAt: string | null;
  /** The live account has moved past the copy the screen computed from. */
  readonly stale: boolean;
  /** The screen is recomputing right now. */
  readonly busy: boolean;
  readonly readState: AccountReadRequestState;
  readonly onRefresh: () => void;
  /** The line beside the button when the thing refreshed is not the account read. */
  readonly ageLine?: (age: string) => string;
}

const registered = new Map<string, ScreenRefreshState>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function registerScreenRefresh(tabId: string, state: ScreenRefreshState): () => void {
  registered.set(tabId, state);
  notify();
  return () => {
    if (registered.get(tabId) !== state) return;
    registered.delete(tabId);
    notify();
  };
}

export function screenRefreshOf(tabId: string): ScreenRefreshState | null {
  return registered.get(tabId) ?? null;
}

export function resetScreenRefreshForTests(): void {
  registered.clear();
  listeners.clear();
}

export function useScreenRefresh(tabId: string): ScreenRefreshState | null {
  return useSyncExternalStore(
    subscribe,
    () => screenRefreshOf(tabId),
    () => null,
  );
}

/** Registers the screen's refresh for as long as it is mounted, re-registering as its parts move. */
export function useScreenRefreshRegistration(
  tabId: string,
  { capturedAt, stale, busy, readState, onRefresh, ageLine }: ScreenRefreshState,
): void {
  const state = useMemo<ScreenRefreshState>(
    () => (ageLine === undefined ? { capturedAt, stale, busy, readState, onRefresh } : { capturedAt, stale, busy, readState, onRefresh, ageLine }),
    [capturedAt, stale, busy, readState, onRefresh, ageLine],
  );
  useEffect(() => registerScreenRefresh(tabId, state), [tabId, state]);
}
