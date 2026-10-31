export type PremiumRemovalReason = 'ended' | 'moved' | 'released';

/**
 * How the licence service asks the premium host to delete its code, and how the host answers that
 * the folder is gone. The host does not exist yet; until it does, the default port has nothing on
 * disk and answers at once.
 */
export interface PremiumRemovalPort {
  requestPremiumRemoval(reason: PremiumRemovalReason): void;
  /** The sequence of the bundle running now, or null when none is. */
  runningSequence(): number | null;
  /**
   * The newest bundle sequence the API named in a Lease answer, unsigned and passed on unchanged
   * (null when the answer named none). The licence feature never acts on it.
   */
  noteLatestSequence(sequence: number | null): void;
  /** Hands the port the function it calls once the premium folder is gone. */
  attach(noteFolderGone: () => void): void;
}

/** A port with nothing downloaded: "gone" is reported on the next tick, and no bundle runs. */
export function createDefaultRemovalPort(defer: (run: () => void) => void = queueMicrotask): PremiumRemovalPort {
  let noteFolderGone: (() => void) | null = null;
  return {
    requestPremiumRemoval() {
      defer(() => {
        noteFolderGone?.();
      });
    },
    runningSequence: () => null,
    noteLatestSequence() {
      // Nothing is downloaded, so there is nothing to compare it with.
    },
    attach(next) {
      noteFolderGone = next;
    },
  };
}
