import type { Clock } from './tap.js';

/**
 * Every session detach still in flight, by game pid — outliving the tap that started it, because
 * a consent revoke replaces the tap while the old one's detach may still be running.
 *
 * A teardown stops waiting on a detach after a bound (so a wedged runtime cannot freeze the UI),
 * but the detach itself keeps going. Injecting a second agent into a process whose first agent is
 * still unloading is how a game came to hold two agents at once, and every crash dump that showed
 * two agents faulted inside one of them. So an attach asks this ledger first, and waits.
 */
export class DetachLedger {
  readonly #pending = new Map<number, Set<Promise<void>>>();

  /** `detaching` must never reject; the caller owns logging its failure. */
  track(pid: number, detaching: Promise<void>): void {
    let forPid = this.#pending.get(pid);
    if (!forPid) {
      forPid = new Set();
      this.#pending.set(pid, forPid);
    }
    forPid.add(detaching);
    void detaching.then(() => {
      forPid.delete(detaching);
      if (forPid.size === 0 && this.#pending.get(pid) === forPid) this.#pending.delete(pid);
    });
  }

  isPending(pid: number): boolean {
    return this.#pending.has(pid);
  }

  /** Resolves `true` once every detach tracked for `pid` (every pid, when `null`) has settled, or
   *  `false` when `timeoutMs` runs out first. */
  settle(pid: number | null, timeoutMs: number, clock: Clock): Promise<boolean> {
    const waiting =
      pid === null ? [...this.#pending.values()].flatMap((set) => [...set]) : [...(this.#pending.get(pid) ?? [])];
    if (waiting.length === 0) return Promise.resolve(true);

    return new Promise((resolve) => {
      const timer = clock.setTimeout(() => {
        resolve(false);
      }, timeoutMs);
      void Promise.all(waiting).then(() => {
        clock.clearTimeout(timer);
        resolve(true);
      });
    });
  }
}
