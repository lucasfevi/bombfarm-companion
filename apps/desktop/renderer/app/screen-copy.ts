/**
 * The one module in this renderer allowed to import `@bombfarm/farm/copy`, `@bombfarm/hero/copy`
 * or `@bombfarm/team-plan/copy` — a structural guard in `src/main/source-guards.test.ts` fails the build if a second one appears.
 * It serves every screen drawn from a package's own views, not just the farm board, which is why
 * it sits beside the screens rather than inside one of them.
 *
 * Three dictionaries meet here and none owns the others' words. The farm screen's own strings and
 * the per-hero detail vocabulary ship with the packages that draw them; the hero-identity
 * vocabulary their roster surfaces print is a structural contract the HOST satisfies, and this app
 * satisfies it out of `lib/copy` where every other player-facing string in this renderer already
 * lives. Composing them here rather than at the call site is what keeps "one place for copy" true
 * with a second supplier in play.
 */
import { farmCopyFor, type FarmCopy, type FarmScreenCopy } from '@bombfarm/farm/copy';
import {
  gearPanelCopyFor,
  heroCopyFor,
  statPanelCopyFor,
  type GearPanelCopy,
  type HeroCopy,
  type Lang,
  type RosterBoardCopy,
  type RosterCopy,
  type StatPanelCopy,
} from '@bombfarm/hero/copy';
import {
  teamPlanEn,
  teamPlanPtBR,
  type TeamPlanCopy,
  type TeamPlanHostCopy,
  type TeamPlanScreenCopy,
} from '@bombfarm/team-plan/copy';
import { useLocale, type Copy } from '../lib/copy';

export type { TeamPlanScreenCopy };

/** Re-exported so a screen naming one of these contracts in a prop type does not have to import
 *  a package dictionary module of its own — the one-module rule above covers types too. */
export type { GearPanelCopy, StatPanelCopy };

/**
 * Written out key by key rather than spread from the app dictionary. A spread would let any
 * same-named app key silently shadow a farm string, and would stop the typecheck naming the key
 * when the contract gains a member.
 */
