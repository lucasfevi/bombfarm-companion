/**
 * The sustained DPS the share card prints beside each hero: the figure this screen's own Combat
 * stage shows for that hero at that phase — its own aura and no other team aura switched on.
 *
 * A hero whose spent points were not read, or an account whose skill tree or House was not, gets
 * no figure at all, exactly as the detail pane withholds its own.
 */
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { noTeamAuraSwitches } from '@bombfarm/domain/team-buffs';
import { accountAroundHero } from '../../lib/account/account-shared';
import { unrecoveredPointsHeroIds, type AccountRoster } from '../../lib/account/account-roster';
import { heroComputeInputs } from './hero-compute-inputs';

export type ShareCardDpsSource = (phase: number, heroIds: readonly string[]) => ReadonlyMap<string, number>;

/** One roster's figures, each worked out once per phase and hero however often the card asks —
 *  dragging the phase back over ground already covered costs nothing. */
export function createShareCardDps(roster: AccountRoster): ShareCardDpsSource {
  const withheld = unrecoveredPointsHeroIds(roster);
  const heroesById = new Map(roster.heroes.map((hero) => [hero.id, hero]));
  const byPhase = new Map<number, Map<string, number | null>>();
  const switches = noTeamAuraSwitches();

  return (phase, heroIds) => {
    const inputs = heroComputeInputs(roster, phase);
    const out = new Map<string, number>();
    if (inputs === null) return out;

    let known = byPhase.get(inputs.phase);
    if (known === undefined) {
      known = new Map();
      byPhase.set(inputs.phase, known);
    }
    for (const heroId of heroIds) {
      let dps = known.get(heroId);
      if (dps === undefined) {
        const hero = heroesById.get(heroId);
        dps =
          hero === undefined || withheld.has(heroId)
            ? null
            : pipelineForHero(
                hero,
                accountAroundHero(inputs.account, hero, switches, roster.heroes),
                inputs.phase,
                inputs.mitigationPct,
              ).dps;
        known.set(heroId, dps);
      }
      if (dps !== null) out.set(heroId, dps);
    }
    return out;
  };
}
