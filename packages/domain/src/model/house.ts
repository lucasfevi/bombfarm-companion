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

/** Whole minutes + remainder seconds from `houseRestSeconds` (for chrome hints). */
export function splitHouseRest(totalSeconds: number): { minutes: number; seconds: number } {
  const clampedSeconds = Math.max(0, Math.round(totalSeconds));
  return { minutes: Math.floor(clampedSeconds / 60), seconds: clampedSeconds % 60 };
}
