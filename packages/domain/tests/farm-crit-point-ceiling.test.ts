import { describe, expect, it } from 'vitest';
import { computeHeroFarmBases, heroFactsFromBasis } from '@bombfarm/domain/farm-rate';
import { critPointCeilingOf } from '@bombfarm/domain/team-aura-layer';
import { STAT_CAPS, activeDps, readCritChance, sustainedDps, type Context, type HeroSheet } from '@bombfarm/domain/model';
import type { SheetKey } from '@bombfarm/domain/planner-constants';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import { TEAM_BUFF_CAP, zeroTeamBuffs, type TeamAuraId } from '@bombfarm/domain/team-buffs';
import { buildHeroPlanContext } from '@bombfarm/domain/team-plan/hero-context';
import { scoreHeroLoadout } from '@bombfarm/domain/team-plan/score';
import { farmFromAccount } from '@bombfarm/domain/team-plan/waterfall-guards';
import type {
  FarmContext,
  ScopeState,
  TeamPlanAccountInput,
  TeamPlanInput,
} from '@bombfarm/domain/team-plan/types';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';
import { extractHero, loadFixtureJson, treeTotalsFromSave } from './helpers/sheet-math-fixtures';

const { heroes, account } = loadFarmRateFixture();
const basis = computeHeroFarmBases({ heroes, account }).find((candidate) => candidate.effectiveDelta.critChance > 0)!;
const manyCritPoints: Record<SheetKey, number> = { ...basis.pts, critChance: basis.pts.critChance + 1000 };
const critOf = (candidate: typeof basis, pts: Record<SheetKey, number>) =>
  heroFactsFromBasis(candidate, pts).critChancePct;

describe('critPointCeilingOf', () => {
  it('is the plain cap when the average aura already is the full aura', () => {
    expect(critPointCeilingOf(20, 20)).toBe(STAT_CAPS.critChance);
  });

  it('leaves the average aura on top of the sheet headroom the full aura allows', () => {
    expect(critPointCeilingOf(20, 16)).toBe(STAT_CAPS.critChance - 4);
  });
});

describe('a basis with a crit ceiling', () => {
  const ceiling = basis.effective.critChance + 5;

  it('stops bought crit chance at the ceiling', () => {
    expect(critOf({ ...basis, critPointCeiling: ceiling }, manyCritPoints)).toBeCloseTo(ceiling, 9);
  });

  it('prices the vector it was built at as it stands, even above the ceiling', () => {
    const above = { ...basis, critPointCeiling: basis.effective.critChance - 5 };
    expect(critOf(above, basis.pts)).toBeCloseTo(basis.effective.critChance, 9);
  });

  it('clamps the whole sheet when it binds the sheet', () => {
    const bound = { ...basis, critPointCeiling: basis.effective.critChance - 5, critCeilingBindsSheet: true };
    expect(critOf(bound, basis.pts)).toBeCloseTo(basis.effective.critChance - 5, 9);
  });

  it('adds nothing when no ceiling is set', () => {
    const { critPointCeiling: _unused, ...plain } = basis;
    expect(critOf(plain, manyCritPoints)).toBeGreaterThan(ceiling);
  });
});

describe('a sheet with a crit ceiling, scored for damage', () => {
  const sheet: HeroSheet = {
    rarity: 'Lendária',
    attack: 1000,
    energy: 400,
    speed: 100,
    critChance: 96,
    critDmg: 300,
    penetration: 50,
    cdr: 20,
    attackPerPoint: 10,
    energyPerPoint: 5,
  };
  const context: Context = { restSeconds: 30, mitigation: 0.3, blastRange: 1, ato: 1, drainMult: 1 };

  it('credits crit chance only up to the ceiling', () => {
    expect(readCritChance({ ...sheet, critCeiling: 90 })).toBe(90);
    expect(activeDps({ ...sheet, critCeiling: 90 }, context)).toBeCloseTo(
      activeDps({ ...sheet, critChance: 90 }, context),
      9,
    );
  });

  it('leaves a sheet under its ceiling as it stands', () => {
    expect(activeDps({ ...sheet, critCeiling: 99 }, context)).toBeCloseTo(activeDps(sheet, context), 9);
  });

  it('values a point bought past the ceiling at nothing', () => {
    const capped = { ...sheet, critCeiling: 96 };
    expect(sustainedDps({ ...capped, critChance: 100 }, context)).toBeCloseTo(sustainedDps(capped, context), 9);
  });
});

