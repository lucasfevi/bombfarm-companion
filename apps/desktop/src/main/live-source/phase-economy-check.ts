import { computePhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import type { PhaseEconomy } from '@bombfarm/game-api';
import type { LogPort } from './log-port.js';

/** The committed wiki bundle's unboosted per-prop figures for one phase. */
export interface PhaseEconomyBaseline {
  readonly xpPerProp: number;
  readonly goldPerProp: number;
}

/** The same unboosted figures the Phases screen and the Live map panel start from. */
export function wikiPhaseEconomyBaseline(phase: number): PhaseEconomyBaseline | null {
  const intel = computePhaseIntelGlobal(phase);
  // The bundle lookup clamps an out-of-range phase onto its last row; that row is not this phase's.
  if (intel === null || intel.phase !== phase) return null;
  return { xpPerProp: intel.xpPerPropWiki, goldPerProp: intel.weightedAvgGoldWiki };
}

export interface PhaseEconomyCheckDeps {
  readonly now: () => number;
  /** `null` for a phase the bundle has no row for. */
  readonly wikiBaseline: (phase: number) => PhaseEconomyBaseline | null;
  readonly log: LogPort;
}

/** The bodies of one burst arrive within milliseconds of each other; anything this far apart is
 *  a new burst, sent under whatever multipliers the account has by then. */
export const PHASE_ECONOMY_BURST_GAP_MS = 5_000;
const MIN_BODIES_FOR_A_FACTOR = 3;
/** Below this the server's whole-number gold is dominated by per-prop rounding the bundle does
 *  not model (phases 1-10 read 3.2× to 4.9× the bundle within one burst), so it says nothing
 *  about drift. */
const MIN_WIKI_GOLD_FOR_CHECK = 100;
const GOLD_RELATIVE_TOLERANCE = 0.01;
const XP_ABSOLUTE_TOLERANCE = 2;
const XP_RELATIVE_TOLERANCE = 0.005;

type Axis = 'xp' | 'gold';

interface Entry {
  readonly phase: number;
  readonly server: Readonly<Record<Axis, number>>;
  readonly wiki: Readonly<Record<Axis, number>>;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

function withinTolerance(axis: Axis, server: number, expected: number): boolean {
  const error = Math.abs(server - expected);
  return axis === 'xp'
    ? error <= Math.max(XP_ABSOLUTE_TOLERANCE, XP_RELATIVE_TOLERANCE * server)
    : error <= GOLD_RELATIVE_TOLERANCE * expected;
}

/**
 * Cross-checks the server's per-phase economy against the committed wiki bundle, for logging
 * only — nothing here reaches a displayed figure.
 *
 * The server's per-prop figures already carry the account's multipliers, so they never equal the
 * bundle. What holds instead is that every phase of one burst is the bundle's value times ONE
 * shared factor. The factor is taken as the burst's median ratio, and a phase that departs from
 * it is a phase whose bundle value no longer matches the game.
 */
export class PhaseEconomyCheck {
  readonly #deps: PhaseEconomyCheckDeps;
  #burst = new Map<number, Entry>();
  #flagged = new Set<string>();
  #lastAtMs: number | null = null;

  constructor(deps: PhaseEconomyCheckDeps) {
    this.#deps = deps;
  }

  observe(economy: PhaseEconomy): void {
    const now = this.#deps.now();
    if (this.#lastAtMs === null || now - this.#lastAtMs > PHASE_ECONOMY_BURST_GAP_MS) {
      this.#burst = new Map();
      this.#flagged = new Set();
    }
    this.#lastAtMs = now;

    const baseline = this.#deps.wikiBaseline(economy.phase);
    if (baseline === null) {
      this.#deps.log.warn({ scope: 'live-source', event: 'phase_economy.no_wiki_row', phase: economy.phase });
      return;
    }
    this.#burst.set(economy.phase, {
      phase: economy.phase,
      server: { xp: economy.xpPerProp, gold: economy.goldPerProp },
      wiki: { xp: baseline.xpPerProp, gold: baseline.goldPerProp },
    });

    const entries = [...this.#burst.values()];
    this.#checkAxis('xp', entries.filter((entry) => entry.wiki.xp > 0));
    this.#checkAxis('gold', entries.filter((entry) => entry.wiki.gold >= MIN_WIKI_GOLD_FOR_CHECK));
  }

  #checkAxis(axis: Axis, entries: readonly Entry[]): void {
    if (entries.length < MIN_BODIES_FOR_A_FACTOR) return;
    const factor = median(entries.map((entry) => entry.server[axis] / entry.wiki[axis]));
    for (const entry of entries) {
      const expected = factor * entry.wiki[axis];
      const key = `${axis}|${String(entry.phase)}`;
      if (withinTolerance(axis, entry.server[axis], expected) || this.#flagged.has(key)) continue;
      this.#flagged.add(key);
      this.#deps.log.warn({
        scope: 'live-source',
        event: 'phase_economy.wiki_mismatch',
        axis,
        phase: entry.phase,
        server: entry.server[axis],
        expected,
        wiki: entry.wiki[axis],
        sharedFactor: factor,
      });
    }
  }
}
