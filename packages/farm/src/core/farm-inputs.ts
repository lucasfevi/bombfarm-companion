/**
 * Everything the farm board's compute reads, flattened into one plain record.
 *
 * This compute used to take a host app's zustand store as its parameter, which is precisely why
 * only one app could run it. Each host now maps its own state onto this shape, so nothing under
 * `@bombfarm/farm/core` knows what a store is and neither app's state shape reaches the other.
 *
 * The field names are the store field names on purpose: a host's mapper is then a flat
 * rename-free copy, and a reviewer comparing it against {@link FarmInputs} can see a missing
 * field rather than having to translate two vocabularies first.
 */
import type { ReturnBonusMode } from '@bombfarm/domain/farm-rate';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';

export type FarmInputs = {
  heroes: readonly HeroRecord[];
  treeDanoTotal: number;
  treeCritChance: number;
  treeCritDmg: number;
  treeSpeed: number;
  treeEnergy: number;
  treeTeamCoinPct: number;
  treeLuckFlatPct: number;
  /**
   * Already resolved: the override when one is set, the roster-derived total otherwise. Resolved
   * by the host because the derivation is memoized there — a host that recomputed it per call
   * would hand this seam a fresh object every time and defeat the dependency tuple's reference
   * compare (see `readFarmDepTuple`).
   */
  effectiveTeamBuffs: Record<string, number>;
  /** Which of the two the field above is — `buildAccount` passes it through verbatim. */
  teamBuffsOverride: Record<string, number> | null;
  houseIdx: number;
  houseLevel: number;
  /**
   * HOUSE RECOVERY slots (`casa.slots`) — how many heroes the House refills at a time. NOT the
   * field concurrency cap; that is {@link fieldSlots}, a different number on a real save.
   */
  slots: number | undefined;
  /** FIELD slots (`skills.field_slots`). `null` on an account stored before the two were split,
   *  which sends the board back to {@link slots} as its only available figure. */
  fieldSlots: number | null;
  /** `casa.cycle_secs` — a full 0 → 100% House fill in seconds. `null` falls back to the
   *  `HOUSES` table. */
  houseCycleSecs: number | null;
  /** The (house, level) {@link houseCycleSecs} was captured at, snapshotted separately from the
   *  live {@link houseIdx}/{@link houseLevel} picker so a picker move can be told apart from the
   *  account's own imported configuration. */
  houseCycleSecsHouseIdx: number | null;
  houseCycleSecsLevel: number | null;
  maxPhase: number | null;
  farmPoolOverrides: Record<string, boolean>;
  farmReturnBonus: ReturnBonusMode;
};
