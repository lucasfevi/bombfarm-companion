import type { AppLocale, CollectionAxis, DomainLang } from '@bombfarm/contracts';
import type { Slot } from '@bombfarm/domain/gear';
import { itemName, itemRarityLabel, slotLabel } from '@bombfarm/domain/game-labels';
import type {
  CollectionAxisRow,
  CollectionBoardSummary,
  CollectionPieceRow,
} from '@bombfarm/domain/model';
import { sub, type Copy, type CopyKey } from '../../lib/copy';
import { formatBonus, formatLimit } from '../../lib/collections/collections-format';
import { formatCount } from '../../lib/format';

const AXIS_LABEL_KEY = {
  damage: 'collectionsAxisDamage',
  critDamage: 'collectionsAxisCritDamage',
  critChance: 'collectionsAxisCritChance',
  cooldown: 'collectionsAxisCooldown',
  cage: 'collectionsAxisCage',
  energy: 'collectionsAxisEnergy',
  gold: 'collectionsAxisGold',
  xp: 'collectionsAxisXp',
  luck: 'collectionsAxisLuck',
  forge: 'collectionsAxisForge',
} as const satisfies Record<CollectionAxis, CopyKey>;

const AXIS_TIP_KEY = {
  damage: 'collectionsAxisTipDamage',
  critDamage: 'collectionsAxisTipCritDamage',
  critChance: 'collectionsAxisTipCritChance',
  cooldown: 'collectionsAxisTipCooldown',
  cage: 'collectionsAxisTipCage',
  energy: 'collectionsAxisTipEnergy',
  gold: 'collectionsAxisTipGold',
  xp: 'collectionsAxisTipXp',
  luck: 'collectionsAxisTipLuck',
  forge: 'collectionsAxisTipForge',
} as const satisfies Record<CollectionAxis, CopyKey>;

export function axisLabel(axis: CollectionAxis, t: Copy): string {
  return t[AXIS_LABEL_KEY[axis]];
}

/** What a tile's tooltip says, one line each: what the axis affects, how many books grant it, and
 *  what every one of them complete would add up to — with the cap named when it stops that. */
export function axisTipLines(row: CollectionAxisRow, t: Copy, locale: AppLocale): string[] {
  const max = formatBonus(row.maxRaw, locale);
  return [
    t[AXIS_TIP_KEY[row.axis]],
    sub(t.collectionsAxisBooks, { n: formatCount(row.books, locale) }),
    row.maxRaw > row.cap
      ? sub(t.collectionsAxisMaxOver, { max, cap: formatLimit(row.cap, locale) })
      : sub(t.collectionsAxisMaxUnder, { max }),
  ];
}

/** The books partitioned by the progress filter's own words: in progress, complete and not started. */
export function summaryLine(summary: CollectionBoardSummary, t: Copy, locale: AppLocale): string {
  const values = {
    active: formatCount(summary.booksStarted - summary.booksComplete, locale),
    complete: formatCount(summary.booksComplete, locale),
    untouched: formatCount(summary.booksTotal - summary.booksStarted, locale),
    sacrificed: formatCount(summary.piecesSacrificed, locale),
    pieces: formatCount(summary.piecesTotal, locale),
  };
  return summary.readyInBag > 0
    ? sub(t.collectionsSummaryReady, { ...values, ready: formatCount(summary.readyInBag, locale) })
    : sub(t.collectionsSummary, values);
}

export function countOf(part: number, whole: number, t: Copy, locale: AppLocale): string {
  return sub(t.collectionsCountOf, { part: formatCount(part, locale), whole: formatCount(whole, locale) });
}

/** What the bonus tile is called for a screen reader: the axis, its figure and its cap. */
export function axisTileLabel(row: CollectionAxisRow, t: Copy, locale: AppLocale): string {
  return sub(t.collectionsAxisAria, {
    axis: axisLabel(row.axis, t),
    value: formatBonus(row.total, locale),
    cap: sub(t.collectionsAxisCap, { cap: formatLimit(row.cap, locale) }),
  });
}

export function readyBooksLabel(count: number, t: Copy, locale: AppLocale): string {
  return sub(count === 1 ? t.collectionsFilterReadyCountOne : t.collectionsFilterReadyCountMany, {
    n: formatCount(count, locale),
  });
}

/** A set's eight slots in the order the read lists them, named by the planner's slot vocabulary. */
const PIECE_SLOTS: readonly Slot[] = ['arma', 'elmo', 'peito', 'calca', 'bota', 'luva', 'anel', 'amuleto'];

export function pieceSlotLabel(slot: number, lang: DomainLang): string {
  const key = PIECE_SLOTS[slot];
  return key === undefined ? String(slot) : slotLabel(key, lang);
}

export type PieceState = 'sacrificed' | 'pending' | 'ready' | 'missing';

export function pieceState(piece: CollectionPieceRow, rarity: number): PieceState {
  if (piece.sacrificed[rarity]) return 'sacrificed';
  if (piece.pending[rarity]) return 'pending';
  if (piece.ready[rarity]) return 'ready';
  return 'missing';
}

const PIECE_STATE_KEY = {
  sacrificed: 'collectionsPieceSacrificed',
  pending: 'collectionsPiecePending',
  ready: 'collectionsPieceReady',
  missing: 'collectionsPieceMissing',
} as const satisfies Record<PieceState, CopyKey>;

/** "Ember Helm, Rare — sacrificed": the cell's name for a screen reader and for its tooltip. */
export function pieceCellLabel(piece: CollectionPieceRow, rarity: number, t: Copy, lang: DomainLang): string {
  return sub(t.collectionsPieceAria, {
    piece: itemName({ defId: piece.defId }, lang),
    rarity: itemRarityLabel(rarity, lang),
    state: t[PIECE_STATE_KEY[pieceState(piece, rarity)]],
  });
}
