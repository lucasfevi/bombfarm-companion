import { setName } from '@bombfarm/domain/game-labels';
import { SET_FARM_SETS, setFarmBand } from '@bombfarm/domain/team-plan/set-farm';
import { formatNumber } from '@bombfarm/ui';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { TeamPlanCopy } from '../copy';

export type FarmSetOption = {
  value: string;
  label: string;
  /** The account has not reached the first phase this set drops on, so there is nothing to farm. */
  unreached: boolean;
};

/**
 * Every set, in the order the game drops them, named with the phases it drops on. A set whose
 * band starts past the account's furthest phase is marked rather than hidden: the player can see
 * where the set they want lives. An unknown furthest phase marks nothing.
 */
export function teamPlanFarmSetOptions(t: TeamPlanCopy, lang: Lang, maxPhase: number | null): FarmSetOption[] {
  return SET_FARM_SETS.flatMap((setId) => {
    const band = setFarmBand(setId);
    if (band === null) return [];
    const unreached = maxPhase !== null && band.minPhase > maxPhase;
    const label = sub(unreached ? t.teamPlanFarmSetOptionLocked : t.teamPlanFarmSetOption, {
      set: setName(setId, lang),
      min: formatNumber(band.minPhase, lang, 0),
      max: formatNumber(band.maxPhase, lang, 0),
    });
    return [{ value: setId, label, unreached }];
  });
}
