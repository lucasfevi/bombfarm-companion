/**
 * The Collections board: everything the Collections screen draws, from the server's own snapshot
 * plus (optionally) what the bag holds. The server states each effect's current bonus; what it does
 * not state — what each page contributes, and what one more piece or a completed page would add —
 * is recomputed here with the game client's partial-page rule.
 *
 * The rule works in integer hundredths of a percent ("cents"): a page with all eight pieces grants
 * its whole increment over the previous page's cumulative bonus, and a page with k pieces grants
 * the increment times the partial share times k/8, rounded half-up. The recomputed pages of every
 * effect sum to the server's own figure.
 */
import type {
  CollectionAxis,
  CollectionEffectState,
  CollectionPieceState,
  CollectionSetState,
  CollectionsSnapshot,
} from '@bombfarm/contracts';

export const COLLECTION_PAGES = 6;
export const COLLECTION_PIECES_PER_PAGE = 8;

const AXIS_ORDER: readonly CollectionAxis[] = [
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
];

export interface CollectionBagItem {
  readonly defId: string;
  readonly rarity: number;
  readonly free: boolean;
}

export interface CollectionAxisRow {
  readonly axis: CollectionAxis;
  readonly total: number;
  readonly raw: number;
  readonly cap: number;
  readonly maxRaw: number;
  readonly atCap: boolean;
  readonly books: number;
}

export interface CollectionPageEffect {
  readonly axis: CollectionAxis;
  readonly full: number;
  readonly granted: number;
  readonly withReady: number;
}

export interface CollectionPageRow {
  readonly rarity: number;
  readonly pieces: number;
  readonly complete: boolean;
  readonly ready: number;
  readonly effects: readonly CollectionPageEffect[];
}

export interface CollectionPieceRow {
  readonly slot: number;
  readonly defId: string;
  readonly sacrificed: readonly boolean[];
  readonly pending: readonly boolean[];
  readonly ready: readonly boolean[];
}

export interface CollectionSetEffectRow {
  readonly axis: CollectionAxis;
  readonly now: number;
  readonly max: number;
  readonly remaining: number;
  readonly readyGain: number;
}

export type CollectionSetStatus = 'empty' | 'started' | 'complete';

export interface CollectionSetRow {
  readonly code: string;
  readonly level: number;
  readonly status: CollectionSetStatus;
  readonly effects: readonly CollectionSetEffectRow[];
  readonly pages: readonly CollectionPageRow[];
  readonly pieces: readonly CollectionPieceRow[];
  readonly piecesSacrificed: number;
  readonly piecesTotal: number;
  readonly readyInBag: number;
}

export interface CollectionBoardSummary {
  /** Books with at least one piece sacrificed, complete ones included. */
  readonly booksStarted: number;
  readonly booksComplete: number;
  readonly booksTotal: number;
  readonly piecesSacrificed: number;
  readonly piecesTotal: number;
  readonly readyInBag: number;
}

export interface CollectionBoard {
  readonly axes: readonly CollectionAxisRow[];
  readonly sets: readonly CollectionSetRow[];
  readonly summary: CollectionBoardSummary;
}

