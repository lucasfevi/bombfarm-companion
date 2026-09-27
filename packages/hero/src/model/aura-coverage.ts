import {
  TEAM_ABILITY_IDS,
  ownAbilityReadout,
  type AbilityEffectReadout,
  type TeamAbilityId,
} from '@bombfarm/domain/ability-effect-readout';
import { abilityReadoutText } from '@bombfarm/domain/game-labels';
import { ABILITIES } from '@bombfarm/domain/model';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { Lang } from '../copy';

export type AuraCoverageTile =
  | { readonly auraId: TeamAbilityId; readonly covered: false; readonly maxLevel: number }
  | {
      readonly auraId: TeamAbilityId;
      readonly covered: true;
      readonly maxLevel: number;
      /** The highest carrier's level. Several carriers sum toward the aura's cap in the game; a
       *  tile shows one carrier's strength, not that squad total. */
      readonly level: number;
      readonly readout: AbilityEffectReadout;
      /** "+20% attack", "+10.0% gold" — the domain's own readout at {@link level}. */
      readonly valueText: string;
    };

export type AuraCoverage = {
  readonly tiles: readonly AuraCoverageTile[];
  readonly coveredCount: number;
  readonly total: number;
};

const MAX_LEVEL_BY_ID = new Map(ABILITIES.map((ability) => [ability.id, ability.max]));

function bestCarrierLevel(
  heroes: readonly Pick<HeroRecord, 'abilities'>[],
  auraId: TeamAbilityId,
): number {
  return heroes.reduce((best, hero) => Math.max(best, hero.abilities[auraId] ?? 0), 0);
}

/** Every team aura, in the domain's order, and how well these heroes cover it. */
export function auraCoverageFor(
  heroes: readonly Pick<HeroRecord, 'abilities'>[],
  lang: Lang,
  formatNumber: (value: number, decimals: number) => string,
): AuraCoverage {
  const tiles = TEAM_ABILITY_IDS.map((auraId): AuraCoverageTile => {
    const maxLevel = MAX_LEVEL_BY_ID.get(auraId) ?? 0;
    const level = bestCarrierLevel(heroes, auraId);
    if (level <= 0) return { auraId, covered: false, maxLevel };
    const readout = ownAbilityReadout(auraId, level);
    return {
      auraId,
      covered: true,
      maxLevel,
      level,
      readout,
      valueText: abilityReadoutText(readout, lang, formatNumber),
    };
  });
  return {
    tiles,
    coveredCount: tiles.filter((tile) => tile.covered).length,
    total: tiles.length,
  };
}
