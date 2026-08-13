import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AccountPayload } from '@bombfarm/contracts';
import type { AccountImportData, ImportCandidate, ParseResult } from '@bombfarm/domain/import-save';
import { emptyLoadout, type SheetStats } from '@bombfarm/domain/gear';
import { SHEET_KEYS, ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';
import { describe, expect, it, vi } from 'vitest';
import { compareAccountResults, compareRawAccountFields } from './helpers/fidelity-compare';
import { SHEET_ABS_TOL } from './helpers/sheet-math-fixtures';
import { FidelityGateError } from './helpers/fidelity-gate-error';

const SHEET_BLOCKS = ['naked', 'gearedOverride', 'birth'] as const;

function zeroSheet(overrides: Partial<SheetStats> = {}): SheetStats {
  return { attack: 100, energy: 50, speed: 20, critChance: 5, critDmg: 10, penetration: 1, cdr: 2, luck: 0.5, ...overrides };
}

function makeCandidate(
  sourceId: string,
  name: string,
  recordOverrides: Partial<ImportCandidate['record']> = {},
): ImportCandidate {
  const record: ImportCandidate['record'] = {
    name,
    rarity: 'Raro',
    level: 10,
    stars: 0,
    naked: zeroSheet(),
    loadout: emptyLoadout(),
    altLoadout: null,
    gearedOverride: zeroSheet(),
    abilities: {},
    pts: ZERO_PTS(),
    statPointsAvailable: 0,
    sourceId,
    rank: undefined,
    power: undefined,
    deployed: false,
    battleAllowed: true,
    skin: 0,
    birth: zeroSheet(),
    ...recordOverrides,
  };
  return {
    sourceId,
    name,
    level: record.level,
    rarity: record.rarity,
    rank: null,
    power: 0,
    abilityCount: 0,
    gearCount: 0,
    record,
    matchedExistingId: null,
    matchedExistingName: null,
    isGearRefresh: false,
    issues: [],
    pointIssues: [],
    blocked: false,
  };
}

function makeAccount(overrides: Partial<AccountImportData> = {}): AccountImportData {
  return {
    tree: {
      danoTotal: 1,
      critChance: 0,
      critDmg: 0,
      speed: 0,
      energy: 0,
      glassCannon: false,
      tempoDobrado: false,
      critDmgMult: 2,
      teamCoinPct: 0,
      luckFlatPct: 3,
    },
    houseIdx: 1,
    houseLevel: 4,
    slots: 9,
    phase: 60,
    ...overrides,
  };
}

function makeResult(overrides: Partial<ParseResult> = {}): ParseResult {
  return {
    candidates: [makeCandidate('hero-1', 'Alpha')],
    warnings: [],
    account: makeAccount(),
    inventory: [],
    rejected: null,
    ...overrides,
  };
}

function expectFidelityError(fn: () => unknown, code: string): FidelityGateError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(FidelityGateError);
    expect((err as FidelityGateError).code).toBe(code);
    return err as FidelityGateError;
  }
  throw new Error(`expected fn to throw FidelityGateError(${code}), but it did not throw`);
}

describe('compareAccountResults — ordering (rejection -> roster -> per-hero -> account)', () => {
  it('throws parseRejected before roster membership is ever checked, when the live side is rejected', () => {
    const live = makeResult({
      candidates: [],
      rejected: { reason: 'notASaveFile', heroNames: [] },
    });
    // Roster would also mismatch (export has a hero, live has none) — rejection must win.
    const exported = makeResult({ candidates: [makeCandidate('hero-x', 'Beta')] });
    const err = expectFidelityError(() => compareAccountResults(live, exported), 'parseRejected');
    expect(err.message).toContain('live');
    expect(err.message).toContain('notASaveFile');
  });

  it('throws parseRejected naming the export side when it is rejected', () => {
    const live = makeResult();
    const exported = makeResult({ rejected: { reason: 'missingBirthStats', heroNames: ['Alpha'] } });
    const err = expectFidelityError(() => compareAccountResults(live, exported), 'parseRejected');
    expect(err.message).toContain('export');
    expect(err.message).toContain('missingBirthStats');
    expect(err.message).toContain('Alpha');
  });

  it('a roster mismatch calls onHeroCompared zero times', () => {
    const onHeroCompared = vi.fn();
    const live = makeResult({ candidates: [makeCandidate('hero-1', 'Alpha')] });
    const exported = makeResult({ candidates: [makeCandidate('hero-2', 'Beta')] });
    expectFidelityError(() => compareAccountResults(live, exported, { onHeroCompared }), 'rosterMismatch');
    expect(onHeroCompared).not.toHaveBeenCalled();
  });

  it('per-hero comparison runs before account-level comparison — an account mismatch on a passing roster still throws accountMismatch', () => {
    const live = makeResult({ account: makeAccount({ houseIdx: 2 }) });
    const exported = makeResult({ account: makeAccount({ houseIdx: 1 }) });
    expectFidelityError(() => compareAccountResults(live, exported), 'accountMismatch');
  });

  it('the committed happy path (identical live/export) passes and calls onHeroCompared once per hero', () => {
    const onHeroCompared = vi.fn();
    const live = makeResult({ candidates: [makeCandidate('hero-1', 'Alpha'), makeCandidate('hero-2', 'Beta')] });
    const exported = makeResult({ candidates: [makeCandidate('hero-1', 'Alpha'), makeCandidate('hero-2', 'Beta')] });
    const counts = compareAccountResults(live, exported, { onHeroCompared });
    expect(counts.heroesCompared).toBe(2);
    expect(onHeroCompared).toHaveBeenCalledTimes(2);
    expect(onHeroCompared).toHaveBeenCalledWith('hero-1');
    expect(onHeroCompared).toHaveBeenCalledWith('hero-2');
  });
});

