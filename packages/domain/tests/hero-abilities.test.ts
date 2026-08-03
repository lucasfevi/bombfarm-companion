import { describe, expect, it } from 'vitest';
import {
  abilitiesForHero,
  abilitiesForHeroOrdered,
  heroAbilityIconEntries,
  heroAbilityIds,
  heroAbilitySlotsUsed,
  resetHeroAbilities,
} from '@/shared/domain/hero-abilities';

describe('hero-abilities', () => {
  it('keeps level-0 slots in the pool', () => {
    const abilities = { marcha_acelerada: 0, olho_clinico: 10 };
    expect(heroAbilityIds(abilities)).toEqual(['marcha_acelerada', 'olho_clinico']);
    expect(heroAbilitySlotsUsed(abilities)).toBe(2);
  });

  it('shows only pool abilities', () => {
    const abilities = { detonacao_dupla: 10, passagem_bastao: 10 };
    const defs = abilitiesForHero(abilities);
    expect(defs.map((a) => a.id).sort()).toEqual(['detonacao_dupla', 'passagem_bastao']);
    expect(defs).toHaveLength(2);
  });

  it('returns empty grid when pool is empty', () => {
    expect(abilitiesForHero({})).toEqual([]);
  });

  it('lists unspent pool slots in roster icons', () => {
    const entries = heroAbilityIconEntries({ marcha_acelerada: 0, olho_clinico: 10 });
    expect(entries).toEqual([
      { id: 'marcha_acelerada', level: 0 },
      { id: 'olho_clinico', level: 10 },
    ]);
  });

  it('reset zeroes levels but keeps pool keys', () => {
    expect(resetHeroAbilities({ marcha_acelerada: 0, olho_clinico: 10 })).toEqual({
      marcha_acelerada: 0,
      olho_clinico: 0,
    });
  });

  it('orders sheet abilities first like the legacy grid', () => {
    const ordered = abilitiesForHeroOrdered({ olho_clinico: 10, detonacao_dupla: 10 });
    expect(ordered[0]?.id).toBe('olho_clinico');
  });
});
