import { describe, expect, it } from 'vitest';
import { computeAdvisorPipeline } from '@bombfarm/domain/advisor-pipeline';
import { zeroTeamBuffs } from '@bombfarm/domain/team-buffs';
import { PROPS } from '@bombfarm/domain/phases';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import {
  buildHeroPlanContext,
  buildHeroPlanContexts,
  heroModsAndSheetOther,
} from '@bombfarm/domain/team-plan/hero-context';
import type { TeamPlanAccountInput, TeamPlanHeroInput } from '@bombfarm/domain/team-plan/types';
import {
  extractHero,
  loadFixtureJson,
  treeTotalsFromSave,
} from './helpers/sheet-math-fixtures';

// MP5 F1 (AD-068 class (b) — structural): re-pointed onto save-20260813-5heroes.json (default
// subject for Bellatrix-specific tests — the export's Bellatrix is L42, not the deleted
// crit-dmg-tree fixture's L62) and payload-20260812-8heroes.json (the whole-roster test). Every
// assertion compares two independently-computed structures or checks a structural property —
// none pins a captured value.
function accountFromFixture(raw: Record<string, unknown>): TeamPlanAccountInput {
  const totals = (raw.skills as { totals: Record<string, unknown> }).totals;
  const treeSheet = treeTotalsFromSave(totals);
  return {
    treeSheet,
    houseIdx: 0,
    houseLevel: 1,
    phase: 1,
    mitigationPct: 6.7,
    slots: 6,
  };
}

function heroInputFromExtract(hero: ReturnType<typeof extractHero>): TeamPlanHeroInput {
  return {
    heroId: hero.sourceId,
    name: hero.name,
    level: hero.level,
    stars: hero.stars,
    rarity: hero.rarity,
    birth: hero.birth,
    abilities: hero.abilities,
    pts: ZERO_PTS(),
    loadout: hero.loadout,
  };
}

describe('buildHeroPlanContext', () => {
  it('reproduces computeAdvisorPipeline mods and sheetOther for a fixture hero', () => {
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const hero = extractHero(raw, 'Bellatrix', 42);
    const account = accountFromFixture(raw);
    const ctx = buildHeroPlanContext(heroInputFromExtract(hero), account, 'optimize');
    expect(ctx).not.toBeNull();

    const pipeline = computeAdvisorPipeline({
      naked: hero.sheet,
      geared: hero.sheet,
      loadout: hero.loadout,
      altLoadout: null,
      pts: ZERO_PTS(),
      abilities: hero.abilities,
      rarity: hero.rarity,
      level: hero.level,
      stars: hero.stars,
      treeDanoTotal: account.treeSheet.danoStatic,
      treeCritChance: account.treeSheet.critChancePct,
      treeCritDmg: account.treeSheet.critDmgPct,
      treeSpeed: account.treeSheet.speedPct,
      treeEnergy: account.treeSheet.energyPct,
      treeLuckFlatPct: account.treeSheet.luckFlatPct,
      teamBuffs: zeroTeamBuffs(),
      houseIdx: account.houseIdx,
      houseLevel: account.houseLevel,
      phase: account.phase,
      mitigationPct: account.mitigationPct,
      rankMode: 'dps',
      targetProp: PROPS[1]?.name ?? PROPS[0].name,
      birth: hero.birth,
    });

    expect(ctx!.mods).toEqual(pipeline.mods);
    expect(ctx!.sheetOther).toEqual(pipeline.sheetOther);
  });

  it('threads level from TeamPlanHeroInput — the point pool both team-plan points passes budget against', () => {
    // `solver-search.ts`'s pointsPass and `waterfall.ts`'s finalPtsFromOptimizeBuild read
    // `ctx.level` and nothing else for their reopt budget (`reoptBudget`), so a level that
    // failed to thread here would silently hand the team plan a different budget from the
    // Planner's for the same hero — which is how the two pages drifted apart before.
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const hero = extractHero(raw, 'Bellatrix', 42);
    const account = accountFromFixture(raw);

    const ctx = buildHeroPlanContext(heroInputFromExtract(hero), account, 'optimize');
    expect(ctx!.level).toBe(hero.level);

    const relevelled = buildHeroPlanContext(
      { ...heroInputFromExtract(hero), level: 12 },
      account,
      'optimize',
    );
    expect(relevelled!.level).toBe(12);
  });

  it('returns null when birth is missing', () => {
    const account = accountFromFixture(loadFixtureJson('save-20260813-5heroes.json'));
    const result = buildHeroPlanContext(
      {
        heroId: 'x',
        name: 'X',
        level: 1,
        stars: 0,
        rarity: 'Comum',
        abilities: {},
        pts: ZERO_PTS(),
        loadout: {},
      },
      account,
      'optimize',
    );
    expect(result).toBeNull();
  });
});

