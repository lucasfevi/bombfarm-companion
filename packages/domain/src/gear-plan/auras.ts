import { ABILITIES } from '../model';
import { TEAM_BUFF_ABILITY_IDS, zeroTeamBuffs, type TeamBuffId } from '../team-buffs';
import type { HeroPlanContext } from './types';

export function computeRosterAuras(
  contexts: HeroPlanContext[],
  dutyByHeroId: Record<string, number>,
  excludeHeroId: string,
): Record<TeamBuffId, number> {
  const out = zeroTeamBuffs();
  for (const buffId of TEAM_BUFF_ABILITY_IDS) {
    const definition = ABILITIES.find((ability) => ability.id === buffId);
    const perLevel =
      definition && 'perLevel' in definition.effect ? definition.effect.perLevel : 0;
    let sum = 0;
    for (const ctx of contexts) {
      if (ctx.heroId === excludeHeroId) continue;
      if (ctx.scope !== 'optimize') continue;
      const rank = ctx.abilities[buffId] ?? 0;
      const duty = dutyByHeroId[ctx.heroId] ?? 0;
      sum += perLevel * rank * duty;
    }
    out[buffId] = sum;
  }
  return out;
}
