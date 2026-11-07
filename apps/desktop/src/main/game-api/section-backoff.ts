import type { AccountSection } from '@bombfarm/contracts';
import type { SectionFailureReason, SectionOutcome } from '@bombfarm/game-api';

const REST_BY_STRIKE_MS = [0, 120_000, 240_000, 480_000, 900_000] as const;
const LONGEST_REST_MS = 900_000;

const REPEATABLE_FAILURES: ReadonlySet<SectionFailureReason> = new Set(['too_large', 'transport_error']);

export interface SectionRest {
  readonly section: AccountSection;
  readonly strikes: number;
  readonly restMs: number;
}

export interface SectionBackoff {
  isResting(section: AccountSection, nowMs: number): boolean;
  /** Returns the sections that just began a rest. */
  record(outcomes: Readonly<Record<AccountSection, SectionOutcome>>, nowMs: number): readonly SectionRest[];
  /** Ends every rest but keeps the strikes: a player asked, so try now, and if it fails again the
   *  next rest is no shorter. */
  wake(): void;
  /** Forgets everything: the strikes belonged to a session that has ended. */
  reset(): void;
}

/**
 * Stops one route re-downloading a body that keeps failing, without touching the others. A cycle
 * that read nothing at all says the network is down rather than that a route is broken, so it
 * neither adds nor clears a strike: waking a laptop must not leave the inventory waiting 15 minutes.
 */
export function createSectionBackoff(): SectionBackoff {
  const state = new Map<AccountSection, { strikes: number; retryAtMs: number }>();

  return {
    isResting(section, nowMs) {
      const entry = state.get(section);
      if (entry === undefined) return false;
      // A retry further away than any rest means the wall clock moved back; don't wait it out.
      return nowMs < entry.retryAtMs && entry.retryAtMs - nowMs <= LONGEST_REST_MS;
    },
    record(outcomes, nowMs) {
      const entries = Object.entries(outcomes) as [AccountSection, SectionOutcome][];
      if (entries.every(([, outcome]) => outcome.kind === 'failed')) return [];

      const started: SectionRest[] = [];
      for (const [section, outcome] of entries) {
        if (outcome.kind !== 'failed') {
          state.delete(section);
          continue;
        }
        if (!REPEATABLE_FAILURES.has(outcome.reason)) continue;
        const strikes = (state.get(section)?.strikes ?? 0) + 1;
        const restMs = REST_BY_STRIKE_MS[strikes - 1] ?? LONGEST_REST_MS;
        state.set(section, { strikes, retryAtMs: nowMs + restMs });
        if (restMs > 0) started.push({ section, strikes, restMs });
      }
      return started;
    },
    wake() {
      for (const entry of state.values()) entry.retryAtMs = 0;
    },
    reset() {
      state.clear();
    },
  };
}