describe('compareAccountResults — per-hero sheet compare (FID-01, FID-03)', () => {
  for (const block of SHEET_BLOCKS) {
    for (const key of SHEET_KEYS as readonly SheetKey[]) {
      it(`${block}.${key}: a delta exactly at SHEET_ABS_TOL passes; one increment beyond fails`, () => {
        const tol = SHEET_ABS_TOL[key];
        const base = zeroSheet();

        // Subtracting from zero is exact in IEEE-754 double math, so these deltas are exactly
        // `tol` and exactly `2 * tol` respectively — no floating-point boundary flakiness.
        const atTolLive = makeCandidate('hero-1', 'Alpha', { [block]: { ...base, [key]: tol } });
        const atTolExport = makeCandidate('hero-1', 'Alpha', { [block]: { ...base, [key]: 0 } });
        expect(() =>
          compareAccountResults(makeResult({ candidates: [atTolLive] }), makeResult({ candidates: [atTolExport] })),
        ).not.toThrow();

        const beyondLive = makeCandidate('hero-1', 'Alpha', { [block]: { ...base, [key]: tol * 2 } });
        const beyondExport = makeCandidate('hero-1', 'Alpha', { [block]: { ...base, [key]: 0 } });
        expectFidelityError(
          () => compareAccountResults(makeResult({ candidates: [beyondLive] }), makeResult({ candidates: [beyondExport] })),
          'heroStatMismatch',
        );
      });
    }
  }

  it('heroStatMismatch names the hero, sourceId, sheet block, stat key, both values, delta and tolerance as separate substrings', () => {
    const tol = SHEET_ABS_TOL.attack;
    const liveValue = 200;
    const exportValue = 200 - tol * 5;
    const delta = Math.abs(liveValue - exportValue); // computed the same way the comparator computes it
    const live = makeCandidate('hero-42', 'Zeta', { naked: { ...zeroSheet(), attack: liveValue } });
    const exported = makeCandidate('hero-42', 'Zeta', { naked: { ...zeroSheet(), attack: exportValue } });
    const err = expectFidelityError(
      () => compareAccountResults(makeResult({ candidates: [live] }), makeResult({ candidates: [exported] })),
      'heroStatMismatch',
    );
    expect(err.message).toContain('Zeta');
    expect(err.message).toContain('hero-42');
    expect(err.message).toContain('naked');
    expect(err.message).toContain('attack');
    expect(err.message).toContain(String(liveValue));
    expect(err.message).toContain(String(exportValue));
    expect(err.message).toContain(String(delta));
    expect(err.message).toContain(String(tol));
  });
});

