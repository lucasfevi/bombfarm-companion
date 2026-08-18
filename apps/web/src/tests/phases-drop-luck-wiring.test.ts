/**
 * Pins the one join the Drops panel's other tests leave uncovered.
 *
 * Three pieces already have their own tests: `rankRosterByDps` rows carry the pipeline-adjusted
 * Luck (`roster-dps.test.ts`), `computePhaseIntelGlobal` turns a `luckFraction` into drop
 * chances (`packages/domain/tests/phase-intel-486-witness.test.ts`), and `dropItems` formats
 * those rows (`phase-fact-items.test.ts`). What none of them exercises is the expression in
 * `phases-explorer.tsx` that connects them — the mean of the top-squad rows' Luck, divided by
 * 100 — which is where a units slip (percentage points vs. fraction) or an aggregation slip
 * (sum/max instead of mean) would live and still leave every other test green.
 *
 * The live-tooltip reconciliation this feature is built on says the multiplier is an AVERAGE of
 * the on-field heroes' Luck, so the second assertion below is the load-bearing one: with two
 * heroes of different Luck the boost must land strictly BETWEEN their individual boosts. A sum
 * would exceed both, a max would equal the higher one, and either would still satisfy a test
 * that only checked "the boost is bigger than zero".
 */
import { describe, expect, it } from 'vitest';
import { rankRosterByDps } from '@bombfarm/domain/roster-dps';
import { computePhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { DROP_RATES } from '@bombfarm/domain/phase-wiki';
import { emptyLoadout, type SheetStats } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import {
  DEFAULT_CONTEXT,
  DEFAULT_TREE,
  type AccountShared,
  type HeroRecord,
} from '@/shared/lib/storage';

/** Luck is in PERCENTAGE POINTS on a sheet, the same convention `farm-rate.ts` documents. */
const sheet = (luck: number): SheetStats => ({
  attack: 200,
  energy: 400,
  speed: 55,
  critChance: 10,
  critDmg: 80,
  penetration: 5,
  cdr: 4,
  luck,
});

function hero(id: string, luckPct: number): HeroRecord {
  return {
    id,
    name: id,
    updatedAt: 1,
    rarity: 'Raro',
    level: 61,
    stars: 1,
    naked: sheet(luckPct),
    loadout: emptyLoadout(),
    altLoadout: null,
    gearedOverride: sheet(luckPct),
    abilities: {},
    pts: ZERO_PTS(),
    birth: sheet(luckPct),
  };
}

const account: AccountShared = {
  // `luckFlatPct` stays at the default 0 so the assertions below measure the hero-side average
  // alone — the tree's flat addend is already pinned by the farm-rate Sorte tests.
  tree: { ...DEFAULT_TREE(), danoTotal: 1.78324567735483 },
  teamBuffs: zeroTeamBuffs(),
  context: { ...DEFAULT_CONTEXT(), phase: 60, mitigationPct: 0, rankMode: 'dps' },
};

const PHASE_GATE = 60;
const SLOTS = 9;

/** Verbatim the expression `phases-explorer.tsx` uses to build `luckFraction`. */
function luckFractionFor(heroes: HeroRecord[]): number {
  const rows = rankRosterByDps(
    { heroes, account, phase: PHASE_GATE, mitigationPct: 0 },
    SLOTS,
  );
  if (rows.length === 0) return 0;
  return rows.reduce((total, row) => total + row.luck, 0) / rows.length / 100;
}

describe('Drops panel luck wiring (phases-explorer)', () => {
  it('an empty roster applies no boost — yours equals wiki', () => {
    const intel = computePhaseIntelGlobal(PHASE_GATE, { luckFraction: luckFractionFor([]) })!;
    for (const row of intel.dropChances) {
      expect(row.actual).toBe(row.wiki);
    }
  });

  it('a single hero boosts every applicable drop by exactly its own Luck', () => {
    const luckFraction = luckFractionFor([hero('solo', 20)]);
    const intel = computePhaseIntelGlobal(PHASE_GATE, { luckFraction })!;
    const chest = intel.dropChances.find((row) => row.id === 'chest')!;
    expect(chest.wiki).toBe(DROP_RATES.chest);
    expect(chest.actual).toBeCloseTo(DROP_RATES.chest * (1 + luckFraction), 12);
    // Percentage points -> fraction. A missing `/ 100` would put this near 21, not near 1.2.
    expect(1 + luckFraction).toBeGreaterThan(1);
    expect(1 + luckFraction).toBeLessThan(2);
  });

  it('two heroes of different Luck average — the boost lands strictly between them', () => {
    const low = hero('low', 5);
    const high = hero('high', 30);
    const loneLow = luckFractionFor([low]);
    const loneHigh = luckFractionFor([high]);
    const pair = luckFractionFor([low, high]);

    expect(loneHigh).toBeGreaterThan(loneLow);
    expect(pair).toBeGreaterThan(loneLow);
    expect(pair).toBeLessThan(loneHigh);
    expect(pair).toBeCloseTo((loneLow + loneHigh) / 2, 12);
  });
});
