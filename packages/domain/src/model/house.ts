// House recovery time in seconds: Casa 1..5, level 1..20 (linear).
// Casa 1: 19→17 min, Casa 2: 16→14, Casa 3: 13→11, Casa 4: 10→8, Casa 5: 7→5.
export const HOUSES = [
  { name: 'Casa I (Incomum)', minutesLvl1: 19, minutesLvl20: 17 },
  { name: 'Casa II (Raro)', minutesLvl1: 16, minutesLvl20: 14 },
  { name: 'Casa III (Épico)', minutesLvl1: 13, minutesLvl20: 11 },
  { name: 'Casa IV (Lendária)', minutesLvl1: 10, minutesLvl20: 8 },
  { name: 'Casa V (Mítico)', minutesLvl1: 7, minutesLvl20: 5 },
] as const;

export function houseRestSeconds(houseIndex: number, level: number): number {
  const house = HOUSES[houseIndex];
  const mins = house.minutesLvl1 + ((house.minutesLvl20 - house.minutesLvl1) * (level - 1)) / 19;
  return Math.round(mins * 60);
}

/**
 * A full 0 → 100% House fill in seconds, preferring the save's own `casa.cycle_secs` over the
 * {@link HOUSES} table.
 *
 * The table above is a RECONSTRUCTION (whole-minute endpoints, linearly interpolated, rounded to
 * the second); the save carries the number the client actually counts down. They disagree, and the
 * table runs fast: `houseRestSeconds(0, 11)` is `1077`s against a measured `casa.cycle_secs` of
 * `1168.42` on account 486 — the table is ~7.8% short, which inflates every duty cycle derived
 * from it. Where the save says, the save wins; {@link houseRestSeconds} is the fallback for
 * payloads that predate the key (and for hand-built accounts / UI-entered house pickers, which
 * have no captured cycle at all).
 *
 * Total by construction: a non-finite or non-positive `cycleSecs` (absent key, `null`, `0`, a
 * string that slipped through a boundary) degrades to the table rather than poisoning every
 * downstream uptime with `NaN`.
 *
 * `cycleSecs` IS SCOPED TO ONE (house, level) PAIR — the save carries a single countdown, for
 * whichever House the account had active at whichever level it was at when captured. It says
 * nothing about any other house or level. `cycleSecsHouseIndex`/`cycleSecsLevel` name that pair
 * (typically `casa.active_casa - 1` / `casa.levels[active_casa - 1]`); `cycleSecs` is trusted only
 * when the requested `houseIndex`/`level` equal it exactly, otherwise this falls back to the
 * {@link HOUSES} table so a House or House-level picker that has moved away from the account's own
 * configuration actually changes the number (a picker that kept returning the frozen save figure
 * regardless of the requested house/level was the regression this comparison closes).
 *
 * Both anchor params are OPTIONAL and, left unsupplied (`undefined`, the old 3-arg call shape),
 * this keeps its pre-existing behaviour: trust `cycleSecs` unconditionally whenever positive. That
 * is still correct for every caller that has no independent picker to diverge from the import —
 * i.e. every caller outside the web planner's account store — so this default does not need those
 * call sites to thread an anchor they cannot get out of sync with. Passing an anchor (even
 * explicitly `null`, meaning "no recorded anchor") activates the comparison.
 */
export function resolveHouseRestSeconds(
  cycleSecs: number | null | undefined,
  houseIndex: number,
  level: number,
  cycleSecsHouseIndex?: number | null,
  cycleSecsLevel?: number | null,
): number {
  if (typeof cycleSecs !== 'number' || !Number.isFinite(cycleSecs) || cycleSecs <= 0) {
    return houseRestSeconds(houseIndex, level);
  }
  const anchorSupplied = cycleSecsHouseIndex !== undefined || cycleSecsLevel !== undefined;
  if (anchorSupplied && (cycleSecsHouseIndex !== houseIndex || cycleSecsLevel !== level)) {
    return houseRestSeconds(houseIndex, level);
  }
  return cycleSecs;
}

/** Whole minutes + remainder seconds from `houseRestSeconds` (for chrome hints). */
export function splitHouseRest(totalSeconds: number): { minutes: number; seconds: number } {
  const clampedSeconds = Math.max(0, Math.round(totalSeconds));
  return { minutes: Math.floor(clampedSeconds / 60), seconds: clampedSeconds % 60 };
}
