/**
 * The PVP duel history's IPC seam: what one recorded duel looks like once the wire body has been
 * read, and what the renderer asks main for. A duel is fought and settled by the server before
 * the client shows anything; the desktop only ever observes the result and, when the client
 * fetches it, the film. Nothing here is predicted.
 */

/** `won` is the rune chest landing in the bag; `lost` is the same chest lost to a full bag. */
export type PvpDuelPrize = 'won' | 'lost';

/** One side of a duel: its display name, how many heroes it fielded, and its score — the HP it
 *  tore off the other side over the duel. */
export interface PvpDuelSide {
  readonly name: string;
  readonly heroes: number;
  readonly score: number;
}

/** The wire-derived facts of one duel, as recorded the moment the result body passed the tap. */
export interface PvpDuelRecord {
  readonly won: boolean;
  /** The combat phase the duel was fought in — NOT the tier's floor, which is `tierFloor`. */
  readonly phase: number;
  /** `0` means the server issued no film for this duel. */
  readonly filmId: number;
  readonly rooms: number;
  readonly seconds: number;
  /** The player: the side that pressed Challenge. */
  readonly attacker: PvpDuelSide;
  readonly defender: PvpDuelSide;
  readonly pointsBefore: number;
  readonly pointsAfter: number;
  readonly duelsLeft: number;
  readonly duelsMax: number;
  readonly prize: PvpDuelPrize;
  /** The tier token as the server names it (`r1`…`r6`). */
  readonly tier: string;
  readonly tierFloor: number;
  /** The player's squad in slot order, from the state the result carried. */
  readonly squadHeroIds: readonly string[];
}

/** What the tap kept of a film: enough to say what it is without shipping the ~2 MB body. */
export interface PvpFilmSummary {
  readonly filmId: number;
  readonly phase: number;
  readonly visualPhase: number;
  readonly hz: number;
  readonly seconds: number;
  readonly rooms: number;
  readonly frames: number;
}

export interface PvpDuelRow extends PvpDuelRecord {
  readonly id: number;
  readonly recordedAt: string;
  readonly accountId: string | null;
  /** Whether the film body is held in the store. The server purges a film seconds after the
   *  client pulls it, so a `false` here is permanent. */
  readonly filmStored: boolean;
}

export interface PvpHistoryTotals {
  readonly duels: number;
  readonly won: number;
  readonly films: number;
}

export interface PvpHistoryResult {
  readonly rows: readonly PvpDuelRow[];
  readonly totals: PvpHistoryTotals;
}

export const EMPTY_PVP_HISTORY: PvpHistoryResult = { rows: [], totals: { duels: 0, won: 0, films: 0 } };
