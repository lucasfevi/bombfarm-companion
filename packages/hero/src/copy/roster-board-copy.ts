/**
 * The strings the roster rail, board and toolbar print, on top of the hero-identity vocabulary
 * their cards already share with the picker.
 *
 * Host-supplied for the same reason {@link RosterCopy} is: a host that shows a roster has its own
 * word for "Level", its own word for "Rarity", and — once it offers a sort — its own word for
 * "Best first". Those readings belong beside the rest of that host's copy, translated by whoever
 * translates the rest of it, not in a second dictionary this package would own and neither host
 * could see.
 *
 * It EXTENDS `RosterCopy` rather than sitting beside it because the board draws hero identity too:
 * a card's gear group prints the same "Empty" and the same "Lv" a picker row does, and a host that
 * satisfies one contract and not the other could make one surface say `Lv` and the other `Nv`.
 * Both hosts already satisfy `RosterCopy` in full, so the extension costs neither of them a key.
 */
import type { RosterCopy } from './roster-copy';

export type RosterBoardCopy = RosterCopy & {
  heroesRosterTitle: string;
  heroesRosterListLabel: string;
  heroesViewLabel: string;
  heroesViewCards: string;
  heroesViewList: string;
  heroesSortLabel: string;
  heroesSortRoll: string;
  heroesSortPower: string;
  heroesSortLevel: string;
  heroesSortRarity: string;
  heroesSortRank: string;
  heroesSortStars: string;
  heroesSortAscending: string;
  heroesSortDescending: string;
  heroesFilterActiveHeroes: string;
  heroesAbilityFilterLabel: string;
  /** `{ability}` — the reading a pressable ability tile carries. */
  heroesAbilityFilterOption: string;
  /** `{ability}` — the reading a tile no hero on this roster owns carries instead. */
  heroesAbilityFilterAbsent: string;
  /** The board's card-detail control and its three presets, least to most of a hero per card. */
  heroesDensityLabel: string;
  heroesDensityCompact: string;
  heroesDensityCombat: string;
  heroesDensityFull: string;
  /** The heading over a card's sheet stats — the host's word for the stat sheet. */
  heroesCardSheetStatsLabel: string;
  /** The heading over a card's roll bars — the host's word for the birth roll. */
  heroesCardBirthStatsLabel: string;
};
