import type { PvpHistoryResult } from '@bombfarm/contracts';
import { PVP_WINDOW_SECS } from '@bombfarm/domain/skill-tree';
import type { SkillsCombatInput } from '@bombfarm/farm/core';

export function pvpCombatInput(
  history: PvpHistoryResult | null,
  rosterIds: ReadonlySet<string>,
): SkillsCombatInput & { readonly empty: boolean } {
  const standing = history?.standing ?? null;
  if (standing === null) {
    return { windowSecs: PVP_WINDOW_SECS, heroIds: [], phase: null, empty: true };
  }
  const heroIds = standing.squadHeroIds.filter((id) => rosterIds.has(id));
  if (heroIds.length === 0) {
    return { windowSecs: PVP_WINDOW_SECS, heroIds: [], phase: null, empty: true };
  }
  const latestPhase = history?.rows[0]?.phase;
  const phase = latestPhase ?? standing.tierFloor;
  return { windowSecs: PVP_WINDOW_SECS, heroIds, phase, empty: false };
}
