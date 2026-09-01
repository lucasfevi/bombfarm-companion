/**
 * The one module in this renderer allowed to import `@bombfarm/farm/copy` — a structural guard in
 * `src/main/source-guards.test.ts` fails the build if a second one appears.
 *
 * Two dictionaries meet here and neither owns the other's words. The farm screen's own strings
 * ship with the package that draws it; the hero-identity vocabulary its roster surfaces print is
 * a structural contract the HOST satisfies, and this app satisfies it out of `lib/copy` where
 * every other player-facing string in this renderer already lives. Composing them here rather
 * than at the call site is what keeps "one place for copy" true with a second supplier in play.
 */
import { farmCopyFor, type FarmCopy, type FarmRosterCopy, type FarmScreenCopy } from '@bombfarm/farm/copy';
import { useLocale, type Copy } from '../../lib/copy';

/**
 * Written out key by key rather than spread from the app dictionary. A spread would let any
 * same-named app key silently shadow a farm string, and would stop the typecheck naming the key
 * when the contract gains a member.
 */
function farmRosterCopyFrom(t: Copy): FarmRosterCopy {
  return {
    heroAvatarCol: t.heroAvatarCol,
    heroBattleActive: t.heroBattleActive,
    heroBattleActiveTitle: t.heroBattleActiveTitle,
    heroBattleInactive: t.heroBattleInactive,
    heroBattleInactiveTitle: t.heroBattleInactiveTitle,
    heroBattleToggleAria: t.heroBattleToggleAria,
    heroRank: t.heroRank,
    heroStripSwitch: t.heroStripSwitch,
    gearSlotEmptyAria: t.gearSlotEmptyAria,
    gearSlotEmptyTip: t.gearSlotEmptyTip,
    importClose: t.importClose,
    importColLevel: t.importColLevel,
    importColName: t.importColName,
    importColPower: t.importColPower,
    importColRank: t.importColRank,
    importColRarity: t.importColRarity,
    modeDps: t.modeDps,
    rankLv: t.rankLv,
    rosterColAbilities: t.rosterColAbilities,
    rosterColGear: t.rosterColGear,
    rosterColStatus: t.rosterColStatus,
    switchHero: t.switchHero,
    switchHeroDesc: t.switchHeroDesc,
    switchHeroShort: t.switchHeroShort,
  };
}

export function useFarmCopy(): FarmCopy {
  return farmCopyFor(useLocale().lang);
}

/** The board's dictionary plus this app's hero-identity vocabulary — what the phase explorer
 *  takes. Memoised by the caller; this function allocates on every call by design, so it stays a
 *  plain composition rather than a second cache to keep correct. */
export function farmScreenCopy(farm: FarmCopy, t: Copy): FarmScreenCopy {
  return { ...farm, ...farmRosterCopyFrom(t) };
}
