import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createGameApiClient } from './client.js';
import type { GrantedConsent } from './consent.js';
import { createPacingGate, type PacingClock } from './pacing.js';
import type { HttpTransport } from './request.js';
import { SessionToken, grantSession } from './session.js';
import { loadFixtureJson, required } from './test-fixtures.js';

const GRANTED: GrantedConsent = { decision: 'granted', grantedAt: '2026-08-12T13:15:38.000Z', textVersion: 1 };
const session = grantSession(GRANTED, { accountId: '486', token: SessionToken.create('sentinel-client-test') });

function createTestClock(): PacingClock {
  let time = 0;
  return {
    now: () => time,
    sleep: (ms: number) => {
      time += ms;
      return Promise.resolve();
    },
  };
}

function transportFor(bodies: Record<string, Record<string, unknown>>): HttpTransport {
  return (req) => Promise.resolve({ status: 200, body: JSON.stringify(bodies[req.path] ?? {}) });
}

describe('the committed fixtures are scrubbed (D19 — the repo is public)', () => {
  const fixturesDir = fileURLToPath(new URL('./__fixtures__', import.meta.url));
  const fixtureFiles = readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

  it('finds every committed fixture file, so a new one cannot skip the scrub checks below', () => {
    expect(fixtureFiles.sort()).toEqual(['api-bodies-after.json', 'api-bodies.json', 'rotation-ready.json']);
  });

  for (const file of fixtureFiles) {
    it(`${file} carries no account_id, no player_name and no 64-hex token-shaped string`, () => {
      const text = readFileSync(`${fixturesDir}/${file}`, 'utf8');
      expect(text).not.toMatch(/"account_id"/);
      expect(text).not.toMatch(/"player_name"/);
      expect(text).not.toMatch(/[a-fA-F0-9]{64}/);
    });
  }
});

describe('api-bodies-after.json differs from api-bodies.json in exactly five dimensions (LAR-09)', () => {
  const before = loadFixtureJson('api-bodies.json');
  const after = loadFixtureJson('api-bodies-after.json');

  it('the roster hero the fixtures were built around changes level, one gear slot, stars and one ability level', () => {
    const beforeRoster = required(before['/roster'], 'no /roster body in api-bodies.json');
    const afterRoster = required(after['/roster'], 'no /roster body in api-bodies-after.json');
    const beforeHeroes = beforeRoster.heroes as Record<string, unknown>[];
    const afterHeroes = afterRoster.heroes as Record<string, unknown>[];
    const beforeHero = required(beforeHeroes[0], 'no first hero in the before fixture');
    const afterHero = required(afterHeroes[0], 'no first hero in the after fixture');

    expect(afterHero.level).toBe((beforeHero.level as number) + 1);
    expect(afterHero.stars).toBe((beforeHero.stars as number) + 1);

    const beforeSlots = beforeHero.slots as string[];
    const afterSlots = afterHero.slots as string[];
    const changedSlotIndexes = beforeSlots
      .map((value, index) => (value !== afterSlots[index] ? index : -1))
      .filter((index) => index !== -1);
    expect(changedSlotIndexes).toEqual([7]);

    const beforeAbilities = beforeHero.abilities as Array<{ level: number }>;
    const afterAbilities = afterHero.abilities as Array<{ level: number }>;
    const beforeSecondAbility = required(beforeAbilities[1], 'expected a second ability');
    const afterSecondAbility = required(afterAbilities[1], 'expected a second ability');
    const beforeFirstAbility = required(beforeAbilities[0], 'expected a first ability');
    const afterFirstAbility = required(afterAbilities[0], 'expected a first ability');
    expect(afterSecondAbility.level).toBe(beforeSecondAbility.level + 1);
    expect(afterFirstAbility.level).toBe(beforeFirstAbility.level);

    // Every other hero in the roster is byte-identical.
    expect(afterHeroes.slice(1)).toEqual(beforeHeroes.slice(1));
  });

  it('exactly one skill node level changed in /skill/state.levels', () => {
    const beforeSkills = required(before['/skill/state'], 'no /skill/state body in api-bodies.json');
    const afterSkills = required(after['/skill/state'], 'no /skill/state body in api-bodies-after.json');
    const beforeLevels = beforeSkills.levels as Record<string, number>;
    const afterLevels = afterSkills.levels as Record<string, number>;
    const changedKeys = Object.keys(beforeLevels).filter((key) => beforeLevels[key] !== afterLevels[key]);
    expect(changedKeys).toHaveLength(1);
    const [changedKey] = changedKeys;
    const changedKeyName = required(changedKey, 'expected exactly one changed skill key');
    expect(afterLevels[changedKeyName]).toBe((beforeLevels[changedKeyName] ?? 0) + 1);
  });

  it('every other route body (account, casa, items) is unchanged', () => {
    const beforeRotation = required(before['/rotation'], 'no /rotation body in api-bodies.json');
    const afterRotation = required(after['/rotation'], 'no /rotation body in api-bodies-after.json');
    expect(after['/state']).toEqual(before['/state']);
    expect(afterRotation.casa).toEqual(beforeRotation.casa);
    expect(after['/inventory']).toEqual(before['/inventory']);
  });
});

describe('createGameApiClient — holds no per-section cache (LAR-09 client half)', () => {
  it('one instance driven over two body sets returns the second, then the first bodies again return the first values', async () => {
    const client = createGameApiClient();
    const before = loadFixtureJson('api-bodies.json');
    const after = loadFixtureJson('api-bodies-after.json');

    const resultBefore1 = await client.readAllSections(session, transportFor(before), createPacingGate(createTestClock()));
    const resultAfter = await client.readAllSections(session, transportFor(after), createPacingGate(createTestClock()));
    const resultBefore2 = await client.readAllSections(session, transportFor(before), createPacingGate(createTestClock()));

    expect(resultBefore1.heroes.kind).toBe('ok');
    expect(resultAfter.heroes.kind).toBe('ok');
    expect(resultBefore2.heroes.kind).toBe('ok');

    // The "after" read reflects the change...
    expect(resultAfter).not.toEqual(resultBefore1);
    // ...and re-running the first bodies through a fresh client call returns the first values
    // again — nothing bled across calls.
    expect(resultBefore2).toEqual(resultBefore1);
  });

  it('reads all five sections, in ACCOUNT_SECTIONS order semantics (account, heroes, skills, casa, items all present)', async () => {
    const client = createGameApiClient();
    const bodies = loadFixtureJson('api-bodies.json');
    const result = await client.readAllSections(session, transportFor(bodies), createPacingGate(createTestClock()));
    expect(Object.keys(result).sort()).toEqual(['account', 'casa', 'heroes', 'items', 'skills']);
  });
});
