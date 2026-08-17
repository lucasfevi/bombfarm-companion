import { ABILITIES, type AbilityDef, isSheetAbility } from './model';

/** Catalog ids assigned to this hero (includes level 0 slots). */
export function heroAbilityIds(abilities: Record<string, number>): string[] {
  const known = new Set(ABILITIES.map((ability) => ability.id));
  return Object.keys(abilities).filter((abilityId) => known.has(abilityId));
}

/** Ability cards for the hero’s fixed save pool. */
export function abilitiesForHero(abilities: Record<string, number>): AbilityDef[] {
  const byId = new Map(ABILITIES.map((ability) => [ability.id, ability]));
  return heroAbilityIds(abilities)
    .map((abilityId) => byId.get(abilityId))
    .filter((ability): ability is AbilityDef => ability != null);
}

export function abilitiesForHeroOrdered(abilities: Record<string, number>): AbilityDef[] {
  return [...abilitiesForHero(abilities)].sort(
    (left, right) => Number(isSheetAbility(right)) - Number(isSheetAbility(left)),
  );
}

/** Roster / picker — every pool slot, including unspent (level 0). */
export function heroAbilityIconEntries(
  abilities: Record<string, number>,
): Array<{ id: string; level: number; max: number }> {
  const maxById = new Map(ABILITIES.map((ability) => [ability.id, ability.max]));
  return heroAbilityIds(abilities).map((abilityId) => ({
    id: abilityId,
    level: abilities[abilityId] ?? 0,
    max: maxById.get(abilityId) ?? 20,
  }));
}

/** Slot quota from the hero’s fixed pool size. */
export function heroAbilitySlotsUsed(abilities: Record<string, number>): number {
  return heroAbilityIds(abilities).length;
}

/** Zero levels but keep pool keys. */
export function resetHeroAbilities(abilities: Record<string, number>): Record<string, number> {
  return Object.fromEntries(heroAbilityIds(abilities).map((abilityId) => [abilityId, 0]));
}
