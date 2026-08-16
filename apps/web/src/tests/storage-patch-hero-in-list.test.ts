/**
 * `patchHeroInList` — the roster-patch helper the 700ms hero autosave runs on every fire.
 *
 * Split out of `storage-i18n.test.ts` when the identity cases landed; that file is an i18n suite
 * and was never the right home for this.
 */
import { describe, expect, it } from 'vitest';
import { normalizeHero, patchHeroInList, type HeroRecord } from '@/shared/lib/storage';

describe('patchHeroInList', () => {
  const base = (id: string, name: string): HeroRecord =>
    normalizeHero({ id, name, updatedAt: 1 });

  it('replaces the matching hero and keeps other refs', () => {
    const a = base('a', 'Alpha');
    const b = base('b', 'Beta');
    const saved = { ...b, name: 'Beta2', updatedAt: 99 };
    const next = patchHeroInList([a, b], saved);
    expect(next).toHaveLength(2);
    expect(next[0]).toBe(a);
    expect(next[1]).toBe(saved);
    expect(next[1].name).toBe('Beta2');
  });

  it('appends when the saved id is not yet in the list', () => {
    const a = base('a', 'Alpha');
    const saved = base('new', 'Fresh');
    const next = patchHeroInList([a], saved);
    expect(next).toEqual([a, saved]);
    expect(next[0]).toBe(a);
  });

  /**
   * The array IDENTITY contract — see `patchHeroInList` in `@/shared/lib/storage` for the
   * mechanism and why it is load-bearing. These are the cases that would have caught the defect.
   */
  describe('identity stability', () => {
    /** A hero with every nested branch populated — an all-zero record would let a broken
     *  comparison pass by accident. */
    const loaded = (id: string, name: string): HeroRecord =>
      normalizeHero({
        id,
        name,
        updatedAt: 1,
        level: 40,
        stars: 2,
        naked: { attack: 900, energy: 120, speed: 11, critChance: 14, critDmg: 210, penetration: 8, cdr: 6, luck: 4 },
        pts: { attack: 30, energy: 5, speed: 2, critChance: 4, critDmg: 6, penetration: 1, cdr: 0, luck: 3 },
        abilities: { bomba_potente: 5, mineracao: 2 },
        loadout: { arma: { defId: 'arma-1', rarityIdx: 3, level: 60, upgrade: 4 } },
        gearedOverride: { attack: 1400, energy: 150, speed: 12, critChance: 18, critDmg: 260, penetration: 9, cdr: 7, luck: 5 },
        sourceId: `src-${id}`,
        statPointsAvailable: 7,
      });

    it('returns the SAME array when the saved hero is value-equal (fresh object, new save stamp)', () => {
      const a = loaded('a', 'Alpha');
      const b = loaded('b', 'Beta');
      const list = [a, b];
      // What the 700ms autosave produces: a rebuilt record, identical data, a later stamp.
      const saved = normalizeHero({ ...structuredClone(b), updatedAt: b.updatedAt + 5_000 });
      expect(saved).not.toBe(b);
      expect(saved).not.toEqual(b); // differs — by the save stamp alone.
      expect(patchHeroInList(list, saved)).toBe(list);
    });

    it('survives a real localStorage-shaped round-trip of the same data', () => {
      const b = loaded('b', 'Beta');
      const list = [loaded('a', 'Alpha'), b];
      const saved = normalizeHero(JSON.parse(JSON.stringify(b)) as HeroRecord);
      expect(patchHeroInList(list, saved)).toBe(list);
    });

    it('still returns a NEW array carrying the new value when a top-level field changed', () => {
      const a = loaded('a', 'Alpha');
      const b = loaded('b', 'Beta');
      const list = [a, b];
      const saved: HeroRecord = { ...structuredClone(b), level: b.level + 1 };
      const next = patchHeroInList(list, saved);
      expect(next).not.toBe(list);
      expect(next[0]).toBe(a);
      expect(next[1]).toBe(saved);
      expect(next[1].level).toBe(b.level + 1);
    });

    it.each<[string, (hero: HeroRecord) => Partial<HeroRecord>]>([
      ['naked (nested sheet)', (hero) => ({ naked: { ...hero.naked, attack: hero.naked.attack + 1 } })],
      ['pts (nested alloc)', (hero) => ({ pts: { ...hero.pts, cdr: hero.pts.cdr + 1 } })],
      ['abilities — new key', (hero) => ({ abilities: { ...hero.abilities, veia_ouro: 3 } })],
      ['abilities — changed level', (hero) => ({ abilities: { ...hero.abilities, mineracao: 4 } })],
      ['abilities — removed key', () => ({ abilities: { bomba_potente: 5 } })],
      ['loadout — item upgraded', (hero) => ({
        loadout: { ...hero.loadout, arma: { ...hero.loadout.arma!, upgrade: 5 } },
      })],
      ['loadout — slot emptied', () => ({ loadout: {} })],
      ['altLoadout — null becomes an object', () => ({ altLoadout: {} })],
      ['birth — undefined becomes a sheet', (hero) => ({ birth: { ...hero.naked } })],
      ['gearedOverride (nested sheet)', (hero) => ({
        gearedOverride: { ...hero.gearedOverride, critChance: hero.gearedOverride.critChance + 1 },
      })],
      ['statPointsAvailable', (hero) => ({ statPointsAvailable: (hero.statPointsAvailable ?? 0) + 1 })],
    ])('a NESTED edit under %s is never swallowed — a new array with the new value comes back', (_label, patch) => {
      const b = loaded('b', 'Beta');
      const list = [loaded('a', 'Alpha'), b];
      const saved: HeroRecord = { ...structuredClone(b), ...patch(b), updatedAt: b.updatedAt + 5_000 };
      const next = patchHeroInList(list, saved);
      expect(next).not.toBe(list);
      expect(next[1]).toBe(saved);
    });

    it('a bare `updatedAt` bump alone is not an edit — the save stamp is excluded from the compare', () => {
      const b = loaded('b', 'Beta');
      const list = [b];
      expect(patchHeroInList(list, { ...b, updatedAt: b.updatedAt + 1 })).toBe(list);
    });

    it('appending an absent hero still allocates — the guard only covers the in-place case', () => {
      const a = loaded('a', 'Alpha');
      const list = [a];
      expect(patchHeroInList(list, loaded('new', 'Fresh'))).not.toBe(list);
    });
  });
});
