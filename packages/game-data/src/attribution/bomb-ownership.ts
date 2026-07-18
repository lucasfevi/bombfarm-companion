import type { RawBomb, RawHeroRecord, RawStateHero } from '@bombfarm/contracts';

export function computeHeroFt(cooldownReduction: number): number {
  return 2 * (1 - cooldownReduction);
}

export function buildFtOwnershipMap(heroes: RawHeroRecord[]): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const hero of heroes) {
    const cdr = hero.stats?.cooldown_reduction ?? 0;
    const ft = computeHeroFt(cdr);
    const list = map.get(ft) ?? [];
    list.push(hero.id);
    map.set(ft, list);
  }
  return map;
}

export function resolveBombOwner(
  bomb: RawBomb,
  ftOwnership: Map<number, string[]>,
  stateHeroes: RawStateHero[],
): string | null {
  const owners = ftOwnership.get(bomb.ft) ?? [];
  if (owners.length === 1) return owners[0] ?? null;
  if (owners.length > 1) {
    const atBirthCell = new Set(
      stateHeroes.filter((hero) => hero.c === bomb.c).map((hero) => hero.id),
    );
    const narrowed = owners.filter((id) => atBirthCell.has(id));
    if (narrowed.length === 1) return narrowed[0] ?? null;
  }
  return null;
}

export function buildBombOwnerMap(
  bombs: RawBomb[],
  heroes: RawHeroRecord[],
  stateHeroes: RawStateHero[],
): Map<RawBomb, string | null> {
  const ftOwnership = buildFtOwnershipMap(heroes);
  const owners = new Map<RawBomb, string | null>();
  for (const bomb of bombs) {
    owners.set(bomb, resolveBombOwner(bomb, ftOwnership, stateHeroes));
  }
  return owners;
}