describe('compareAccountResults — non-sheet exact hero fields (design TD-4)', () => {
  const cases: Array<[string, Partial<ImportCandidate['record']>, Partial<ImportCandidate['record']>]> = [
    ['level', { level: 10 }, { level: 11 }],
    ['stars', { stars: 0 }, { stars: 1 }],
    ['rarity', { rarity: 'Raro' }, { rarity: 'Épico' }],
    ['pts', { pts: ZERO_PTS() }, { pts: { ...ZERO_PTS(), attack: 3 } }],
    [
      'loadout',
      { loadout: emptyLoadout() },
      { loadout: { ...emptyLoadout(), weapon: { defId: 'x', rarityIdx: 0, level: 10, upgrade: 0 } } },
    ],
    ['abilities', { abilities: {} }, { abilities: { a1: 3 } }],
    ['statPointsAvailable', { statPointsAvailable: 0 }, { statPointsAvailable: 5 }],
  ];

  for (const [field, liveOverride, exportOverride] of cases) {
    it(`a mismatched "${field}" fails the gate naming that field`, () => {
      const live = makeCandidate('hero-1', 'Alpha', liveOverride);
      const exported = makeCandidate('hero-1', 'Alpha', exportOverride);
      const err = expectFidelityError(
        () => compareAccountResults(makeResult({ candidates: [live] }), makeResult({ candidates: [exported] })),
        'heroStatMismatch',
      );
      expect(err.message).toContain(field);
    });
  }
});

describe('compareAccountResults — roster membership (FID-04)', () => {
  it('rosterMismatch lists live-only and export-only with name and id, and states recapturing both sides is the fix', () => {
    const live = makeResult({ candidates: [makeCandidate('hero-1', 'Alpha'), makeCandidate('hero-2', 'Beta')] });
    const exported = makeResult({ candidates: [makeCandidate('hero-1', 'Alpha'), makeCandidate('hero-3', 'Gamma')] });
    const err = expectFidelityError(() => compareAccountResults(live, exported), 'rosterMismatch');
    expect(err.message).toContain('live-only');
    expect(err.message).toContain('Beta');
    expect(err.message).toContain('hero-2');
    expect(err.message).toContain('export-only');
    expect(err.message).toContain('Gamma');
    expect(err.message).toContain('hero-3');
    expect(err.message.toLowerCase()).toContain('recapture');
  });
});

