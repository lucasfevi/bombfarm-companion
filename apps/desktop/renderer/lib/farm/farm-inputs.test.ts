import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountFidelity, AccountPayload, AccountView, SectionFidelity } from '@bombfarm/contracts';
import { NO_ECONOMY_BOOST } from '@bombfarm/domain/farm-rate';
import { computeFarmRanking } from '@bombfarm/farm/core';
import { buildFarmInputs, isSectionUsable, DEFAULT_FARM_CONTROLS } from './farm-inputs';
import { skillTotals } from '../account/skill-totals.test-support';

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
    skills: { totals: skillTotals({ dmg_static: 1.5 }) },
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
    ['degraded, missing key', { status: 'degraded', capturedAt: NOW, missingKeys: ['gold'], addedKeys: [] }, true],
    ['degraded, added key only', { status: 'degraded', capturedAt: NOW, missingKeys: [], addedKeys: ['gold'] }, true],
  ];
  it.each(cases)('%s is usable=%s', (_label, fidelity, expected) => {
    expect(isSectionUsable(fidelity)).toBe(expected);
  });
});

describe('the per-section usability gate withholds a missing section', () => {
  it.each(['account', 'heroes', 'skills', 'casa', 'items'] as const)(
    'a missing %s section withholds the whole board',
    (section) => {
      const payload = basePayload(resolvedFidelity({ [section]: { status: 'missing' } }));
      expect(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS)).toBeNull();
    },
  );

  it('a degraded section that only gained a key still computes', () => {
    const payload = basePayload(
      resolvedFidelity({ items: { status: 'degraded', capturedAt: NOW, missingKeys: [], addedKeys: ['gold'] } }),
    );
    expect(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS)).not.toBeNull();
  });

  it('a degraded section that lost a key still computes from the body the game just sent', () => {
    const payload = basePayload(
      resolvedFidelity({ skills: { status: 'degraded', capturedAt: NOW, missingKeys: ['totals.dmg_static'], addedKeys: [] } }),
    );
    expect(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS)).not.toBeNull();
  });

  it('a hero without birth stats is left off the board while the heroes that parsed are still priced', () => {
    const payload = { ...basePayload(), heroes: [...(basePayload().heroes ?? []), { id: 'h2', name: 'NoBirth' }] };
    const inputs = buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS);
    expect(inputs?.heroes.map((hero) => hero.id)).toEqual(['h1']);
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
      skills: { totals: skillTotals({ dmg_static: 1.5 }), max_phase: 44 },
    };
    const inputs = required(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS), 'expected inputs');
    expect(inputs.maxPhase).toBe(44);
  });
});

describe('the Pass is read from the account, never from the controls', () => {
  const NOW_MS = Date.parse('2026-10-07T12:00:00Z');
  const secondsFromNow = (seconds: number) => NOW_MS / 1000 + seconds;
  const passOf = (vipUntil: number | undefined) => {
    const base = basePayload();
    const payload = { ...base, account: { ...base.account, ...(vipUntil === undefined ? {} : { vip_until: vipUntil }) } };
    return required(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS, NO_ECONOMY_BOOST, NOW_MS), 'expected inputs').farmPass;
  };

  it('is on while vip_until is in the future', () => {
    expect(passOf(secondsFromNow(3600))).toBe(true);
  });

  it('is off once vip_until has passed, was never set, or the field is absent', () => {
    expect(passOf(secondsFromNow(-1))).toBe(false);
    expect(passOf(0)).toBe(false);
    expect(passOf(undefined)).toBe(false);
  });
});

describe('the Pass Bonus is read from the account and rides inside the Boost', () => {
  const NOW_MS = Date.parse('2026-10-19T12:00:00Z');
  const withBonus = (until: number | undefined) => {
    const base = basePayload();
    const bonus = until === undefined ? {} : { bonus_passe_ate: until, bonus_passe_ouro: 0.25, bonus_passe_xp: 0.15 };
    const payload = { ...base, account: { ...base.account, ...bonus } };
    return required(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS, NO_ECONOMY_BOOST, NOW_MS), 'expected inputs');
  };

  it('is carried as the wire adds while its expiry is in the future', () => {
    expect(withBonus(NOW_MS / 1000 + 3600).farmBoost?.passBonus).toEqual({ gold: 0.25, xp: 0.15 });
  });

  it('is absent once expired or when the account carries none', () => {
    expect(withBonus(NOW_MS / 1000 - 1).farmBoost?.passBonus).toBeUndefined();
    expect(withBonus(undefined).farmBoost).toBe(NO_ECONOMY_BOOST);
  });

  it('raises gold/hr and XP/hr on the board', () => {
    const payload = { ...basePayload(), skills: { totals: skillTotals({ dmg_static: 1.5, xp_mult: 2 }) } };
    const until = NOW_MS / 1000 + 3600;
    const account = { ...payload.account, bonus_passe_ate: until, bonus_passe_ouro: 0.25, bonus_passe_xp: 0.15 };
    const on = required(buildFarmInputs(viewOf({ ...payload, account }), DEFAULT_FARM_CONTROLS, NO_ECONOMY_BOOST, NOW_MS), 'expected inputs');
    const off = required(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS, NO_ECONOMY_BOOST, NOW_MS), 'expected inputs');
    const offRows = computeFarmRanking(off).rows;
    const onRows = computeFarmRanking(on).rows;
    const priced = offRows.filter((row) => (row.xpPerHour ?? 0) > 0 && row.goldPerHour > 0);
    expect(priced.length).toBeGreaterThan(0);
    for (const row of priced) {
      const match = required(onRows[row.phase - 1] ?? null, `expected a row for phase ${String(row.phase)}`);
      expect(match.goldPerHour / row.goldPerHour).toBeCloseTo(1.25, 6);
      expect((match.xpPerHour ?? 0) / (row.xpPerHour ?? 1)).toBeCloseTo(1.15, 6);
    }
  });
});

