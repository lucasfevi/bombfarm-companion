import type { PvpHistoryResult } from '@bombfarm/contracts';
import { PVP_WINDOW_SECS, type SkillCombatWindow } from '@bombfarm/domain/skill-tree';

/**
 * The duel window with the standing PVP squad, or `null` while no squad is on record — the
 * ranking waits rather than inventing a team. Squad members the roster does not carry are dropped.
 */
export function pvpCombatWindow(history: PvpHistoryResult | null, rosterIds: ReadonlySet<string>): SkillCombatWindow | null {
  const standing = history?.standing ?? null;
  if (standing === null) return null;
  const heroIds = standing.squadHeroIds.filter((id) => rosterIds.has(id));
  if (heroIds.length === 0) return null;
  const phase = history?.rows[0]?.phase ?? standing.tierFloor;
  return { windowSecs: PVP_WINDOW_SECS, heroIds, phase };
}
