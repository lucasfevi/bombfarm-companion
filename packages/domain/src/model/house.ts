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
 */
export function resolveHouseRestSeconds(
  cycleSecs: number | null | undefined,
  houseIndex: number,
  level: number,
): number {
  if (typeof cycleSecs === 'number' && Number.isFinite(cycleSecs) && cycleSecs > 0) return cycleSecs;
  return houseRestSeconds(houseIndex, level);
}

/** Whole minutes + remainder seconds from `houseRestSeconds` (for chrome hints). */
export function splitHouseRest(totalSeconds: number): { minutes: number; seconds: number } {
  const clampedSeconds = Math.max(0, Math.round(totalSeconds));
  return { minutes: Math.floor(clampedSeconds / 60), seconds: clampedSeconds % 60 };
}
