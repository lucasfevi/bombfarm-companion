export interface RosterCombatFact {
  readonly id: string;
  readonly cooldownReduction?: number;
  readonly carriesFantasma: boolean;
}

const FANTASMA_CODE = 'fantasma';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readCooldownReduction(stats: unknown): number | undefined {
  if (!isRecord(stats)) return undefined;
  const value = stats.cooldown_reduction;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) return undefined;
  return value;
}

function readCarriesFantasma(abilities: unknown): boolean {
  if (!Array.isArray(abilities)) return false;
  return abilities.some(
    (ability) =>
      isRecord(ability) && ability.code === FANTASMA_CODE && typeof ability.level === 'number' && ability.level > 0,
  );
}

export function rosterCombatFacts(rawHeroes: readonly unknown[]): RosterCombatFact[] {
  if (!Array.isArray(rawHeroes)) return [];
  const facts: RosterCombatFact[] = [];
  for (const rawHero of rawHeroes) {
    if (!isRecord(rawHero) || typeof rawHero.id !== 'string') continue;
    const cooldownReduction = readCooldownReduction(rawHero.stats);
    const carriesFantasma = readCarriesFantasma(rawHero.abilities);
    facts.push(
      cooldownReduction === undefined
        ? { id: rawHero.id, carriesFantasma }
        : { id: rawHero.id, cooldownReduction, carriesFantasma },
    );
  }
  return facts;
}
