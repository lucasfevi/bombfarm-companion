/**
 * The strings the share card and its controls print. Owned here for the reason the showcase's
 * are: no host prints any of this on another screen.
 */
export type ShareCardCopy = {
  readonly openButton: string;
  readonly dialogTitle: string;
  readonly dialogClose: string;
  readonly brand: string;
  /** The title when the read carried no player name. */
  readonly fallbackTitle: string;
  /** `{id}` */
  readonly accountNumber: string;
  /** `{phase}` */
  readonly currentPhase: string;
  /** `{phase}` */
  readonly maxPhase: string;
  readonly separator: string;
  readonly totalPower: string;
  /** `{count}` */
  readonly heroCount: string;
  readonly heroCountOne: string;
  /** `{count}` `{rarity}` */
  readonly tierCount: string;
  readonly medalPower: readonly [string, string, string];
  /** `{dps}` */
  readonly dps: string;
  /** `{rarity}` `{level}` */
  readonly rarityLevel: string;
  /** `{covered}` `{total}` */
  readonly aurasTitle: string;
  /** `{level}` `{max}` */
  readonly auraLevel: string;
  readonly auraMissing: string;
  readonly restTitle: string;
  /** `{phase}` */
  readonly footerSnapshot: string;
  /** `{host}` */
  readonly footerLink: string;
  readonly cardLabel: string;
  readonly emptyCard: string;
  readonly phaseTitle: string;
  readonly phaseAria: string;
  /** `{phase}` */
  readonly phaseReset: string;
  /** `{count}` */
  readonly pickerTitle: string;
  readonly pickSquad: string;
  readonly pickEveryone: string;
  readonly pickNone: string;
  readonly pickerFilterLabel: string;
  readonly pickerFilterPlaceholder: string;
  readonly pickerRarityLabel: string;
  readonly pickerNoMatch: string;
  /** `{level}` */
  readonly pickerLevel: string;
  readonly showTitle: string;
  readonly showGear: string;
  readonly showAuras: string;
  readonly showAccountNumber: string;
  readonly shareTitle: string;
  readonly copyImage: string;
  readonly copying: string;
  readonly copied: string;
  readonly copyFailed: string;
};
