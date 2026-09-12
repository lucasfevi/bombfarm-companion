import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAccountPayload } from '@bombfarm/domain/import-save';
import type { AccountFidelity, AccountPayload, AccountView } from '@bombfarm/contracts';
import { buildAccountRoster } from './account-roster';

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

function rawHero(id: string, name = 'Hero') {
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

function basePayload(heroes: unknown[] = [rawHero('h1', 'Alpha')]): AccountPayload {
  return {
    account: { phase: 60, max_phase: 88 },
    heroes,
    skills: { totals: { dmg_static: 1.5, crit_dmg_mult: 1 } },
    casa: { active_casa: 1, levels: [10] },
    items: [],
    fidelity: resolvedFidelity(),
  };
}

function viewOf(payload: AccountPayload): AccountView {
  return { payload, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } };
}

const OFFLINE_FIXTURE = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');

function offlinePayload(): AccountPayload {
  return JSON.parse(readFileSync(OFFLINE_FIXTURE, 'utf8')) as AccountPayload;
}

function required<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

describe('one record per hero the account view carries', () => {
  it('the committed offline account yields its thirteen heroes, keyed by the game ids it carries', () => {
    const roster = required(buildAccountRoster(viewOf(offlinePayload())), 'expected a roster');
    expect(roster.heroes).toHaveLength(13);
    expect(roster.heroes.map((hero) => hero.id)).toEqual([
      '26863',
      '41990',
      '52562',
      '45497',
      '59925',
      '72601',
      '73099',
      '74555',
      '76184',
      '59925-roster',
      '71038',
      '71128',
      '71129',
    ]);
  });

  it('an account with no heroes yields an empty roster rather than throwing', () => {
    const roster = required(buildAccountRoster(viewOf(basePayload([]))), 'expected a roster');
    expect(roster.heroes).toEqual([]);
  });

  it('a payload that does not parse withholds the whole roster, rather than the heroes that did parse', () => {
    const payload = basePayload([rawHero('h1', 'Alpha'), { id: 'h2', name: 'NoBirth' }]);
    expect(buildAccountRoster(viewOf(payload))).toBeNull();
  });
});

describe('no farm control is needed to read the roster', () => {
  it('the builder takes the account view alone', () => {
    expect(buildAccountRoster).toHaveLength(1);
    expect(buildAccountRoster(viewOf(basePayload()))).not.toBeNull();
  });

  it('the source imports nothing farm-shaped, and no React', () => {
    const source = readFileSync(path.join(__dirname, 'account-roster.ts'), 'utf8');
    expect(source).not.toMatch(/from ['"][^'"]*\bfarm\b[^'"]*['"]/);
    expect(source).not.toMatch(/from ['"]react['"]/);
    expect(source).not.toMatch(/FarmControls|farmPoolOverrides|farmReturnBonus/);
  });
});

describe('the id and the capture time are the only synthesised fields', () => {
  const cases: [string, () => AccountPayload, string][] = [
    ['the offline fixture', offlinePayload, '2026-08-23T00:00:00.000Z'],
    ['a minimal account', () => basePayload(), NOW],
  ];
  it.each(cases)(
    '%s: every other field on every record is the parsed candidate record, key for key',
    (_label, payloadOf, capturedAt) => {
      const payload = payloadOf();
      const parsed = parseAccountPayload(payload, []);
      const roster = required(buildAccountRoster(viewOf(payload)), 'expected a roster');
      expect(roster.heroes.length).toBe(parsed.candidates.length);

      roster.heroes.forEach((hero, index) => {
        const candidate = required(parsed.candidates[index], `expected a candidate at ${String(index)}`);
        const { id, updatedAt, ...stats } = hero;
        expect(id).toBe(candidate.sourceId);
        expect(updatedAt).toBe(Date.parse(capturedAt));
        expect(stats).toEqual(candidate.record);
        expect(Object.keys(hero).sort()).toEqual([...Object.keys(candidate.record), 'id', 'updatedAt'].sort());
      });
    },
  );

  it('the capture time is the heroes section own, not the account section or any other', () => {
    const heroesCapturedAt = '2026-08-10T06:30:00.000Z';
    const payload: AccountPayload = {
      ...basePayload(),
      fidelity: resolvedFidelity({ heroes: { status: 'resolved', capturedAt: heroesCapturedAt } }),
    };
    const roster = required(buildAccountRoster(viewOf(payload)), 'expected a roster');
    expect(required(roster.heroes[0], 'expected a hero').updatedAt).toBe(Date.parse(heroesCapturedAt));
  });

  it('falls back to the read clock when the heroes section carries no capture time', () => {
    const before = Date.now();
    const payload: AccountPayload = { ...basePayload(), fidelity: resolvedFidelity({ heroes: { status: 'missing' } }) };
    const roster = required(buildAccountRoster(viewOf(payload)), 'expected a roster');
    const updatedAt = required(roster.heroes[0], 'expected a hero').updatedAt;
    expect(updatedAt).toBeGreaterThanOrEqual(before);
    expect(updatedAt).toBeLessThanOrEqual(Date.now());
  });
});

describe('the account-wide block comes from the same parse as the roster', () => {
  it('one parse answers both, so the two can never describe different reads', () => {
    const payload = offlinePayload();
    const roster = required(buildAccountRoster(viewOf(payload)), 'expected a roster');
    expect(roster.account).toEqual(parseAccountPayload(payload, []).account);
  });
});
