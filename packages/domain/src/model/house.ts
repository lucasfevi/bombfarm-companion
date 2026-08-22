/**
 * House recovery cycle in seconds: Casa 1..5, level 1..20, linear between the level-1 and
 * level-20 endpoints.
 *
 * Endpoints are the wiki's `rotacao.casas[].cycle_secs_base` / `cycle_secs_max`. They are exact
 * seconds, not a whole-minute reconstruction: interpolating them reproduces a captured
 * `casa.cycle_secs` of `1168.42`s (Casa I level 11) to the rounded second.
 */
export const HOUSES = [
  { name: 'Casa I (Incomum)', cycleSecsLvl1: 1200, cycleSecsLvl20: 1140 },
  { name: 'Casa II (Raro)', cycleSecsLvl1: 1080, cycleSecsLvl20: 1020 },
  { name: 'Casa III (Épico)', cycleSecsLvl1: 960, cycleSecsLvl20: 900 },
  { name: 'Casa IV (Lendária)', cycleSecsLvl1: 840, cycleSecsLvl20: 780 },
  { name: 'Casa V (Mítico)', cycleSecsLvl1: 660, cycleSecsLvl20: 600 },
] as const;

export function houseRestSeconds(houseIndex: number, level: number): number {
  const house = HOUSES[houseIndex];
  const secs =
    house.cycleSecsLvl1 + ((house.cycleSecsLvl20 - house.cycleSecsLvl1) * (level - 1)) / 19;
  return Math.round(secs);
}

/**
 * A full 0 → 100% House fill in seconds, preferring the save's own `casa.cycle_secs` over the
 * {@link HOUSES} table.
 *
 * The save carries the number the client actually counts down, at sub-second precision; the table
 * agrees with it to the rounded second and is the fallback for payloads that predate the key (and
 * for hand-built accounts / UI-entered house pickers, which have no captured cycle at all).
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
 * call sites to thread an anchor they cannot get out of sync with.
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
