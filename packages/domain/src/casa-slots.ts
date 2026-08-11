/** Casa field-slot count resolved from a save `casa` block (RGO-3, ASM-S02). */

export const CASA_SLOTS_PER_HOUSE = [3, 6, 9, 9, 9] as const;

/** Casa III+ default when neither `casa.slots` nor `slots_per_house[houseIdx]` applies. */
export const DEFAULT_CASA_SLOTS = 9;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clampSlots(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.round(value);
}

/**
 * Three-tier ladder: `casa.slots` → `casa.slots_per_house[houseIdx]` → {@link DEFAULT_CASA_SLOTS}.
 * Result is always a finite integer >= 1.
 */
export function resolveCasaSlots(casa: unknown, houseIdx: number | null): number {
  if (isObject(casa)) {
    if ('slots' in casa) {
      const raw = casa.slots;
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        return clampSlots(raw);
      }
    }

    const perHouse = Array.isArray(casa.slots_per_house) ? casa.slots_per_house : null;
    if (perHouse && houseIdx != null && houseIdx >= 0 && houseIdx < perHouse.length) {
      const tier = asNumber(perHouse[houseIdx], Number.NaN);
      if (Number.isFinite(tier) && tier > 0) {
        return clampSlots(tier);
      }
    }
  }

  return clampSlots(DEFAULT_CASA_SLOTS);
}
