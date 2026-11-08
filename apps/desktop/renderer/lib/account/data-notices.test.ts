import { describe, expect, it } from 'vitest';
import type { AccountPayload, SectionFidelity } from '@bombfarm/contracts';
import { dataNoticesOf, heroDataReasonsOf } from './data-notices';

const AT = '2026-10-08T10:00:00.000Z';
const RESOLVED: SectionFidelity = { status: 'resolved', capturedAt: AT };
const MISSING: SectionFidelity = { status: 'missing' };

function payloadOf(parts: Partial<AccountPayload>, skills: SectionFidelity = RESOLVED): AccountPayload {
  return {
    ...parts,
    fidelity: { account: RESOLVED, heroes: RESOLVED, skills, casa: RESOLVED, items: RESOLVED },
  };
}

const LOST = ['skills.totals.xp_mult'];

describe('dataNoticesOf', () => {
  it('has nothing to say about a payload that lost nothing', () => {
    expect(dataNoticesOf(payloadOf({ heroes: [], items: [] }))).toEqual([]);
  });

  it('says the saved skill tree is on screen, with when it was read', () => {
    const payload = payloadOf({}, { status: 'stale', capturedAt: AT, lostKeys: LOST });
    expect(dataNoticesOf(payload)).toEqual([{ kind: 'skillTreeStale', capturedAt: AT }]);
  });

  it('says the tree is withheld when none was saved', () => {
    expect(dataNoticesOf(payloadOf({}, { ...MISSING, lostKeys: LOST }))).toEqual([{ kind: 'skillTreeWithheld' }]);
  });

  it('collapses a hundred orphaned pieces into one line', () => {
    const items = Array.from({ length: 100 }, (_, index) => ({ id: String(index), category: 0, rarity: 1, level: 1, upgrade: 0 }));
    expect(dataNoticesOf(payloadOf({ heroes: [], items }))).toEqual([{ kind: 'gearOwnerUnknown' }]);
  });

  it('leaves what a hero is blocked by to the flag on that hero', () => {
    const heroes = [{ id: 'h1', name: 'Alpha' }];
    expect(dataNoticesOf(payloadOf({ heroes, items: [] }))).toEqual([]);
  });
});

describe('dataNoticesOf — heroes and items that stopped reading', () => {
  const EARLIER = '2026-10-08T09:00:00.000Z';
  const stale = (capturedAt: string): SectionFidelity => ({ status: 'stale', capturedAt });
  const withPair = (heroes: SectionFidelity, items: SectionFidelity, account: SectionFidelity = RESOLVED): AccountPayload => ({
    heroes: [],
    items: [],
    fidelity: { account, heroes, skills: RESOLVED, casa: RESOLVED, items },
  });

  it('says so, with the age of the last read, once they fall behind a fresh account read', () => {
    expect(dataNoticesOf(withPair(stale(EARLIER), stale(EARLIER)))).toEqual([
      { kind: 'heroesAndItemsNotReading', capturedAt: EARLIER },
    ]);
  });

  it('stays quiet about one dropped cycle', () => {
    const justNow = '2026-10-08T09:59:00.000Z';
    expect(dataNoticesOf(withPair(stale(justNow), stale(justNow)))).toEqual([]);
  });

  it('stays quiet when the game is closed and every section is equally old', () => {
    expect(dataNoticesOf(withPair(stale(EARLIER), stale(EARLIER), stale(EARLIER)))).toEqual([]);
  });

  it('says they were never read when the account read works and nothing was saved for them', () => {
    expect(dataNoticesOf(withPair(MISSING, MISSING))).toEqual([{ kind: 'heroesAndItemsNotReading', capturedAt: null }]);
  });
});

describe('heroDataReasonsOf', () => {
  it('names the hero and the fields it lost, collapsing birth stats to one', () => {
    const heroes = [{ id: 'h1', level: 3, stars: 0, stat_points_available: 0, stats: {}, birth_stats: { dmg: 1 } }];
    const reasons = heroDataReasonsOf(payloadOf({ heroes, items: [] }));
    expect([...reasons.keys()]).toEqual(['h1']);
    expect(reasons.get('h1')).toEqual({ heroFields: ['birth_stats'], gearFields: [] });
  });

  it('names the gear fields a hero lost on a piece it wears', () => {
    const birth = { dmg: 1, energia: 1, speed: 1, penetration: 0, crit_chance: 0, cooldown_reduction: 0, crit_dmg: 1, luck: 0 };
    const heroes = [{ id: 'h1', level: 3, stars: 0, stat_points_available: 0, stats: birth, birth_stats: birth }];
    const items = [{ id: 'i1', category: 0, equipped_on: 'h1', rarity: 1, level: 3 }];
    expect(heroDataReasonsOf(payloadOf({ heroes, items })).get('h1')).toEqual({ heroFields: [], gearFields: ['upgrade'] });
  });
});
