import { describe, expect, it } from 'vitest';
import { COLLECTION_AXES } from '@bombfarm/contracts';
import { axisColourStyle, COLLECTION_AXIS_COLOUR } from './collections-axis-colour';

describe('COLLECTION_AXIS_COLOUR', () => {
  it('has a colour for each of the ten axes', () => {
    expect(Object.keys(COLLECTION_AXIS_COLOUR).sort()).toEqual([...COLLECTION_AXES].sort());
  });

  it('gives every axis a different colour', () => {
    expect(new Set(Object.values(COLLECTION_AXIS_COLOUR)).size).toBe(10);
  });

  it('writes each as an oklch colour or a design-system token, never a hex literal', () => {
    for (const colour of Object.values(COLLECTION_AXIS_COLOUR)) expect(colour).toMatch(/^(oklch\(\d+% [\d.]+ \d+\)|var\(--[a-z-]+\))$/);
  });

  it('keeps every oklch colour in the skill tree’s lightness band, so none reads brighter or darker than the arms', () => {
    for (const colour of Object.values(COLLECTION_AXIS_COLOUR)) {
      const lightness = /^oklch\((\d+)%/.exec(colour)?.[1];
      if (lightness !== undefined) expect(Number(lightness)).toBeGreaterThanOrEqual(70);
      if (lightness !== undefined) expect(Number(lightness)).toBeLessThanOrEqual(82);
    }
  });

  it('keeps the two crit axes close kin and clear of damage', () => {
    const hue = (colour: string) => Number(/ (\d+)\)$/.exec(colour)?.[1]);
    const critDamage = hue(COLLECTION_AXIS_COLOUR.critDamage);
    const critChance = hue(COLLECTION_AXIS_COLOUR.critChance);
    const apart = Math.min(Math.abs(critDamage - critChance), 360 - Math.abs(critDamage - critChance));
    expect(apart).toBeGreaterThan(0);
    expect(apart).toBeLessThan(40);
    const fromDamage = Math.abs(critChance - hue(COLLECTION_AXIS_COLOUR.damage));
    expect(fromDamage).toBeGreaterThanOrEqual(15);
  });

  it('keeps gold as the wallet’s gold', () => {
    expect(COLLECTION_AXIS_COLOUR.gold).toBe('var(--gold)');
  });
});

describe('axisColourStyle', () => {
  it('exposes the axis hue as the --axis-colour custom property', () => {
    expect(axisColourStyle('luck')).toEqual({ '--axis-colour': COLLECTION_AXIS_COLOUR.luck });
  });
});
