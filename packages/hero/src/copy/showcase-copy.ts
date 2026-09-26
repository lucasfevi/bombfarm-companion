/**
 * The strings the roster showcase prints — hero types, highest rolls, the summary strip, the
 * team-aura grid and the leaderboard.
 *
 * Owned here rather than host-supplied: no host prints any of this on another screen, so making
 * both hosts translate it would give every string two owners.
 */
import type { SheetKey } from '@bombfarm/domain/planner-constants';

export type ShowcaseCopy = {
  readonly typeCrit: string;
  readonly typeHeavy: string;
  readonly typePierce: string;
  readonly typeFinish: string;
  readonly typeGate: string;
  readonly typeLoot: string;
  readonly typeBuff: string;
  readonly typeEndure: string;
  readonly typeNone: string;
  /** `{rolls}` — the stat labels and percentages, already joined. */
  readonly highestRolls: string;
  /** `{stat}` `{pct}` — one entry of {@link highestRolls}. */
  readonly highestRollEntry: string;
  readonly highestRollsSeparator: string;
  /** Short enough for a card line; spelled as the players say them. */
  readonly rollStat: { readonly [K in SheetKey]: string };
  readonly summaryTitle: string;
  readonly summarySquadPower: string;
  readonly summaryRarityMix: string;
  readonly summaryMaxPhase: string;
  readonly summaryAverageItemLevel: string;
  readonly summaryAverageForge: string;
  /** `{count}` */
  readonly summarySquadCount: string;
  /** `{count}` */
  readonly summaryBenchCount: string;
  readonly summaryHeroes: string;
  /** `{count}` `{rarity}` — one entry of the rarity legend. */
  readonly summaryRarityEntry: string;
  readonly summarySquadGear: string;
  /** `{level}` `{forge}` */
  readonly summaryGearAverages: string;
  /** `{count}` */
  readonly summaryGearItems: string;
  readonly summaryGearRange: string;
  /** `{position}` */
  readonly cardPosition: string;
  readonly cardPower: string;
  /** `{level}` */
  readonly cardLevel: string;
  /** `{grade}` */
  readonly cardBirthGrade: string;
  /** `{pct}` */
  readonly cardBirthRoll: string;
  /** The board's one switch for every item level, forge `+N` and ability level on its cards. */
  readonly cardShowLevels: string;
  /** `{level}` `{forge}` */
  readonly cardAverageItemLevel: string;
  readonly cardNothingEquipped: string;
  readonly aurasTitle: string;
  /** `{covered}` `{total}` */
  readonly aurasCovered: string;
  /** `{level}` `{max}` */
  readonly auraLevel: string;
  readonly auraNoCarrier: string;
  readonly columnPosition: string;
  readonly columnName: string;
  readonly columnRarity: string;
  readonly columnLevel: string;
  readonly columnBirth: string;
  readonly columnPower: string;
  readonly columnAttack: string;
  readonly columnEnergy: string;
  readonly columnPenetration: string;
  readonly columnCdr: string;
  readonly columnCritChance: string;
  readonly columnCritDmg: string;
  readonly columnLuck: string;
  readonly columnSpeed: string;
  readonly columnAbilities: string;
  readonly columnGear: string;
  readonly filterEveryone: string;
  readonly filterSquad: string;
  readonly filterBench: string;
  /** Names the Everyone / Squad / Bench group for assistive technology. */
  readonly tableFilterLabel: string;
  readonly tableLabel: string;
  readonly tableHint: string;
  readonly tableEmpty: string;
  /** `{count}` `{slots}` `{level}` — pieces worn, of how many, and their average item level. */
  readonly tableGear: string;
  readonly tableColumns: string;
  readonly tableColumnsShown: string;
  readonly tableColumnsShowAll: string;
  readonly tableColumnsHideAll: string;
  readonly tableColumnsSearch: string;
  readonly tableColumnsEmpty: string;
};
