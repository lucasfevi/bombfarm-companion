import type { ConsentEvent, ConsentRecord } from '@bombfarm/game-api';
import { isGranted, reduceConsent } from '@bombfarm/game-api';

export interface ConsentApplierDeps {
  readonly read: () => ConsentRecord;
  readonly write: (next: ConsentRecord) => void;
  /** Each must run to completion BEFORE the transition is persisted. */
  readonly beforeLosingConsent: readonly (() => Promise<void>)[];
  /** Fire-and-forget, after the write, in order. */
  readonly afterApplied: readonly ((next: ConsentRecord) => void)[];
  readonly onError?: (error: unknown) => void;
}

/**
 * The transition, not the event, decides whether a session needs tearing down: any record
 * `isGranted` still accepts moving to one it rejects is a real loss of an attached tap, whether
 * that happens via `revoke`, `decline`, or a future exit `reduceConsent` grows. Anything the gate
 * was already refusing had nothing attached to tear down. `beforeLosingConsent` hooks are awaited
 * in order before the write, so nothing reads a game session past the moment consent no longer
 * covers it; a hook that rejects is still worth persisting past, since leaving the record
 * `granted` would hide the withdrawal from every later read.
 */
export function createConsentApplier(
  deps: ConsentApplierDeps,
): (event: ConsentEvent) => Promise<ConsentRecord> {
  return async (event: ConsentEvent): Promise<ConsentRecord> => {
    const current = deps.read();
    const next = reduceConsent(current, event);

    if (isGranted(current) && !isGranted(next)) {
      for (const hook of deps.beforeLosingConsent) {
        try {
          await hook();
        } catch (error) {
          deps.onError?.(error);
        }
      }
    }

    deps.write(next);

    for (const hook of deps.afterApplied) {
      hook(next);
    }

    return next;
  };
}
