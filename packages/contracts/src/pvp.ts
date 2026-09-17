/**
 * The PVP duel history's IPC seam: what one recorded duel looks like once the wire body has been
 * read, and what the renderer asks main for. A duel is fought and settled by the server before
 * the client shows anything; the desktop only ever observes the result and, when the client
 * fetches it, the film. Nothing here is predicted.
 */

/** `won` is the rune chest landing in the bag; `lost` is the same chest lost to a full bag. A
 *  duel that issued no chest — a lost duel — names neither, and the record carries `null`. */
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
  /** `null` when the result named no chest outcome — the wire's shape for a duel that issued none. */
  readonly prize: PvpDuelPrize | null;
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

/** The account's PVP standing as the game last reported it — on a poll of its state, or inside a
 *  duel result. Figures the wire may leave out are `null`, never invented. */
export interface PvpStateSnapshot {
  readonly points: number;
  /** The tier token as the server names it (`r1`…`r6`). */
  readonly tier: string;
  readonly tierNumber: number | null;
  /** The points the next tier starts at. */
  readonly nextTierAt: number | null;
  readonly tierFloor: number;
  readonly duelsUsed: number | null;
  readonly duelsMax: number | null;
  readonly slots: number | null;
  readonly slotsMax: number | null;
  readonly squadHeroIds: readonly string[];
}

export interface PvpStanding extends PvpStateSnapshot {
  readonly capturedAt: string;
}

/** The player's own entry on one leaderboard body, whichever board it is. */
export interface PvpRankEntry {
  readonly board: string;
  readonly position: number;
  readonly value: number;
}

/** The player's position on the PVP points board, as of the last time the client fetched it —
 *  the game only fetches it when the player opens the ranking, so it carries its own date. */
export interface PvpRank {
  readonly position: number;
  readonly points: number;
  readonly capturedAt: string;
}

/** One second of a kept film: both sides' damage so far and the room's HP as a fraction. */
export interface PvpFilmSecond {
  readonly second: number;
  readonly attackerDamage: number;
  readonly defenderDamage: number;
  /** 0–1 of the room's starting HP. */
  readonly roomHp: number;
}

/** What a kept film settles about its duel, read from the frames — never from the result. */
export interface PvpFilmFacts {
  /** The second from which the side that finished ahead stayed ahead; `null` when the lead never
   *  changed hands after the first damage, or the film holds no damage at all. */
  readonly leadTakenAtSecond: number | null;
  /** The largest gap between the two totals, signed for the attacker, and when it stood. */
  readonly widestLead: { readonly amount: number; readonly atSecond: number } | null;
  /** Room HP at the last frame, 0–1. */
  readonly roomHpLeft: number;
  /** Distinct bombs each side placed over the film. */
  readonly bombs: { readonly attacker: number; readonly defender: number };
  readonly heroes: { readonly attacker: number; readonly defender: number };
  readonly frames: number;
  readonly hz: number;
  readonly seconds: number;
}

export interface PvpFilmView {
  readonly filmId: number;
  readonly series: readonly PvpFilmSecond[];
  readonly facts: PvpFilmFacts;
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
  readonly standing: PvpStanding | null;
  readonly rank: PvpRank | null;
}

export const EMPTY_PVP_HISTORY: PvpHistoryResult = {
  rows: [],
  totals: { duels: 0, won: 0, films: 0 },
  standing: null,
  rank: null,
};
