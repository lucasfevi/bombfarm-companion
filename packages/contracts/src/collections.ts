/**
 * The Collections IPC seam: what the game's Collections read looks like once the wire body has been
 * parsed, and what the renderer asks main for. Every figure is the server's own; nothing here is
 * predicted. Percentages are in percent (13.65 means +13.65%).
 */

/** The game's own panel order. */
export const COLLECTION_AXES = [
  'damage',
  'critDamage',
  'critChance',
  'cooldown',
  'cage',
  'energy',
  'gold',
  'xp',
  'luck',
  'forge',
] as const;

export type CollectionAxis = (typeof COLLECTION_AXES)[number];

export type CollectionAxisValues = Readonly<Record<CollectionAxis, number>>;

/** One bonus a set's book grants. `pageValues` is cumulative: entry `r` is the bonus with the
 *  pages of rarity 0 through `r` complete. `now` is what the effect grants at the current progress. */
export interface CollectionEffectState {
  readonly axis: CollectionAxis;
  readonly pageValues: readonly number[];
  readonly now: number;
}

export interface CollectionSetState {
  readonly code: string;
  readonly level: number;
  /** Pieces sacrificed on the page of each rarity, common first; six entries, 0 to 8 each. */
  readonly piecesByPage: readonly number[];
  readonly effects: readonly CollectionEffectState[];
}

/** One piece of a set. `sacrificedMask` has bit `r` set when the piece is sacrificed on the page of
 *  rarity `r`; `pendingMask` is the same bits for a sacrifice still arriving from outside the bag. */
export interface CollectionPieceState {
  readonly defId: string;
  readonly set: string;
  readonly slot: number;
  readonly level: number;
  readonly sacrificedMask: number;
  readonly pendingMask: number;
}

export interface CollectionsSnapshot {
  /** The share of a page's increment each piece pays before the page is complete. */
  readonly partialPct: number;
  readonly caps: CollectionAxisValues;
  readonly totals: CollectionAxisValues;
  readonly raw: CollectionAxisValues;
  readonly sets: readonly CollectionSetState[];
  readonly pieces: readonly CollectionPieceState[];
}

/** What main serves the renderer: the last good snapshot and when it was read; both `null` before
 *  any read landed. */
export interface CollectionsView {
  readonly snapshot: CollectionsSnapshot | null;
  readonly capturedAt: string | null;
}

export const EMPTY_COLLECTIONS_VIEW: CollectionsView = { snapshot: null, capturedAt: null };