describe('compareAccountResults — account-level equality (FID-02, ASM-4)', () => {
  // AD-075 (MP5 F2 T4): re-pointed from the deleted Abisso exponent-base field onto
  // tree.danoTotal, a surviving TreeSheetTotals member. The claim under test ("the comparator
  // names the mismatching path") is unchanged; only the field whose mismatch demonstrates it
  // changed. makeAccount()'s remaining not-yet-deleted members stay until T8, when
  // AccountImportData['tree'] itself stops requiring them — dropping them here first would be
  // a typecheck:tests failure against the still-current (pre-T8) type.
  it('accountMismatch names tree.danoTotal on a mismatch', () => {
    const live = makeResult({ account: makeAccount({ tree: { ...makeAccount().tree!, danoTotal: 1.2 } }) });
    const exported = makeResult({ account: makeAccount({ tree: { ...makeAccount().tree!, danoTotal: 1.3 } }) });
    const err = expectFidelityError(() => compareAccountResults(live, exported), 'accountMismatch');
    expect(err.message).toContain('tree.danoTotal');
  });

  // AD-075 (MP5 F2 T4): re-pointed from tree.critDmgMult onto tree.critChance — a surviving
  // TreeSheetTotals member. See the previous case's comment for why makeAccount() itself is
  // untouched here.
  it('accountMismatch names tree.critChance on a mismatch', () => {
    const live = makeResult({ account: makeAccount({ tree: { ...makeAccount().tree!, critChance: 2 } }) });
    const exported = makeResult({ account: makeAccount({ tree: { ...makeAccount().tree!, critChance: 1 } }) });
    const err = expectFidelityError(() => compareAccountResults(live, exported), 'accountMismatch');
    expect(err.message).toContain('tree.critChance');
  });

  it('accountMismatch names tree.luckFlatPct on a mismatch', () => {
    const live = makeResult({ account: makeAccount({ tree: { ...makeAccount().tree!, luckFlatPct: 3 } }) });
    const exported = makeResult({ account: makeAccount({ tree: { ...makeAccount().tree!, luckFlatPct: 4 } }) });
    const err = expectFidelityError(() => compareAccountResults(live, exported), 'accountMismatch');
    expect(err.message).toContain('tree.luckFlatPct');
  });

  it('accountMismatch names houseIdx on a mismatch', () => {
    const live = makeResult({ account: makeAccount({ houseIdx: 1 }) });
    const exported = makeResult({ account: makeAccount({ houseIdx: 2 }) });
    const err = expectFidelityError(() => compareAccountResults(live, exported), 'accountMismatch');
    expect(err.message).toContain('account.houseIdx');
  });

  it('accountMismatch names houseLevel on a mismatch', () => {
    const live = makeResult({ account: makeAccount({ houseLevel: 4 }) });
    const exported = makeResult({ account: makeAccount({ houseLevel: 5 }) });
    const err = expectFidelityError(() => compareAccountResults(live, exported), 'accountMismatch');
    expect(err.message).toContain('account.houseLevel');
  });

  it('accountMismatch names slots on a mismatch', () => {
    const live = makeResult({ account: makeAccount({ slots: 9 }) });
    const exported = makeResult({ account: makeAccount({ slots: 12 }) });
    const err = expectFidelityError(() => compareAccountResults(live, exported), 'accountMismatch');
    expect(err.message).toContain('account.slots');
  });

  it('accountMismatch names phase on a mismatch', () => {
    const live = makeResult({ account: makeAccount({ phase: 60 }) });
    const exported = makeResult({ account: makeAccount({ phase: 61 }) });
    const err = expectFidelityError(() => compareAccountResults(live, exported), 'accountMismatch');
    expect(err.message).toContain('account.phase');
  });

  it('accountMismatch fires on a warnings order difference (order-sensitive)', () => {
    const live = makeResult({ warnings: ['a', 'b'] });
    const exported = makeResult({ warnings: ['b', 'a'] });
    const err = expectFidelityError(() => compareAccountResults(live, exported), 'accountMismatch');
    expect(err.message).toContain('warnings');
  });

  it('accountMismatch fires on an inventory length difference', () => {
    const live = makeResult({ inventory: [] });
    const exported = makeResult({
      inventory: [
        { id: 'i1', defId: 'd1', rarityIdx: 0, level: 10, upgrade: 0, slot: null, equipped: false, equippedBy: null, defResolved: false, marketBlocked: false },
      ],
    });
    const err = expectFidelityError(() => compareAccountResults(live, exported), 'accountMismatch');
    expect(err.message).toContain('inventory');
  });

  it('accountMismatch fires on a per-item field difference (ASM-4)', () => {
    const item = { id: 'i1', defId: 'd1', rarityIdx: 0, level: 10, upgrade: 0, slot: null, equipped: false, equippedBy: null, defResolved: false, marketBlocked: false };
    const live = makeResult({ inventory: [{ ...item, upgrade: 0 }] });
    const exported = makeResult({ inventory: [{ ...item, upgrade: 5 }] });
    const err = expectFidelityError(() => compareAccountResults(live, exported), 'accountMismatch');
    expect(err.message).toContain('inventory[0]');
  });

  it('a fully-matching pair returns accountFieldsCompared and itemsCompared reflecting real work', () => {
    const item = { id: 'i1', defId: 'd1', rarityIdx: 0, level: 10, upgrade: 0, slot: null, equipped: false, equippedBy: null, defResolved: false, marketBlocked: false };
    const live = makeResult({ inventory: [item] });
    const exported = makeResult({ inventory: [item] });
    const counts = compareAccountResults(live, exported);
    expect(counts.itemsCompared).toBe(1);
    expect(counts.accountFieldsCompared).toBeGreaterThan(0);
  });
});

describe('compareRawAccountFields — raw account sanity beyond ParseResult', () => {
  function payloadWithAccount(account: Record<string, unknown>): AccountPayload {
    return { account, heroes: [], skills: {}, casa: {}, items: [] };
  }

  it('passes when both raw account blocks are structurally identical', () => {
    const account = { gold: '8125089', phase: 60, bag_capacity: 100 };
    expect(() => compareRawAccountFields(payloadWithAccount({ ...account }), payloadWithAccount({ ...account }))).not.toThrow();
  });

  it('throws accountMismatch naming "account.gold" when the raw gold field silently changes type (the spec\'s coerced-string hazard)', () => {
    const live = payloadWithAccount({ gold: '8125089', phase: 60 });
    const exported = payloadWithAccount({ gold: 8125089, phase: 60 });
    const err = expectFidelityError(() => compareRawAccountFields(live, exported), 'accountMismatch');
    expect(err.message).toContain('account.gold');
  });
});

describe('compareAccountResults — no live-only tolerance (edge case 5)', () => {
  it('the comparator source declares no numeric tolerance literal and imports SHEET_ABS_TOL rather than redefining it', () => {
    const source = readFileSync(join(__dirname, 'helpers', 'fidelity-compare.ts'), 'utf8');
    expect(source).not.toContain('1e-6');
    expect(source).not.toMatch(/const\s+\w*ABS_TOL\w*\s*[:=]/);
    expect(source).toMatch(/import\s*\{\s*SHEET_ABS_TOL\s*\}/);
  });
});