export function rosterCopyFrom(t: Copy): RosterCopy {
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

/**
 * The hero-identity vocabulary above plus the words a roster rail, board and toolbar add to it —
 * their headings, the six sort keys and the ability filter's two readings.
 *
 * Same key-by-key spelling as `rosterCopyFrom`, and for the same reason: a spread would let an
 * app key shadow one of these silently, and would stop the typecheck naming the key when the
 * contract gains a member.
 */
export function rosterBoardCopyFrom(t: Copy): RosterBoardCopy {
  return {
    ...rosterCopyFrom(t),
    heroesRosterTitle: t.heroesRosterTitle,
    heroesRosterListLabel: t.heroesRosterListLabel,
    heroesViewLabel: t.heroesViewLabel,
    heroesViewCards: t.heroesViewCards,
    heroesViewList: t.heroesViewList,
    heroesViewTable: t.heroesViewTable,
    heroesSortLabel: t.heroesSortLabel,
    heroesSortRoll: t.heroesSortRoll,
    heroesSortPower: t.heroesSortPower,
    heroesSortLevel: t.heroesSortLevel,
    heroesSortRarity: t.heroesSortRarity,
    heroesSortRank: t.heroesSortRank,
    heroesSortStars: t.heroesSortStars,
    heroesSortAscending: t.heroesSortAscending,
    heroesSortDescending: t.heroesSortDescending,
    heroesFilterActiveHeroes: t.heroesFilterActiveHeroes,
    heroesAbilityFilterLabel: t.heroesAbilityFilterLabel,
    heroesAbilityFilterOption: t.heroesAbilityFilterOption,
    heroesAbilityFilterAbsent: t.heroesAbilityFilterAbsent,
  };
}

export function useFarmCopy(): FarmCopy {
  return farmCopyFor(useLocale().lang);
}

/**
 * The per-hero detail vocabulary `@bombfarm/hero` ships with its own panels — birth-roll bands,
 * ability readings, the sentences naming which phase a figure was computed at. No host prints any
 * of it anywhere else, which is why the package owns the words and this app only picks the
 * language.
 */
export function useHeroDetailCopy(): HeroCopy {
  return heroCopyFor(useLocale().lang);
}

/**
 * The sheet, points, next-point, breakdown and Items vocabulary. Both are HOST-supplied contracts
 * — the web planner satisfies them from its own dictionary — and this app takes the package's own
 * defaults instead, because it prints not one of those 125 strings anywhere else. Satisfying them
 * from `lib/copy` would mean two owners for every one of them and no way to keep the two hosts
 * saying the same thing.
 */
export function useStatPanelCopy(): StatPanelCopy {
  return statPanelCopyFor(useLocale().lang);
}

export function useGearPanelCopy(): GearPanelCopy {
  return gearPanelCopyFor(useLocale().lang);
}

/** The board's dictionary plus this app's hero-identity vocabulary — what the phase explorer
 *  takes. Memoised by the caller; this function allocates on every call by design, so it stays a
 *  plain composition rather than a second cache to keep correct. */
export function farmScreenCopy(farm: FarmCopy, t: Copy): FarmScreenCopy {
  return { ...farm, ...rosterCopyFrom(t) };
}

/** The package's own dictionary in the app's language — the two objects the package exports,
 *  picked by the same `DomainLang` every other package dictionary here is picked by. */
export function useTeamPlanCopy(): TeamPlanCopy {
  return useLocale().lang === 'en' ? teamPlanEn : teamPlanPtBR;
}

/**
 * The host half of the optimizer's dictionary, key by key — a spread would let an app key shadow a
 * package string silently and stop the typecheck naming the key when the contract gains a member.
 */
export function optimizerHostCopyFrom(t: Copy): TeamPlanHostCopy {
  return {
    teamPlanEmptyNoRosterTitle: t.optimizerEmptyNoRosterTitle,
    teamPlanEmptyNoRosterBody: t.optimizerEmptyNoRosterBody,
    teamPlanEmptyNoInventoryTitle: t.optimizerEmptyNoInventoryTitle,
    teamPlanEmptyNoInventoryBody: t.optimizerEmptyNoInventoryBody,
    teamPlanEmptyAllLeaveAloneTitle: t.optimizerEmptyAllLeaveAloneTitle,
    teamPlanEmptyAllLeaveAloneBody: t.optimizerEmptyAllLeaveAloneBody,
    teamPlanBlockedBody: t.optimizerBlockedBody,
    teamPlanObjectiveFarmNeedsMaxPhase: t.optimizerFarmNeedsMaxPhase,
  };
}

/**
 * The package's dictionary plus this app's eight host strings, plus the hero-identity and
 * stat-panel vocabulary the per-hero breakdown panels deep in the screen read
 * (`TeamPlanScreenCopy` is `TeamPlanCopy & TeamPlanHostCopy & RosterCopy & StatPanelCopy` — the
 * same two contracts `@bombfarm/hero`'s own panels take). Memoised by the caller; allocates on
 * every call by design, like `farmScreenCopy`.
 *
 * SPEC_DEVIATION: an earlier sketch of this function returned only `TeamPlanCopy &
 * TeamPlanHostCopy`; the package as it landed widened `TeamPlanScreenCopy` to also require
 * `RosterCopy` and `StatPanelCopy` (the same widening `apps/web`'s connector accounts for), so
 * this composes those two in as well, key by key / via the existing package-default hooks — never
 * a spread of the app dictionary itself into the contract.
 */
export function optimizerScreenCopy(teamPlan: TeamPlanCopy, t: Copy, lang: Lang): TeamPlanScreenCopy {
  return {
    ...teamPlan,
    ...optimizerHostCopyFrom(t),
    ...rosterCopyFrom(t),
    ...statPanelCopyFor(lang),
  };
}
