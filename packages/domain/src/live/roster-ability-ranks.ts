import type { RosterHeroAbilities } from './drain-multipliers';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Pulls `{ id, abilities }` straight off a raw `/roster`-shaped heroes array — the wire's own
 * `code`/`level` pairs, nothing else. Deliberately NOT a save/account parse (`parseAccountPayload`
 * builds a full `HeroRecord`, gear and all): main-process code may not run that pipeline — it is
 * pure-compute work that would block the Electron main event loop, and a guard test enforces it —
 * while every drain multiplier this feeds only ever reads a hero's ability ranks.
 */
export function extractRosterHeroAbilities(rawHeroes: readonly unknown[] | undefined): readonly RosterHeroAbilities[] {
  if (!Array.isArray(rawHeroes)) return [];

  const out: RosterHeroAbilities[] = [];
  for (const rawHero of rawHeroes) {
    if (!isRecord(rawHero) || typeof rawHero.id !== 'string') continue;

    const abilities: Record<string, number> = {};
    const rawAbilities = rawHero.abilities;
    if (Array.isArray(rawAbilities)) {
      for (const rawAbility of rawAbilities) {
        if (!isRecord(rawAbility)) continue;
        const { code, level } = rawAbility;
        if (typeof code === 'string' && typeof level === 'number') abilities[code] = level;
      }
    }

    out.push({ id: rawHero.id, abilities });
  }
  return out;
}
