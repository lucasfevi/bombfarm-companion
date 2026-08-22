import { describe, expect, it } from 'vitest';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';
import {
  CASA_SLOTS_PER_HOUSE,
  DEFAULT_CASA_SLOTS,
  resolveCasaSlots,
} from '@bombfarm/domain/casa-slots';

describe('resolveCasaSlots', () => {
  it('exports the evidenced per-house ladder and Casa III+ default', () => {
    expect(CASA_SLOTS_PER_HOUSE).toEqual([3, 5, 7, 9, 9]);
    expect(DEFAULT_CASA_SLOTS).toBe(9);
  });

  it('returns casa.slots when present on the real fixture', () => {
    // MP5 F1 (AD-068 class (a) — read from the capture): re-pointed onto the post-patch
    // export. `casa.active_casa: 1` (0-based houseIdx 0), `casa.slots: 3`.
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const casa = (raw as { casa: unknown }).casa;
    expect(resolveCasaSlots(casa, 0)).toBe(3);
  });

  it('returns DEFAULT_CASA_SLOTS for an empty casa object', () => {
    expect(resolveCasaSlots({}, null)).toBe(9);
  });

  it('prefers casa.slots over slots_per_house', () => {
    expect(
      resolveCasaSlots({ slots: 6, slots_per_house: [3, 6, 9, 9, 9] }, 2),
    ).toBe(6);
  });

  it('falls back to slots_per_house[houseIdx] when slots is absent', () => {
    expect(resolveCasaSlots({ slots_per_house: [3, 6, 9, 9, 9] }, 0)).toBe(3);
    expect(resolveCasaSlots({ slots_per_house: [3, 6, 9, 9, 9] }, 4)).toBe(9);
  });

  it('falls back to DEFAULT_CASA_SLOTS when both slots and per-house tier are absent', () => {
    expect(resolveCasaSlots({ active_casa: 2 }, null)).toBe(9);
  });

  it('ignores houseIdx when casa is not an object', () => {
    expect(resolveCasaSlots(null, 1)).toBe(9);
    expect(resolveCasaSlots(undefined, 2)).toBe(9);
  });

  it('clamps zero, negative, and non-finite slots to 1', () => {
    expect(resolveCasaSlots({ slots: 0 }, null)).toBe(1);
    expect(resolveCasaSlots({ slots: -3 }, null)).toBe(1);
    expect(resolveCasaSlots({ slots: Number.NaN }, null)).toBe(9);
  });
});
