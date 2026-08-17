import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyLoadout } from '@bombfarm/domain/gear';
import { HERO_MAX_LEVEL } from '@bombfarm/domain/model';
import { normalizeHero } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';

describe('hero-draft slice', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('object-valued setters preserve identity on equal writes (W5-05)', () => {
    const naked = usePlannerStore.getState().naked;
    usePlannerStore.getState().setNaked(naked);
    expect(usePlannerStore.getState().naked).toBe(naked);

    const loadout = usePlannerStore.getState().loadout;
    usePlannerStore.getState().setLoadout(loadout);
    expect(usePlannerStore.getState().loadout).toBe(loadout);

    const pts = usePlannerStore.getState().pts;
    usePlannerStore.getState().setPts(pts);
    expect(usePlannerStore.getState().pts).toBe(pts);
  });

  it('applyHero writes all fields in one set (atomic)', () => {
    const hero = normalizeHero({
      id: 'h1',
      name: 'Imported',
      sourceId: 'src-1',
      updatedAt: 1,
      rarity: 'Épico',
      level: 42,
      stars: 2,
      naked: {
        attack: 11,
        energy: 12,
        speed: 13,
        critChance: 1,
        critDmg: 2,
        penetration: 0,
        cdr: 0,
        luck: 0,
      },
      gearedOverride: {
        attack: 20,
        energy: 21,
        speed: 22,
        critChance: 3,
        critDmg: 4,
        penetration: 1,
        cdr: 0,
        luck: 0,
      },
      loadout: emptyLoadout(),
      abilities: { fireball: 3 },
      pts: {
        attack: 1,
        energy: 0,
        speed: 0,
        critChance: 0,
        critDmg: 0,
        penetration: 0,
        cdr: 0,
        luck: 0,
      },
      rank: 'A',
      power: 999,
      deployed: true,
      battleAllowed: false,
      skin: 2,
    });

    usePlannerStore.getState().applyHero(hero);
    const s = usePlannerStore.getState();
    expect(s.heroName).toBe('Imported');
    expect(s.rarity).toBe('Épico');
    expect(s.level).toBe(42);
    expect(s.stars).toBe(2);
    expect(s.heroSourceId).toBe('src-1');
    expect(s.heroRank).toBe('A');
    expect(s.heroPower).toBe(999);
    expect(s.heroDeployed).toBe(true);
    expect(s.heroBattleAllowed).toBe(false);
    expect(s.heroSkin).toBe(2);
    expect(s.abilities).toEqual({ fireball: 3 });
  });

  it('draft state and setters no longer expose observed-hit fields (BSPW1-AC-02)', () => {
    const s = usePlannerStore.getState();
    expect('obsHit' in s).toBe(false);
    expect('obsCrit' in s).toBe(false);
    expect('setObsHit' in s).toBe(false);
    expect('setObsCrit' in s).toBe(false);
  });

  it('setHeroLevel clamps to 0–HERO_MAX_LEVEL', () => {
    usePlannerStore.getState().setHeroLevel(-5);
    expect(usePlannerStore.getState().level).toBe(0);
    usePlannerStore.getState().setHeroLevel(HERO_MAX_LEVEL + 50);
    expect(usePlannerStore.getState().level).toBe(HERO_MAX_LEVEL);
    // The 2026-08-15 patch raised the ceiling 100 → 500; a level the old cap rejected is now
    // a legal value the slice must keep verbatim.
    usePlannerStore.getState().setHeroLevel(150);
    expect(usePlannerStore.getState().level).toBe(150);
  });

  it('setStars clamps to 0–3', () => {
    usePlannerStore.getState().setStars(-1);
    expect(usePlannerStore.getState().stars).toBe(0);
    usePlannerStore.getState().setStars(5);
    expect(usePlannerStore.getState().stars).toBe(3);
  });

  it('resetPlannerStoreForTests restores draft defaults', () => {
    usePlannerStore.getState().setHeroName('Edited');
    usePlannerStore.getState().setHeroLevel(50);
    resetPlannerStoreForTests();
    expect(usePlannerStore.getState().heroName).toBe('Hero');
    expect(usePlannerStore.getState().level).toBe(0);
  });

  it('buildHeroRecord projects current draft fields', () => {
    usePlannerStore.getState().setHeroName('  Strip  ');
    usePlannerStore.getState().setHeroLevel(10);
    const record = usePlannerStore.getState().buildHeroRecord('h1');
    expect(record.id).toBe('h1');
    expect(record.name).toBe('Strip');
    expect(record.level).toBe(10);
    expect(Object.keys(record)).not.toContain('obsHit');
    expect(Object.keys(record)).not.toContain('obsCrit');
  });
});
