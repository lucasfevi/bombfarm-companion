/**
 * Constants, provenance and store-agnosticism.
 *
 * A source scan over `src/farm-rate.ts` for forbidden literals (every wiki-tunable number must
 * come from a named import), plus value assertions that the two derived constants and
 * `returnBonusMultiplier` equal the bundle's own numbers.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CYCLE_LATENCY_SEC,
  cycleSecondsForHero,
  FORTUNA_AURA_CAP,
  HOP1_CYCLE_SEC,
  HOP_DISTRIBUTION,
  returnBonusMultiplier,
} from '@bombfarm/domain/farm-rate';
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
    //
    // HOP_DISTRIBUTION's array literal is stripped for the same reason `farm-optimize-guards`
    // strips its plateau share-grid: it is a measured calibration table, so its 26 probabilities
    // ARE the data rather than a retyped wiki constant. Several of them ("0.00151", "0.0015")
    // contain forbidden strings as substrings, which is a collision, not a violation. Only the
    // literal is exempt — everything else in this file is still scanned.
    const withoutHopTable = source.replace(
      /export const HOP_DISTRIBUTION[\s\S]*?\]\);/,
      'export const HOP_DISTRIBUTION = [];',
    );
    const codeOnly = withoutHopTable
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

describe('HOP_DISTRIBUTION — provenance-carrying, and a distribution rather than a mean', () => {
  it('is a normalised probability mass function over hops 0..25', () => {
    expect(HOP_DISTRIBUTION.length).toBe(26);
    for (const p of HOP_DISTRIBUTION) expect(p).toBeGreaterThanOrEqual(0);
    expect(HOP_DISTRIBUTION.reduce((s, p) => s + p, 0)).toBeCloseTo(1, 3);
  });

  it('is frozen — a shipped calibration, not a scratch array', () => {
    expect(Object.isFrozen(HOP_DISTRIBUTION)).toBe(true);
  });

  it('has a mean hop of ~4.77 and a tail that a mean would discard', () => {
    const meanHop = HOP_DISTRIBUTION.reduce((s, p, hop) => s + p * hop, 0);
    expect(meanHop).toBeCloseTo(4.77, 1);
    // The retired E_D_CELLS was 4.5, i.e. the old constant was barely wrong about the MEAN.
    // What it could not represent is this tail, which is where the missing cycle time lives.
    const tail = HOP_DISTRIBUTION.slice(15).reduce((s, p) => s + p, 0);
    expect(tail).toBeGreaterThan(0.02);
  });

  it('its JSDoc carries the capture provenance and the Jensen reason for being a distribution', () => {
    const source = loadSource();
    if (!source) return;
    const docBlock = source.slice(0, source.indexOf('export const HOP_DISTRIBUTION'));
    expect(docBlock).toMatch(/capture-486-r3/i);
    expect(docBlock).toMatch(/jensen/i);
    expect(docBlock).toMatch(/KNOWN LIMITATION/i);
  });
});

describe('cycleSecondsForHero — averages max() over the distribution, never max() of the mean', () => {
  it('exceeds max(fuse, meanHop/w) for a walk-bound hero — the Jensen gap this fix exists to close', () => {
    const fuse = 1.972;
    const w = 2.0721; // Jon, the fastest hero on the 486 anchor
    const meanHop = HOP_DISTRIBUTION.reduce((s, p, hop) => s + p * hop, 0);
    const collapsedFirst = Math.max(fuse, meanHop / w);
    expect(cycleSecondsForHero(fuse, w)).toBeGreaterThan(collapsedFirst);
  });

  it('is monotonically non-increasing in walk speed', () => {
    const fuse = 1.972;
    let previous = Infinity;
    for (const w of [0.5, 1, 1.5, 2, 3, 6, 12]) {
      const cycle = cycleSecondsForHero(fuse, w);
      expect(cycle).toBeLessThanOrEqual(previous);
      previous = cycle;
    }
  });

  it('floors at the fuse-bound branch: an arbitrarily fast hero still pays fuse + latency, weighted', () => {
    const fuse = 1.972;
    const infinitelyFast = cycleSecondsForHero(fuse, 1e9);
    // Weighted with the table's OWN masses rather than `1 - hop1Share`: the shipped
    // probabilities are rounded to 5dp and sum to 0.99999, not exactly 1, and assuming otherwise
    // makes this assertion fail on a rounding artifact instead of on a behaviour change.
    const expected = HOP_DISTRIBUTION.reduce(
      (sum, p, hop) => sum + p * (hop <= 1 ? HOP1_CYCLE_SEC : fuse + CYCLE_LATENCY_SEC),
      0,
    );
    expect(infinitelyFast).toBeCloseTo(expected, 9);
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