function planInput(
  heroInputs: { heroId: string; battleAllowed?: boolean; pressagio: number }[],
  scopeByHeroId: Record<string, ScopeState>,
  aurasAtCap?: TeamAuraId[],
): TeamPlanInput {
  return {
    heroes: heroInputs.map((hero) => ({
      heroId: hero.heroId,
      name: hero.heroId,
      level: 50,
      stars: 0,
      rarity: 'Lendária',
      abilities: { pressagio_mortal: hero.pressagio },
      pts: ZERO_PTS(),
      loadout: {},
      ...(hero.battleAllowed === undefined ? {} : { battleAllowed: hero.battleAllowed }),
    })),
    inventory: [],
    account: { houseIdx: 0, houseLevel: 1, phase: 100, mitigationPct: 10, slots: 6, fieldSlots: 6 },
    scopeByHeroId,
    forgeFloor: 0,
    ...(aurasAtCap === undefined ? {} : { aurasAtCap }),
  } as unknown as TeamPlanInput;
}

describe('the full-presence aura the plan caps crit against', () => {
  it('counts every fielded carrier at once', () => {
    const input = planInput(
      [{ heroId: 'a', pressagio: 8 }, { heroId: 'b', pressagio: 7 }],
      { a: 'optimize', b: 'leaveAlone' },
    );
    expect(farmFromAccount(input).critFlatAtFullPresence).toBe(15);
  });

  it('leaves out a donated hero, and a hero the game will not field with no scope of its own', () => {
    const input = planInput(
      [
        { heroId: 'a', pressagio: 8 },
        { heroId: 'b', pressagio: 7 },
        { heroId: 'c', pressagio: 6, battleAllowed: false },
      ],
      { a: 'optimize', b: 'donate' },
    );
    expect(farmFromAccount(input).critFlatAtFullPresence).toBe(8);
  });

  it('holds the aura at its cap when the plan holds it there', () => {
    const input = planInput([{ heroId: 'a', pressagio: 2 }], { a: 'optimize' }, ['pressagio_mortal']);
    expect(farmFromAccount(input).critFlatAtFullPresence).toBe(TEAM_BUFF_CAP.pressagio_mortal);
  });
});

describe('scoring a hero with the full-presence aura on the farm context', () => {
  const raw = loadFixtureJson('save-20260813-5heroes.json');
  const hero = extractHero(raw, 'Bellatrix', 42);
  const totals = treeTotalsFromSave((raw.skills as { totals: Record<string, unknown> }).totals);
  const planAccount: TeamPlanAccountInput = {
    treeSheet: totals,
    houseIdx: 0,
    houseLevel: 1,
    phase: 1,
    mitigationPct: 6.7,
    slots: 6,
    fieldSlots: 6,
  };
  const ctx = buildHeroPlanContext(
    {
      heroId: hero.sourceId,
      name: hero.name,
      level: hero.level,
      stars: hero.stars,
      rarity: hero.rarity,
      birth: hero.birth,
      abilities: hero.abilities,
      pts: ZERO_PTS(),
      loadout: hero.loadout,
    },
    planAccount,
    'optimize',
  )!;
  const farm: FarmContext = { houseIdx: 0, houseLevel: 1, phase: 1, mitigationPct: 6.7 };
  const averageAura = { ...zeroTeamBuffs(), pressagio_mortal: 16 };

  it('carries the ceiling the cap leaves once the aura is up', () => {
    const score = scoreHeroLoadout(ctx, hero.loadout, ZERO_PTS(), averageAura, { ...farm, critFlatAtFullPresence: 20 });
    expect(score.effective.critCeiling).toBe(STAT_CAPS.critChance - 20 + 16);
  });

  it('carries none without it', () => {
    expect(scoreHeroLoadout(ctx, hero.loadout, ZERO_PTS(), averageAura, farm).effective.critCeiling).toBeUndefined();
  });

  it('prices the same build lower once a ceiling sits below its crit chance', () => {
    const high = { ...ZERO_PTS(), critChance: 600 };
    const free = scoreHeroLoadout(ctx, hero.loadout, high, averageAura, farm);
    const capped = scoreHeroLoadout(ctx, hero.loadout, high, averageAura, { ...farm, critFlatAtFullPresence: 40 });
    expect(capped.sustained).toBeLessThan(free.sustained);
  });
});
