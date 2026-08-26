import { teamDrainMultFromTeamBuffs } from '../derive';
import { abilityMods } from '../model';
import { computeTeamBuffsFromDeployed } from '../team-buffs';
import type { DrainMultipliers } from './field-countdown';

/** Only the roster fields {@link resolveFieldDrainMultipliers} needs — deliberately not the full
 *  `HeroRecord` its own maths was designed against, so a caller barred from running the full
 *  save-parsing pipeline can supply a cheap projection instead, without a wasted
 *  gear/tree/point-inference computation nothing here reads. */
export interface RosterHeroAbilities {
  readonly id: string;
  readonly abilities: Record<string, number>;
}

/**
 * Resolves each on-field hero's own {@link DrainMultipliers} from its roster record:
 * `selfDrainMult` from that hero's own Bateria Extra rank, `teamDrainMult` from the Fôlego de
 * Mineiro total THIS set of heroes carries. The team aura is a property of who is standing in the
 * field right now — every hero here is treated as deployed regardless of any roster-level
 * `deployed` flag, since that flag can lag a live tick's on-field set.
 */
export function resolveFieldDrainMultipliers(
  onFieldHeroes: readonly RosterHeroAbilities[],
): ReadonlyMap<string, DrainMultipliers> {
  const asDeployed = onFieldHeroes.map((hero) => ({ abilities: hero.abilities, deployed: true }));
  const teamDrainMult = teamDrainMultFromTeamBuffs(computeTeamBuffsFromDeployed(asDeployed));

  const out = new Map<string, DrainMultipliers>();
  for (const hero of onFieldHeroes) {
    out.set(hero.id, { selfDrainMult: abilityMods(hero.abilities).drainMult, teamDrainMult });
  }
  return out;
}
