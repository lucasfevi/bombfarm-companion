import { describe, expect, it } from 'vitest';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { FORJA_MAX } from '@bombfarm/domain/gear';
import {
  buildPool,
  clampForgeFloor,
  effectiveUpgrade,
  eligibleForHero,
} from '@bombfarm/domain/team-plan/pool';
import type { HeroPlanContext } from '@bombfarm/domain/team-plan/types';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

function heroCtx(level: number, slot?: string): HeroPlanContext {
  return {
    heroId: 'h1',
    name: 'Test',
    level,
    stars: 0,
    rarity: 'Raro',
    birth: {
      attack: 100,
      energy: 100,
      speed: 50,
      critChance: 10,
      critDmg: 50,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
    sheetOther: { speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0 },
    mods: {
      drainMult: 1,
      combatCritChancePctOfBase: 0,
      penetrationPp: 0,
      rangeCells: 0,
      dmgMult: 1,
      attackMult: 1,
      speedMult: 1,
      gateAttackMult: 1,
      sheetCritChancePctOfBase: 0,
      sheetPenetrationRaw: 0,
      sheetCritDmgPctOfBase: 0,
    },
    treeSheet: {
      danoStatic: 1,
      energyPct: 0,
      speedPct: 0,
      critChancePct: 0,
      critDmgPct: 0,
      luckFlatPct: 0,
    },
    scope: 'optimize',
    abilities: {},
    pts: {
      attack: 0,
      energy: 0,
      speed: 0,
      critChance: 0,
      critDmg: 0,
      penetration: 0,
      cdr: 0,
      luck: 0,
    },
  };
}

describe('clampForgeFloor', () => {
  it('clamps -1 to 0', () => {
    expect(clampForgeFloor(-1)).toBe(0);
  });

  it('clamps 99 to FORJA_MAX', () => {
    expect(clampForgeFloor(99)).toBe(FORJA_MAX);
  });

  it('rounds 7.6 to 8', () => {
    expect(clampForgeFloor(7.6)).toBe(8);
  });

  it('NaN defaults to 10', () => {
    expect(clampForgeFloor(NaN)).toBe(10);
  });

  it('accepts 0', () => {
    expect(clampForgeFloor(0)).toBe(0);
  });
});

describe('effectiveUpgrade', () => {
  it('uses max of upgrade and forge floor capped at FORJA_MAX', () => {
    expect(effectiveUpgrade(5, 10)).toBe(10);
    expect(effectiveUpgrade(12, 10)).toBe(12);
    expect(effectiveUpgrade(20, 10)).toBe(FORJA_MAX);
  });

  it('with forgeFloor 0 uses item upgrade', () => {
    expect(effectiveUpgrade(3, 0)).toBe(3);
  });
});

describe('buildPool exclusions', () => {
  it('counts marketBlocked separately', () => {
    const pool = buildPool({
      inventory: [
        {
          id: '1',
          defId: 'ember_calca',
          rarityIdx: 0,
          level: 10,
          upgrade: 0,
          slot: 'calca',
          equipped: false,
          equippedBy: null,
          defResolved: true,
          marketBlocked: true,
        },
      ],
      scopeByHeroId: {},
      forgeFloor: 10,
      rosterHeroIds: new Set(),
    });
    expect(pool.excluded.marketBlocked).toBe(1);
    expect(pool.entries).toHaveLength(0);
  });

  it('counts unresolvedDef separately', () => {
    const pool = buildPool({
      inventory: [
        {
          id: '1',
          defId: 'bad',
          rarityIdx: 0,
          level: 10,
          upgrade: 0,
          slot: null,
          equipped: false,
          equippedBy: null,
          defResolved: false,
          marketBlocked: false,
        },
      ],
      scopeByHeroId: {},
      forgeFloor: 10,
      rosterHeroIds: new Set(),
    });
    expect(pool.excluded.unresolvedDef).toBe(1);
    expect(pool.entries).toHaveLength(0);
  });

  it('excludes leaveAlone owner items', () => {
    const pool = buildPool({
      inventory: [
        {
          id: '1',
          defId: 'ember_calca',
          rarityIdx: 0,
          level: 10,
          upgrade: 0,
          slot: 'calca',
          equipped: true,
          equippedBy: 'hero1',
          defResolved: true,
          marketBlocked: false,
        },
      ],
      scopeByHeroId: { hero1: 'leaveAlone' },
      forgeFloor: 10,
      rosterHeroIds: new Set(['hero1']),
    });
    expect(pool.excluded.leaveAlone).toBe(1);
    expect(pool.entries).toHaveLength(0);
  });

  it('counts foreignOwner when equipped on absent hero', () => {
    const pool = buildPool({
      inventory: [
        {
          id: '1',
          defId: 'ember_calca',
          rarityIdx: 0,
          level: 10,
          upgrade: 0,
          slot: 'calca',
          equipped: true,
          equippedBy: 'ghost',
          defResolved: true,
          marketBlocked: false,
        },
      ],
      scopeByHeroId: {},
      forgeFloor: 10,
      rosterHeroIds: new Set(['hero1']),
    });
    expect(pool.excluded.foreignOwner).toBe(1);
    expect(pool.entries).toHaveLength(0);
  });

  it('includes optimize and donate owner items', () => {
    const item = {
      id: '1',
      defId: 'ember_calca',
      rarityIdx: 0,
      level: 10,
      upgrade: 0,
      slot: 'calca',
      equipped: true,
      equippedBy: 'hero1',
      defResolved: true,
      marketBlocked: false,
    };
    const optimizePool = buildPool({
      inventory: [item],
      scopeByHeroId: { hero1: 'optimize' },
      forgeFloor: 0,
      rosterHeroIds: new Set(['hero1']),
    });
    const donatePool = buildPool({
      inventory: [item],
      scopeByHeroId: { hero1: 'donate' },
      forgeFloor: 0,
      rosterHeroIds: new Set(['hero1']),
    });
    expect(optimizePool.entries).toHaveLength(1);
    expect(donatePool.entries).toHaveLength(1);
  });
});

describe('buildPool grouping', () => {
  it('groups identical tuples with sorted itemIds', () => {
    const pool = buildPool({
      inventory: [
        {
          id: 'b',
          defId: 'ember_calca',
          rarityIdx: 2,
          level: 10,
          upgrade: 3,
          slot: 'calca',
          equipped: false,
          equippedBy: null,
          defResolved: true,
          marketBlocked: false,
        },
        {
          id: 'a',
          defId: 'ember_calca',
          rarityIdx: 2,
          level: 10,
          upgrade: 3,
          slot: 'calca',
          equipped: false,
          equippedBy: null,
          defResolved: true,
          marketBlocked: false,
        },
      ],
      scopeByHeroId: {},
      forgeFloor: 0,
      rosterHeroIds: new Set(),
    });
    expect(pool.entries).toHaveLength(1);
    expect(pool.entries[0]?.count).toBe(2);
    expect(pool.entries[0]?.itemIds).toEqual(['a', 'b']);
    expect(pool.entries[0]?.upgrade).toBe(3);
  });
});

describe('eligibleForHero', () => {
  const entry = {
    key: 'ember_calca|2|10|0',
    defId: 'ember_calca',
    rarityIdx: 2,
    level: 10,
    upgrade: 0,
    effectiveUpgrade: 0,
    slot: 'calca',
    count: 1,
    itemIds: ['1'],
  };

  it('allows when level and slot match', () => {
    expect(eligibleForHero(entry, heroCtx(10), 'calca')).toBe(true);
  });

  it('rejects when hero level too low', () => {
    expect(eligibleForHero(entry, heroCtx(5), 'calca')).toBe(false);
  });

  it('rejects slot mismatch', () => {
    expect(eligibleForHero(entry, heroCtx(10), 'pe')).toBe(false);
  });
});

// MP5 F1 (AD-068 class (a) for the pooled-count claim, class (b) for the rest): re-pointed
// onto the post-patch corpus. The pooled-count is read from the new capture, not carried over —
// 27 for the payload (its own catalogued-item count; the search space collapsed from the
// deleted fixture's 58), 17 for the export.
describe('fixture pools', () => {
  it('payload-20260812 all optimize yields 27 pooled items', () => {
    const raw = loadFixtureJson('payload-20260812-8heroes.json');
    const { inventory, candidates } = parseSaveFile(raw, []);
    const heroIds = new Set(candidates.map((c) => c.sourceId));
    const scope = Object.fromEntries(candidates.map((c) => [c.sourceId, 'optimize' as const]));
    const pool = buildPool({
      inventory,
      scopeByHeroId: scope,
      forgeFloor: 0,
      rosterHeroIds: heroIds,
    });
    const totalCount = pool.entries.reduce((sum, e) => sum + e.count, 0);
    expect(totalCount).toBe(27);
  });

  it('forgeFloor 10 raises every entry effectiveUpgrade to at least 10', () => {
    const raw = loadFixtureJson('payload-20260812-8heroes.json');
    const { inventory, candidates } = parseSaveFile(raw, []);
    const heroIds = new Set(candidates.map((c) => c.sourceId));
    const scope = Object.fromEntries(candidates.map((c) => [c.sourceId, 'optimize' as const]));
    const pool = buildPool({
      inventory,
      scopeByHeroId: scope,
      forgeFloor: 10,
      rosterHeroIds: heroIds,
    });
    for (const entry of pool.entries) {
      expect(entry.effectiveUpgrade).toBeGreaterThanOrEqual(10);
    }
  });

  it('forgeFloor 0 uses each item own upgrade', () => {
    const raw = loadFixtureJson('payload-20260812-8heroes.json');
    const { inventory, candidates } = parseSaveFile(raw, []);
    const heroIds = new Set(candidates.map((c) => c.sourceId));
    const scope = Object.fromEntries(candidates.map((c) => [c.sourceId, 'optimize' as const]));
    const pool = buildPool({
      inventory,
      scopeByHeroId: scope,
      forgeFloor: 0,
      rosterHeroIds: heroIds,
    });
    for (const entry of pool.entries) {
      expect(entry.effectiveUpgrade).toBe(entry.upgrade);
    }
  });

  it('zero level-rule violations across equipped items in both fixtures', () => {
    for (const file of ['save-20260813-5heroes.json', 'payload-20260812-8heroes.json']) {
      const raw = loadFixtureJson(file);
      const { inventory, candidates } = parseSaveFile(raw, []);
      const levelByHero = new Map(candidates.map((c) => [c.sourceId, c.record.level]));
      const equipped = inventory.filter((item) => item.equipped && item.equippedBy);
      for (const item of equipped) {
        const heroLevel = levelByHero.get(item.equippedBy!) ?? 0;
        expect(item.level).toBeLessThanOrEqual(heroLevel);
      }
    }
  });
});
