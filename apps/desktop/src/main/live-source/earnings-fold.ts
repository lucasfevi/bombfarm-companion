import type { LiveTick } from '@bombfarm/contracts';
import type { LogPort } from './log-port.js';

/**
 * Folds the live tick stream into measured gold- and XP-per-hour, entirely in the main process —
 * the renderer is forbidden from doing any of this arithmetic itself. Pure and dependency-injected:
 * every timestamp comes from `deps.now()`, never from a timer this class owns, so a test can drive
 * the clock deterministically and a caller controls exactly when a tick is considered to have
 * arrived.
 */

const MS_PER_HOUR = 3_600_000;

/** ~10 frames/second cadence, so a single missed tick is ~100ms. Capping a gap's contribution at
 *  2 seconds — about 20 ticks' worth of generous jitter — is what freezes the streamed clock across
 *  a real interruption (a tab-out, a reconnect): a multi-minute gap still only ever adds 2 seconds,
 *  never the whole gap, so a rate computed across it does not collapse toward zero. */
export const MAX_TICK_GAP_MS = 2_000;

export interface EarningsFoldDeps {
  readonly now: () => number;
  readonly xpPerProp: (phase: number) => number;
  readonly log: LogPort;
}

/**
 * Absent, non-finite, and a literal `0` all mean "no boost" — the same normalization
 * `packages/domain/src/import-save.ts` applies to `xp_mult` twice, so a boost multiplier can never
 * silently zero every XP figure it touches.
 */
function normalizedXpMult(value: number | undefined): number {
  return (typeof value === 'number' && Number.isFinite(value) ? value : 1) || 1;
}

export class EarningsFold {
  readonly #deps: EarningsFoldDeps;

  #lastSequence = Number.NEGATIVE_INFINITY;
  #lastTickAt: number | null = null;

  #goldTotal = 0;
  #xpTotal = 0;
  #streamedMs = 0;

  constructor(deps: EarningsFoldDeps) {
    this.#deps = deps;
  }

  /**
   * `sequence` is the frame's own monotonic counter, not derived from `now()` — a tick whose
   * sequence does not advance past the last one consumed is ignored outright, which is the real
   * defence against the offline replay loop restarting the capture from its first record.
   */
  consumeTick(tick: LiveTick, sequence: number, xpMult?: number): void {
    if (sequence <= this.#lastSequence) return;
    this.#lastSequence = sequence;

    const now = this.#deps.now();
    const gapMs = this.#lastTickAt === null ? 0 : now - this.#lastTickAt;
    this.#lastTickAt = now;
    this.#streamedMs += Math.max(0, Math.min(gapMs, MAX_TICK_GAP_MS));

    let propsThisTick = 0;
    for (const pop of tick.loot ?? []) {
      if (pop.gold === undefined || !Number.isFinite(pop.gold)) continue;
      this.#goldTotal += pop.gold;
      propsThisTick += 1;
    }

    if (propsThisTick > 0 && tick.phase !== undefined) {
      this.#xpTotal += propsThisTick * this.#deps.xpPerProp(tick.phase) * normalizedXpMult(xpMult);
    }
  }

  #sessionRate(total: number): number | null {
    if (this.#streamedMs === 0) return null;
    return (total / this.#streamedMs) * MS_PER_HOUR;
  }

  get goldSession(): number | null {
    return this.#sessionRate(this.#goldTotal);
  }

  get xpSession(): number | null {
    return this.#sessionRate(this.#xpTotal);
  }

  get sessionSeconds(): number {
    return this.#streamedMs / 1000;
  }
}
