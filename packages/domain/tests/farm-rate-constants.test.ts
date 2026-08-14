/**
 * PFR item B, T10 (`R-B3`, `R-B17`, `R-B19`) — constants, provenance and store-agnosticism.
 *
 * A source scan over `src/farm-rate.ts` for forbidden literals (every wiki-tunable number must
 * come from a named import), plus value assertions that the two derived constants and
 * `returnBonusMultiplier` equal the bundle's own numbers.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  E_D_CELLS,
  FORTUNA_AURA_CAP,
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

describe('store-agnosticism (R-B19) — no framework, storage or clock/randomness import', () => {
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

describe('forbidden-literal scan (R-B17, spec.md P2-2) — wiki-tunable numbers must come from an import', () => {
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

describe('E_D_CELLS — provenance-carrying, provisional (R-B3, spec.md P2-2 AC-2)', () => {
  it('equals 4.5 and its JSDoc names COMBAT_THROUGHPUT.md, "provisional", and OQ-PFR-1', () => {
    expect(E_D_CELLS).toBe(4.5);
    const source = loadSource();
    if (!source) return;
    const docBlock = source.slice(0, source.indexOf('export const E_D_CELLS'));
    expect(docBlock).toMatch(/COMBAT_THROUGHPUT\.md/);
    expect(docBlock).toMatch(/PROVISIONAL/i);
    expect(docBlock).toMatch(/OQ-PFR-1/);
  });
});

describe('FORTUNA_AURA_CAP — derived from the bundle, not typed (R-B17)', () => {
  it('equals LOOT_ABILITY_VALUES.fortuna.perLevel × .max exactly', () => {
    expect(FORTUNA_AURA_CAP).toBe(LOOT_ABILITY_VALUES.fortuna.perLevel * LOOT_ABILITY_VALUES.fortuna.max);
    expect(FORTUNA_AURA_CAP).toBe(0.1);
  });
});

describe('returnBonusMultiplier — total function over ReturnBonusMode (R-B11)', () => {
  it("'off' -> 1, 'on' -> 1 + RETURN_BONUS_ADD, 'vip' -> 1 + RETURN_BONUS_ADD_VIP", () => {
    expect(returnBonusMultiplier('off')).toBe(1);
    expect(returnBonusMultiplier('on')).toBe(1 + RETURN_BONUS_ADD);
    expect(returnBonusMultiplier('vip')).toBe(1 + RETURN_BONUS_ADD_VIP);
  });
});
