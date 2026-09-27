/**
 * Constants, provenance and store-agnosticism.
 *
 * A source scan over `src/farm-rate.ts` for forbidden literals (every wiki-tunable number must
 * come from a named import), the shape of the shared plant cycle, plus value assertions that the
 * derived constants and `returnBonusMultiplier` equal the bundle's own numbers.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cycleSecondsForHero, FORTUNA_AURA_CAP, returnBonusMultiplier } from '@bombfarm/domain/farm-rate';
import {
  FREE_HOP_SHAPE,
  FUSE_CYCLE_OVERHEAD_SEC,
  freeHopCells,
  hopSpeedFactor,
  meanPlantCycleSeconds,
  plantCycleSeconds,
} from '@bombfarm/domain/model';
import { RETURN_BONUS_ADD, RETURN_BONUS_ADD_VIP, LOOT_ABILITY_VALUES } from '@bombfarm/domain/phase-wiki';
import { requireFixture } from './helpers/require-fixture';

const DOMAIN_ROOT = join(__dirname, '..');
const FARM_RATE_SRC = join(DOMAIN_ROOT, 'src', 'farm-rate.ts');

function loadSource(): string | null {
  if (!requireFixture(FARM_RATE_SRC, 'farm-rate.ts source scan')) return null;
  return readFileSync(FARM_RATE_SRC, 'utf8');
}

describe('store-agnosticism — no framework, storage or clock/randomness import', () => {
  it('the source contains no zustand, react, localStorage, electron-log, Date.now, Math.random, or apps/ path', () => {
    const source = loadSource();
    if (!source) return;
    expect(source).not.toMatch(/zustand/);
    expect(source).not.toMatch(/\breact\b/i);
    expect(source).not.toMatch(/localStorage/);
    expect(source).not.toMatch(/electron-log/);
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/apps\//);
  });
});

describe('forbidden-literal scan — wiki-tunable numbers must come from an import', () => {
  it('does not retype the drop-rate / key-cost / return-bonus / loot-ability / GRID_SPEED_COEF literals', () => {
    const source = loadSource();
    if (!source) return;

    // Strip import statements and comments before scanning — the point is to catch a VALUE
    // used in an EXPRESSION, not the identifier names or documentation that legitimately name
    // these figures (e.g. this file's own JSDoc, which quotes them for provenance).
    const codeOnly = source
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith('import') && !trimmed.startsWith('*') && !trimmed.startsWith('//') && !trimmed.startsWith('/**');
      })
      .join('\n');

    const forbidden = ['0.0386', '0.001', '0.00005', '0.0015', '0.4', '0.8', '0.02', '0.005', '0.10'];
    for (const literal of forbidden) {
      expect(codeOnly.includes(literal), `forbidden literal "${literal}" found in farm-rate.ts code`).toBe(false);
    }
    // EFF_IA (0.9) as a bare multiplication factor — imported, never retyped as `* 0.9`.
    expect(codeOnly).not.toMatch(/\*\s*0\.9\b/);
    expect(codeOnly).not.toMatch(/0\.9\s*\*/);
  });
});

describe('FREE_HOP_SHAPE — a spread around the density mean, not a second mean', () => {
  it('is ten ascending, frozen multipliers averaging 1', () => {
    expect(FREE_HOP_SHAPE).toHaveLength(10);
    expect(Object.isFrozen(FREE_HOP_SHAPE)).toBe(true);
    for (let i = 1; i < FREE_HOP_SHAPE.length; i++) expect(FREE_HOP_SHAPE[i]).toBeGreaterThan(FREE_HOP_SHAPE[i - 1]);
    expect(FREE_HOP_SHAPE.reduce((sum, m) => sum + m, 0) / FREE_HOP_SHAPE.length).toBeCloseTo(1, 2);
  });

  it('prices a hero whose walk straddles the fuse slower than the cycle of the mean hop — max() is convex', () => {
    const fuse = 1.3;
    const w = 3;
    const meanHop = freeHopCells(40) * hopSpeedFactor(w);
    expect(meanPlantCycleSeconds(fuse, w, freeHopCells(40))).toBeGreaterThan(plantCycleSeconds(fuse, w, meanHop));
  });

  it('shortens the free hop as the map fills and lengthens it for a faster hero', () => {
    expect(freeHopCells(90)).toBeLessThan(freeHopCells(10));
    expect(hopSpeedFactor(5)).toBeGreaterThan(hopSpeedFactor(2.5));
    expect(hopSpeedFactor(3)).toBe(1);
  });
});

describe('cycleSecondsForHero — seconds per bomb over a whole clear of the band', () => {
  it('is monotonically non-increasing in walk speed', () => {
    const fuse = 1.972;
    let previous = Infinity;
    for (const w of [0.5, 1, 1.5, 2, 3, 6, 12]) {
      const cycle = cycleSecondsForHero(fuse, w);
      expect(cycle).toBeLessThanOrEqual(previous);
      previous = cycle;
    }
  });

  it('pays for every step of cooldown down to the cap, because short hops stay fuse-bound', () => {
    let previous = Infinity;
    for (const fuse of [2, 1.6, 1.2, 0.8, 0.4]) {
      const cycle = cycleSecondsForHero(fuse, 3.4, 3);
      expect(cycle).toBeLessThan(previous);
      previous = cycle;
    }
  });

  it('never beats the fuse-bound floor, and runs slower than the steady cycle — the head and the starved tail plant nothing', () => {
    const fuse = 1.972;
    expect(cycleSecondsForHero(fuse, 1e9)).toBeGreaterThan(fuse + FUSE_CYCLE_OVERHEAD_SEC);
    expect(cycleSecondsForHero(fuse, 3, 3)).toBeGreaterThan(meanPlantCycleSeconds(fuse, 3, freeHopCells(100)));
  });

  it('plants faster on a denser band', () => {
    expect(cycleSecondsForHero(1.8, 3, 5)).toBeLessThan(cycleSecondsForHero(1.8, 3, 1));
  });

  it('w <= 0 or non-finite ⇒ Infinity, so a degenerate hero contributes zero rather than dividing by zero', () => {
    expect(cycleSecondsForHero(2, 0)).toBe(Infinity);
    expect(cycleSecondsForHero(2, -1)).toBe(Infinity);
    expect(cycleSecondsForHero(2, Number.NaN)).toBe(Infinity);
    expect(cycleSecondsForHero(2, Number.POSITIVE_INFINITY)).toBe(Infinity);
  });
});

describe('FORTUNA_AURA_CAP — derived from the bundle, not typed', () => {
  it('equals LOOT_ABILITY_VALUES.fortuna.perLevel × .max exactly', () => {
    expect(FORTUNA_AURA_CAP).toBe(LOOT_ABILITY_VALUES.fortuna.perLevel * LOOT_ABILITY_VALUES.fortuna.max);
    expect(FORTUNA_AURA_CAP).toBe(0.1);
  });
});

describe('returnBonusMultiplier — total function over ReturnBonusMode', () => {
  it("'off' -> 1, 'on' -> 1 + RETURN_BONUS_ADD, 'vip' -> 1 + RETURN_BONUS_ADD_VIP", () => {
    expect(returnBonusMultiplier('off')).toBe(1);
    expect(returnBonusMultiplier('on')).toBe(1 + RETURN_BONUS_ADD);
    expect(returnBonusMultiplier('vip')).toBe(1 + RETURN_BONUS_ADD_VIP);
  });
});
