import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountPayload, AccountView, SectionFidelity } from '@bombfarm/contracts';
import { buildFarmInputs, isSectionUsable, DEFAULT_FARM_CONTROLS } from './farm-inputs';

const NOW = '2026-08-12T00:00:00.000Z';

function resolvedFidelity(overrides: Partial<AccountFidelity> = {}): AccountFidelity {
  return {
    account: { status: 'resolved', capturedAt: NOW },
    heroes: { status: 'resolved', capturedAt: NOW },
    skills: { status: 'resolved', capturedAt: NOW },
    casa: { status: 'resolved', capturedAt: NOW },
    items: { status: 'resolved', capturedAt: NOW },
    ...overrides,
  };
}

function minimalRawHero(id: string, name = 'Hero') {
  const birth = {
    dmg: 100,
    energia: 100,
    speed: 50,
    crit_chance: 5,
    crit_dmg: 50,
    penetration: 0,
    cooldown_reduction: 0,
    luck: 0,
  };
  return { id, name, level: 10, rarity: 2, stars: 1, birth_stats: birth, stats: birth, stat_points_available: 0 };
}

function basePayload(fidelity: AccountFidelity = resolvedFidelity()): AccountPayload {
  return {
    account: { phase: 60, max_phase: 88 },
    heroes: [minimalRawHero('h1', 'Alpha')],
    skills: { totals: { dmg_static: 1.5, crit_dmg_mult: 1 } },
    casa: { active_casa: 1, levels: [10] },
    items: [],
    fidelity,
  };
}

function viewOf(payload: AccountPayload): AccountView {
  return { payload, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } };
}

function offlineFixtureView(): AccountView {
  const file = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');
  return viewOf(JSON.parse(readFileSync(file, 'utf8')) as AccountPayload);
}

function required<T>(value: T | null, message: string): T {
  if (value === null) throw new Error(message);
  return value;
}

describe('isSectionUsable', () => {
  const cases: [string, SectionFidelity, boolean][] = [
    ['resolved', { status: 'resolved', capturedAt: NOW }, true],
    ['stale', { status: 'stale', capturedAt: NOW }, true],
    ['missing', { status: 'missing' }, false],
    ['degraded, missing key', { status: 'degraded', capturedAt: NOW, missingKeys: ['gold'], addedKeys: [] }, false],
    ['degraded, added key only', { status: 'degraded', capturedAt: NOW, missingKeys: [], addedKeys: ['gold'] }, true],
  ];
  it.each(cases)('%s is usable=%s', (_label, fidelity, expected) => {
    expect(isSectionUsable(fidelity)).toBe(expected);
  });
});

describe('the per-section usability gate withholds rather than computing from an untrusted section', () => {
  it.each(['account', 'heroes', 'skills', 'casa', 'items'] as const)(
    'a missing %s section withholds the whole board',
    (section) => {
      const payload = basePayload(resolvedFidelity({ [section]: { status: 'missing' } }));
      expect(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS)).toBeNull();
    },
  );

  it('a degraded-but-trustworthy section still computes', () => {
    const payload = basePayload(
      resolvedFidelity({ items: { status: 'degraded', capturedAt: NOW, missingKeys: [], addedKeys: ['gold'] } }),
    );
    expect(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS)).not.toBeNull();
  });

  it('a degraded section that lost a key withholds, even though the payload body is right there', () => {
    const payload = basePayload(
      resolvedFidelity({ skills: { status: 'degraded', capturedAt: NOW, missingKeys: ['totals.dmg_static'], addedKeys: [] } }),
    );
    expect(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS)).toBeNull();
  });

  it('a whole-payload rejection withholds instead of computing over the heroes that did parse', () => {
    const payload = { ...basePayload(), heroes: [{ id: 'h1', name: 'NoBirth' }] };
    expect(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS)).toBeNull();
  });
});

describe('no value is ever defaulted — a missing required input withholds', () => {
  it('withholds when the skill tree is absent, even with skills fidelity claiming resolved', () => {
    const payload = { ...basePayload(), skills: undefined };
    expect(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS)).toBeNull();
  });

  it('withholds when the house is absent, rather than picking one', () => {
    const payload = { ...basePayload(), casa: {} };
    expect(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS)).toBeNull();
  });
});

describe('candidate completion is the only synthesis performed', () => {
  it('id is the game hero id and updatedAt is the heroes section capture time — no stat invented', () => {
    const inputs = required(buildFarmInputs(viewOf(basePayload()), DEFAULT_FARM_CONTROLS), 'expected inputs');
    expect(inputs.heroes).toHaveLength(1);
    const hero = required(inputs.heroes[0] ?? null, 'expected a hero');
    expect(hero.id).toBe('h1');
    expect(hero.updatedAt).toBe(Date.parse(NOW));
  });
});

describe('team buffs are derived from this roster and are never an override', () => {
  it('teamBuffsOverride is null — there is no team-buffs UI on the desktop for one to come from', () => {
    const inputs = required(buildFarmInputs(viewOf(basePayload()), DEFAULT_FARM_CONTROLS), 'expected inputs');
    expect(inputs.teamBuffsOverride).toBeNull();
    expect(Object.values(inputs.effectiveTeamBuffs).every((value) => Number.isFinite(value))).toBe(true);
  });
});

describe('the House cycle anchor mirrors the live house configuration', () => {
  it('houseCycleSecsHouseIdx/Level equal houseIdx/houseLevel, because both come from one payload read', () => {
    const inputs = required(buildFarmInputs(offlineFixtureView(), DEFAULT_FARM_CONTROLS), 'expected inputs');
    expect(inputs.houseCycleSecsHouseIdx).toBe(inputs.houseIdx);
    expect(inputs.houseCycleSecsLevel).toBe(inputs.houseLevel);
  });
});

describe('maxPhase reaches the compute', () => {
  it('is non-null for the committed offline account — null would silently disable the unlocked-only filter', () => {
    const inputs = required(buildFarmInputs(offlineFixtureView(), DEFAULT_FARM_CONTROLS), 'expected inputs');
    expect(inputs.maxPhase).not.toBeNull();
    expect(inputs.maxPhase).toBe(137);
  });

  it('falls back to the skills section when the account section does not carry it', () => {
    const payload: AccountPayload = {
      ...basePayload(),
      account: { phase: 60 },
      skills: { totals: { dmg_static: 1.5, crit_dmg_mult: 1 }, max_phase: 44 },
    };
    const inputs = required(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS), 'expected inputs');
    expect(inputs.maxPhase).toBe(44);
  });
});

describe('the controls are passed through verbatim, by reference', () => {
  it('farmPoolOverrides keeps its identity — the package compares that member with Object.is', () => {
    const overrides = { h1: false };
    const controls = { farmPoolOverrides: overrides, farmReturnBonus: 'vip' as const };
    const inputs = required(buildFarmInputs(viewOf(basePayload()), controls), 'expected inputs');
    expect(inputs.farmPoolOverrides).toBe(overrides);
    expect(inputs.farmReturnBonus).toBe('vip');
  });
});

describe('the adapter is pure', () => {
  it('the source file imports no React', () => {
    const source = readFileSync(path.join(__dirname, 'farm-inputs.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]react['"]/);
  });
});
