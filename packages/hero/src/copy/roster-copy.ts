/**
 * The hero-identity strings the roster surfaces print — the switcher, the top-squad table and the
 * hero picker, all of which the farm screen renders today.
 *
 * They are deliberately NOT in `farmEn`/`farmPtBR`. Every one of them is shared vocabulary a host
 * already prints elsewhere: "Rarity", "Power" and "Close" head this app's import preview, "Enabled"
 * / "Disabled" label the planner strip's own toggle, and "Empty" names an unequipped gear slot on
 * three screens. Copying them into the farm dictionary would give each string two owners that
 * nothing keeps in sync, and would make the farm screen's own dictionary the home of import-dialog
 * column headings.
 *
 * So the host supplies them, as a structural contract it satisfies by passing the dictionary it
 * already has. `apps/web`'s `Strings` matches member for member with no adapter; a host missing one
 * fails to compile at the call site naming the key.
 */
export type RosterCopy = {
  heroAvatarCol: string;
  heroBattleActive: string;
  heroBattleActiveTitle: string;
  heroBattleInactive: string;
  heroBattleInactiveTitle: string;
  heroBattleToggleAria: string;
  heroRank: string;
  heroStripSwitch: string;
  gearSlotEmptyAria: string;
  gearSlotEmptyTip: string;
  importClose: string;
  importColLevel: string;
  importColName: string;
  importColPower: string;
  importColRank: string;
  importColRarity: string;
  modeDps: string;
  rankLv: string;
  rosterColAbilities: string;
  rosterColGear: string;
  rosterColStatus: string;
  switchHero: string;
  switchHeroDesc: string;
  switchHeroShort: string;
};