describe('the running Boosts are read from the game, never from the account', () => {
  const XP_BOOST = { gold: false, xp: true, drop: false };

  it('reads as none when the caller supplies none', () => {
    expect(required(buildFarmInputs(viewOf(basePayload()), DEFAULT_FARM_CONTROLS), 'expected inputs').farmBoost).toBe(
      NO_ECONOMY_BOOST,
    );
  });

  it('reaches the board as supplied, and an XP Boost raises XP/hr while gold stays put', () => {
    const payload = { ...basePayload(), skills: { totals: skillTotals({ dmg_static: 1.5, xp_mult: 2 }) } };
    const boosted = required(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS, XP_BOOST), 'expected inputs');
    const bare = required(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS), 'expected inputs');
    expect(boosted.farmBoost).toBe(XP_BOOST);

    const bareRows = computeFarmRanking(bare).rows;
    const boostedRows = computeFarmRanking(boosted).rows;
    const priced = bareRows.filter((row) => (row.xpPerHour ?? 0) > 0);
    expect(priced.length).toBeGreaterThan(0);
    for (const row of priced) {
      const match = required(boostedRows[row.phase - 1] ?? null, `expected a row for phase ${String(row.phase)}`);
      expect(match.xpPerHour ?? 0).toBeGreaterThan(row.xpPerHour ?? 0);
      expect(match.goldPerHour).toBe(row.goldPerHour);
    }
  });
});

describe('the account XP multiplier reaches the board', () => {
  const inputsWith = (xpMult: number) => {
    const payload = { ...basePayload(), skills: { totals: skillTotals({ dmg_static: 1.5, xp_mult: xpMult }) } };
    return required(buildFarmInputs(viewOf(payload), DEFAULT_FARM_CONTROLS), 'expected inputs');
  };

  it('is read off the skill totals verbatim', () => {
    expect(inputsWith(2.35).treeXpMult).toBe(2.35);
  });

  it('scales every row XP/hr by exactly its ratio, and leaves gold alone', () => {
    const bare = computeFarmRanking(inputsWith(1)).rows;
    const scaled = computeFarmRanking(inputsWith(2.35)).rows;
    const priced = bare.filter((row) => (row.xpPerHour ?? 0) > 0);
    expect(priced.length).toBeGreaterThan(0);
    for (const row of priced) {
      const match = required(scaled[row.phase - 1] ?? null, `expected a row for phase ${String(row.phase)}`);
      expect((match.xpPerHour ?? Number.NaN) / (row.xpPerHour ?? Number.NaN)).toBeCloseTo(2.35, 9);
      expect(match.goldPerHour).toBe(row.goldPerHour);
    }
  });

  it('withholds XP/hr on every row when the account carries none, while gold still prices', () => {
    const inputs = inputsWith(2.35);
    const withheld = computeFarmRanking({ ...inputs, treeXpMult: null }).rows;
    const priced = computeFarmRanking(inputs).rows;
    expect(withheld.every((row) => row.xpPerHour === null)).toBe(true);
    expect(withheld.map((row) => row.goldPerHour)).toEqual(priced.map((row) => row.goldPerHour));
    expect(withheld.some((row) => row.goldPerHour > 0)).toBe(true);
  });
});

describe('the map size reaches the board', () => {
  const inputsOn = (farmMapSize: 'classic' | 'compact') =>
    required(buildFarmInputs(viewOf(basePayload()), { ...DEFAULT_FARM_CONTROLS, farmMapSize }), 'expected inputs');

  it('is carried onto the inputs as the controls name it', () => {
    expect(inputsOn('compact').farmMapSize).toBe('compact');
    expect(inputsOn('classic').farmMapSize).toBe('classic');
  });

  it('the compact map raises the board’s gold per hour, and lowers it on no map', () => {
    const classic = computeFarmRanking(inputsOn('classic')).rows;
    const compact = computeFarmRanking(inputsOn('compact')).rows;
    const priced = classic.filter((row) => row.goldPerHour > 0);
    expect(priced.length).toBeGreaterThan(0);
    for (const row of priced) {
      const match = required(compact[row.phase - 1] ?? null, `expected a row for phase ${String(row.phase)}`);
      expect(match.goldPerHour).toBeGreaterThanOrEqual(row.goldPerHour);
    }
    expect(priced.some((row) => (compact[row.phase - 1]?.goldPerHour ?? 0) > row.goldPerHour)).toBe(true);
  });
});

describe('the controls are passed through verbatim, by reference', () => {
  it('farmPoolOverrides keeps its identity — the package compares that member with Object.is', () => {
    const overrides = { h1: false };
    const aurasAtCap = ['brecha'] as const;
    const controls = { farmPoolOverrides: overrides, farmReturnBonus: 'on' as const, aurasAtCap, farmMapSize: 'classic' as const };
    const inputs = required(buildFarmInputs(viewOf(basePayload()), controls), 'expected inputs');
    expect(inputs.farmPoolOverrides).toBe(overrides);
    expect(inputs.farmReturnBonus).toBe('on');
    expect(inputs.aurasAtCap).toBe(aurasAtCap);
  });
});

describe('the adapter is pure', () => {
  it('the source file imports no React', () => {
    const source = readFileSync(path.join(__dirname, 'farm-inputs.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"]react['"]/);
  });
});