export function collectionCents(percent: number): number {
  return Math.round(percent * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

/** What each page adds over the page before it, in cents. */
export function collectionPageIncrementsCents(pageValues: readonly number[]): number[] {
  let previous = 0;
  return pageValues.map((value) => {
    const cumulative = collectionCents(value);
    const increment = cumulative - previous;
    previous = cumulative;
    return increment;
  });
}

/** What a page holding `pieces` of its eight grants, in cents. */
export function collectionPageGrantCents(incrementCents: number, pieces: number, partialPct: number): number {
  if (pieces >= COLLECTION_PIECES_PER_PAGE) return incrementCents;
  return Math.floor((2 * incrementCents * partialPct * pieces + 800) / 1600);
}

function isFreeItem(item: Record<string, unknown>): boolean {
  return (
    (item.equipped_on === null || item.equipped_on === undefined) &&
    item.locked !== true &&
    (item.market_state === undefined || item.market_state === 0) &&
    item.in_stash !== true
  );
}

/** Reads the account's `items` section for the board: an item is free when it is not equipped, not
 *  locked, not listed on the market and not in the stash. */
export function collectionBagItemsFromInventory(items: unknown): CollectionBagItem[] {
  if (!Array.isArray(items)) return [];
  const bag: CollectionBagItem[] = [];
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue;
    const record = item as Record<string, unknown>;
    const { def_id: defId, rarity } = record;
    if (typeof defId !== 'string' || typeof rarity !== 'number' || !Number.isFinite(rarity)) continue;
    bag.push({ defId, rarity, free: isFreeItem(record) });
  }
  return bag;
}

function freeBagKeys(bag: readonly CollectionBagItem[]): ReadonlySet<string> {
  return new Set(bag.filter((item) => item.free).map((item) => bagKey(item.defId, item.rarity)));
}

function bagKey(defId: string, rarity: number): string {
  return `${defId}|${String(rarity)}`;
}

function bit(mask: number, rarity: number): boolean {
  return Math.floor(mask / 2 ** rarity) % 2 === 1;
}

function pieceRow(piece: CollectionPieceState, freeKeys: ReadonlySet<string>): CollectionPieceRow {
  const pages = Array.from({ length: COLLECTION_PAGES }, (_, rarity) => rarity);
  const sacrificed = pages.map((rarity) => bit(piece.sacrificedMask, rarity));
  const pending = pages.map((rarity) => bit(piece.pendingMask, rarity));
  const ready = pages.map(
    (rarity) => !sacrificed[rarity] && !pending[rarity] && freeKeys.has(bagKey(piece.defId, rarity)),
  );
  return { slot: piece.slot, defId: piece.defId, sacrificed, pending, ready };
}

function setStatus(piecesByPage: readonly number[]): CollectionSetStatus {
  if (piecesByPage.every((count) => count >= COLLECTION_PIECES_PER_PAGE)) return 'complete';
  if (piecesByPage.every((count) => count === 0)) return 'empty';
  return 'started';
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function pageRows(
  set: CollectionSetState,
  pieces: readonly CollectionPieceRow[],
  partialPct: number,
): CollectionPageRow[] {
  const increments = set.effects.map((effect) => collectionPageIncrementsCents(effect.pageValues));
  return Array.from({ length: COLLECTION_PAGES }, (_, rarity) => {
    const held = set.piecesByPage[rarity] ?? 0;
    const ready = pieces.filter((piece) => piece.ready[rarity]).length;
    const withReadyPieces = Math.min(COLLECTION_PIECES_PER_PAGE, held + ready);
    const effects = set.effects.map((effect, index) => {
      const increment = increments[index]?.[rarity] ?? 0;
      return {
        axis: effect.axis,
        full: fromCents(increment),
        granted: fromCents(collectionPageGrantCents(increment, held, partialPct)),
        withReady: fromCents(collectionPageGrantCents(increment, withReadyPieces, partialPct)),
      };
    });
    return { rarity, pieces: held, complete: held >= COLLECTION_PIECES_PER_PAGE, ready, effects };
  });
}

function setEffectRows(effects: readonly CollectionEffectState[], pages: readonly CollectionPageRow[]): CollectionSetEffectRow[] {
  return effects.map((effect, index) => {
    const max = effect.pageValues[COLLECTION_PAGES - 1] ?? 0;
    const readyGainCents = sum(
      pages.map((page) => {
        const row = page.effects[index];
        return row === undefined ? 0 : collectionCents(row.withReady) - collectionCents(row.granted);
      }),
    );
    return {
      axis: effect.axis,
      now: effect.now,
      max,
      remaining: fromCents(Math.max(0, collectionCents(max) - collectionCents(effect.now))),
      readyGain: fromCents(readyGainCents),
    };
  });
}

function setRow(set: CollectionSetState, allPieces: readonly CollectionPieceState[], freeKeys: ReadonlySet<string>, partialPct: number): CollectionSetRow {
  const pieces = allPieces
    .filter((piece) => piece.set === set.code)
    .map((piece) => pieceRow(piece, freeKeys))
    .sort((left, right) => left.slot - right.slot);
  const pages = pageRows(set, pieces, partialPct);
  return {
    code: set.code,
    level: set.level,
    status: setStatus(set.piecesByPage),
    effects: setEffectRows(set.effects, pages),
    pages,
    pieces,
    piecesSacrificed: sum(set.piecesByPage),
    piecesTotal: COLLECTION_PAGES * COLLECTION_PIECES_PER_PAGE,
    readyInBag: sum(pages.map((page) => page.ready)),
  };
}

function axisRows(snapshot: CollectionsSnapshot): CollectionAxisRow[] {
  return AXIS_ORDER.map((axis) => {
    const effects = snapshot.sets.flatMap((set) => set.effects.filter((effect) => effect.axis === axis));
    const cap = snapshot.caps[axis];
    const raw = snapshot.raw[axis];
    return {
      axis,
      total: snapshot.totals[axis],
      raw,
      cap,
      maxRaw: fromCents(sum(effects.map((effect) => collectionCents(effect.pageValues[COLLECTION_PAGES - 1] ?? 0)))),
      atCap: cap > 0 && collectionCents(raw) >= collectionCents(cap),
      books: effects.length,
    };
  });
}

export function buildCollectionBoard(snapshot: CollectionsSnapshot, bag: readonly CollectionBagItem[] = []): CollectionBoard {
  const freeKeys = freeBagKeys(bag);
  const sets = snapshot.sets
    .map((set) => setRow(set, snapshot.pieces, freeKeys, snapshot.partialPct))
    .sort((left, right) => left.level - right.level);
  return {
    axes: axisRows(snapshot),
    sets,
    summary: {
      booksStarted: sets.filter((set) => set.status !== 'empty').length,
      booksComplete: sets.filter((set) => set.status === 'complete').length,
      booksTotal: sets.length,
      piecesSacrificed: sum(sets.map((set) => set.piecesSacrificed)),
      piecesTotal: sum(sets.map((set) => set.piecesTotal)),
      readyInBag: sum(sets.map((set) => set.readyInBag)),
    },
  };
}
