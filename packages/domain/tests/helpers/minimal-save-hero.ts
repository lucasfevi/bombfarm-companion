const MINIMAL_BIRTH = {
  dmg: 1,
  energia: 1,
  speed: 1,
  crit_chance: 0,
  crit_dmg: 1,
  penetration: 0,
  cooldown_reduction: 0,
  luck: 0,
};

const MINIMAL_STATS = { ...MINIMAL_BIRTH };

export function minimalHero(id: string, name = 'Hero') {
  return {
    id,
    name,
    birth_stats: MINIMAL_BIRTH,
    stats: MINIMAL_STATS,
  };
}
