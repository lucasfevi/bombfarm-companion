import { describe, expect, it } from 'vitest';
import { activeDps, fieldSeconds, fieldTimeInWindow, gateDamage, windowedDamage, POINT_GAIN, type Context, type HeroSheet } from '@bombfarm/domain/model';

const context = (): Context => ({
  restSeconds: 60,
  mitigation: 0.05,
  blastRange: 1,
  ato: 1,
  drainMult: 1,
});

const hero = (): HeroSheet => ({
  rarity: 'Raro',
  attack: 400,
  energy: 400,
  speed: 55,
  critChance: 12,
  critDmg: 80,
  penetration: 8,
  cdr: 10,
  attackPerPoint: POINT_GAIN.attackNative,
  energyPerPoint: POINT_GAIN.energyNative,
});

describe('fieldTimeInWindow', () => {
  it('does not grow once field time already covers the window', () => {
    expect(fieldTimeInWindow(70, 60, 60)).toBe(60);
    expect(fieldTimeInWindow(80, 60, 60)).toBe(60);
    expect(windowedDamage(10, 80, 0, 60)).toBe(windowedDamage(10, 70, 0, 60));
  });

  it('credits only the seconds that fall inside T when field grows from 40 to 80', () => {
    expect(fieldTimeInWindow(40, 0, 60)).toBe(40);
    expect(fieldTimeInWindow(80, 0, 60)).toBe(60);
    expect(windowedDamage(5, 80, 0, 60) - windowedDamage(5, 40, 0, 60)).toBe(5 * 20);
  });

  it('gets more than one stint in a 600s window with field 120s and rest 60s', () => {
    const oneStint = fieldTimeInWindow(120, 60, 120);
    const windowed = fieldTimeInWindow(120, 60, 600);
    expect(oneStint).toBe(120);
    expect(windowed).toBeGreaterThan(120);
    expect(windowed).toBe(3 * 120 + 60);
  });

  it('matches gateDamage when rest is 0', () => {
    const sheet = hero();
    const ctx = { ...context(), restSeconds: 0 };
    const field = fieldSeconds(sheet, ctx);
    expect(windowedDamage(activeDps(sheet, ctx), field, 0, 90)).toBe(gateDamage(sheet, ctx, 90));
    expect(windowedDamage(activeDps(sheet, ctx), field, 0, 10_000)).toBe(gateDamage(sheet, ctx, 10_000));
  });
});
