import {
  TEAM_BUFF_ABILITY_IDS,
  TEAM_BUFF_PER_LEVEL,
  zeroTeamBuffs,
  type TeamBuffId,
} from '../team-buffs';
import type { HeroPlanContext } from './types';

/**
 * The roster-wide, duty-weighted aura total EVERY optimize-scope hero experiences — nobody is
 * excluded (issue #132): a hero's own rank counts toward the total exactly like every other
 * carrier's, at that hero's own duty (from the previous fixed-point round). Because the result
 * no longer depends on which hero is asking, callers should compute it ONCE per round rather
 * than once per hero — `evaluateRoster` does exactly that.
 */
export function computeRosterAuras(
  contexts: HeroPlanContext[],
  dutyByHeroId: Record<string, number>,
): Record<TeamBuffId, number> {
  const out = zeroTeamBuffs();
  for (const buffId of TEAM_BUFF_ABILITY_IDS) {
    const perLevel = TEAM_BUFF_PER_LEVEL[buffId];
    let sum = 0;
    for (const ctx of contexts) {
      if (ctx.scope !== 'optimize') continue;
      const rank = ctx.abilities[buffId] ?? 0;
      const duty = dutyByHeroId[ctx.heroId] ?? 0;
      sum += perLevel * rank * duty;
    }
    out[buffId] = sum;
  }
  return out;
}