describe('buildHeroPlanContexts birth gate', () => {
  it('returns blocked with hero names when in-scope hero lacks birth', () => {
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const account = accountFromFixture(raw);
    const heroes: TeamPlanHeroInput[] = [
      {
        heroId: '1',
        name: 'NoBirth',
        level: 10,
        stars: 0,
        rarity: 'Comum',
        abilities: {},
        pts: ZERO_PTS(),
        loadout: {},
      },
    ];
    const result = buildHeroPlanContexts(heroes, account, { '1': 'optimize' });
    expect(result).toEqual({ blocked: true, heroNames: ['NoBirth'] });
  });

  it('leaveAlone hero without birth does not block', () => {
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const account = accountFromFixture(raw);
    const heroes: TeamPlanHeroInput[] = [
      {
        heroId: '1',
        name: 'NoBirth',
        level: 10,
        stars: 0,
        rarity: 'Comum',
        abilities: {},
        pts: ZERO_PTS(),
        loadout: {},
      },
    ];
    const result = buildHeroPlanContexts(heroes, account, { '1': 'leaveAlone' });
    expect(result.blocked).toBe(false);
    if (!result.blocked) {
      expect(result.contexts).toHaveLength(0);
    }
  });

  it('defaults battleAllowed false to donate scope', () => {
    const raw = loadFixtureJson('save-20260813-5heroes.json');
    const hero = extractHero(raw, 'Bellatrix', 42);
    const account = accountFromFixture(raw);
    const result = buildHeroPlanContexts(
      [{ ...heroInputFromExtract(hero), battleAllowed: false }],
      account,
      {},
    );
    expect(result.blocked).toBe(false);
    if (!result.blocked) {
      expect(result.contexts[0]?.scope).toBe('donate');
    }
  });

  it('builds contexts for all heroes with birth', () => {
    const raw = loadFixtureJson('payload-20260812-8heroes.json');
    const account = accountFromFixture(raw);
    const heroes = (raw.heroes as unknown[])
      .map((h) => {
        if (typeof h !== 'object' || h === null) return null;
        const name = String((h as { name?: string }).name ?? '');
        const level = Number((h as { level?: number }).level);
        try {
          return heroInputFromExtract(extractHero(raw, name, level));
        } catch {
          return null;
        }
      })
      .filter((h): h is TeamPlanHeroInput => h != null);

    const scope = Object.fromEntries(heroes.map((h) => [h.heroId, 'optimize' as const]));
    const result = buildHeroPlanContexts(heroes, account, scope);
    expect(result.blocked).toBe(false);
    if (!result.blocked) {
      expect(result.contexts.length).toBe(heroes.length);
    }
  });
});

describe('heroModsAndSheetOther', () => {
  it('matches abilityMods-derived sheetOther', () => {
    const { mods, sheetOther } = heroModsAndSheetOther({ olho_clinico: 10 });
    expect(mods.sheetCritChancePctOfBase).toBeGreaterThan(0);
    expect(sheetOther.critChance).toBeGreaterThan(0);
  });
});
