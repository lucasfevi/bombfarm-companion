import type { LicenceState } from '@bombfarm/contracts';

export type LeaseGateListener = (allows: boolean, state: LicenceState) => void;

/**
 * The app's one answer to "may premium code run now?", and the desktop licence state it came with.
 * The licence service is its only writer; when the Premium surface is off for this flavor nothing
 * writes it, so it stays closed. `set` tells every subscriber before it returns, so a closing gate
 * is known in the same tick as the change that closed it.
 */
export interface LeaseGate {
  allows(): boolean;
  /** Writes the gate's value and, when given, the licence state; a change of either is announced. */
  set(allows: boolean, state?: LicenceState): void;
  subscribe(listener: LeaseGateListener): () => void;
}

export function createLeaseGate(): LeaseGate {
  let open = false;
  let current: LicenceState = 'signed_out';
  const listeners = new Set<LeaseGateListener>();

  return {
    allows: () => open,
    set(allows, state = current) {
      if (allows === open && state === current) return;
      open = allows;
      current = state;
      for (const listener of [...listeners]) {
        // One subscriber's fault must not stop the others hearing of the change, nor the writer.
        try {
          listener(allows, state);
        } catch {
          // ignored on purpose
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const appLeaseGate: LeaseGate = createLeaseGate();

/**
 * May premium code run now? True only while this PC holds a current Lease for the playing account.
 * No arguments, no I/O: it reads the value the licence service already derived. Its callers are
 * allowlisted by a guard test.
 */
export function premiumLeaseAllows(): boolean {
  return appLeaseGate.allows();
}

/** Called on every change of the gate's value or of the licence state, before the writer returns. */
export function onPremiumLeaseChange(listener: LeaseGateListener): () => void {
  return appLeaseGate.subscribe(listener);
}
