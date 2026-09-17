import type {
  PvpDuelPrize,
  PvpDuelRecord,
  PvpDuelSide,
  PvpFilmSummary,
  PvpRankEntry,
  PvpStateSnapshot,
} from '@bombfarm/contracts';
import { isPlainObject } from '../type-guards.js';
import { PVP_RANKING_BOARD, wireKey } from './lexicon.js';

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A side's hero field has been seen as a count; an array of heroes is read as its length so a
 *  later body that lists them still records how many fought. */
function heroCount(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  return finiteNumber(value);
}

function parseSide(value: unknown): PvpDuelSide | null {
  if (!isPlainObject(value)) return null;
  const name = value[wireKey('sideName')];
  const heroes = heroCount(value[wireKey('sideHeroes')]);
  const score = finiteNumber(value[wireKey('sideScore')]);
  if (typeof name !== 'string' || heroes === null || score === null) return null;
  return { name, heroes, score };
}

/** The chest outcome is only ever `won` or `lost`; a body naming neither issued no chest. */
function parsePrize(value: unknown): PvpDuelPrize | null {
  return value === 'won' || value === 'lost' ? value : null;
}

function parseBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function parseString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

type Complete<T> = { readonly [K in keyof T]: NonNullable<T[K]> };

function isComplete<T extends Record<string, unknown>>(fields: T): fields is T & Complete<T> {
  return Object.values(fields).every((value) => value !== null);
}

function missingNames(fields: Record<string, unknown>): readonly string[] {
  return Object.entries(fields)
    .filter(([, value]) => value === null)
    .map(([name]) => name);
}

/** The wire carries the id as a number (`862212`, observed 2026-09-16); the roster keys heroes by
 *  the same id as a string, so it is read as one here. */
function heroIdOf(value: unknown): string | null {
  if (typeof value === 'string' && value !== '') return value;
  const asNumber = finiteNumber(value);
  return asNumber === null ? null : String(asNumber);
}

function parseSquadHeroIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isPlainObject)
    .map((entry) => ({ slot: finiteNumber(entry[wireKey('squadSlot')]), heroId: heroIdOf(entry[wireKey('squadHeroId')]) }))
    .filter((entry): entry is { slot: number | null; heroId: string } => entry.heroId !== null)
    .sort((left, right) => (left.slot ?? Number.MAX_SAFE_INTEGER) - (right.slot ?? Number.MAX_SAFE_INTEGER))
    .map((entry) => entry.heroId);
}

/**
 * Reads the standing: the polled state body, or the same object a duel result carries nested
 * under its state key. `null` when the points, the tier or its floor are missing — the three
 * figures the screen leads with.
 */
export function parsePvpState(value: unknown): PvpStateSnapshot | null {
  if (!isPlainObject(value)) return null;
  const points = finiteNumber(value[wireKey('statePoints')]);
  const tier = value[wireKey('stateTier')];
  const tierFloor = finiteNumber(value[wireKey('phase')]);
  if (points === null || typeof tier !== 'string' || tierFloor === null) return null;
  const slots = finiteNumber(value[wireKey('stateSlots')]);
  return {
    points,
    tier,
    tierNumber: finiteNumber(value[wireKey('stateTierNumber')]),
    nextTierAt: finiteNumber(value[wireKey('stateTierNext')]),
    tierFloor,
    duelsUsed: finiteNumber(value[wireKey('stateDuelsUsed')]),
    duelsMax: finiteNumber(value[wireKey('duelsMax')]),
    slots,
    slotsMax: finiteNumber(value[wireKey('stateSlotsMax')]) ?? slots,
    squadHeroIds: parseSquadHeroIds(value[wireKey('stateSquad')]),
  };
}

/** The standing a duel result carries with it, read the same way the polled body is. */
export function parsePvpDuelState(body: unknown): PvpStateSnapshot | null {
  return isPlainObject(body) ? parsePvpState(body[wireKey('state')]) : null;
}

/**
 * The player's own entry on a ranking body, and which board it is. The value is a string of
 * digits on the wire; a board this app does not know still parses, so the caller decides what to
 * keep by `board` rather than this refusing it.
 */
export function parsePvpRanking(body: unknown): PvpRankEntry | null {
  if (!isPlainObject(body)) return null;
  const board = body[wireKey('rankingBy')];
  const me = body[wireKey('rankingMe')];
  if (typeof board !== 'string' || !isPlainObject(me)) return null;
  const position = finiteNumber(me[wireKey('rankingRank')]);
  const rawValue = me[wireKey('rankingValue')];
  const value = typeof rawValue === 'string' && rawValue.trim() !== '' ? Number(rawValue) : finiteNumber(rawValue);
  if (position === null || value === null || !Number.isFinite(value)) return null;
  return { board, position, value };
}

export function isPvpPointsBoard(entry: PvpRankEntry): boolean {
  return entry.board === PVP_RANKING_BOARD;
}

export type PvpDuelResultReading =
  | { readonly record: PvpDuelRecord; readonly missing: readonly [] }
  | { readonly record: null; readonly missing: readonly string[] };

/**
 * Reads a duel result body into its record. `record` is `null` when a field the row cannot do
 * without is missing or mistyped, and `missing` then names those fields by their record name so
 * a refusal can be logged without the body. The chest outcome is not one of them: a duel that
 * issued no chest names none. The state object is read for the tier, its floor and the squad
 * only — everything else it carries is the account's standing PVP state, not this duel's, and
 * {@link parsePvpDuelState} reads that separately.
 */
export function readPvpDuelResult(body: unknown): PvpDuelResultReading {
  if (!isPlainObject(body)) return { record: null, missing: ['body'] };
  const state = body[wireKey('state')];
  const stateObject = isPlainObject(state) ? state : null;
  const fields = {
    won: parseBoolean(body[wireKey('won')]),
    phase: finiteNumber(body[wireKey('phase')]),
    filmId: finiteNumber(body[wireKey('filmId')]),
    rooms: finiteNumber(body[wireKey('rooms')]),
    seconds: finiteNumber(body[wireKey('seconds')]),
    attacker: parseSide(body[wireKey('attacker')]),
    defender: parseSide(body[wireKey('defender')]),
    pointsBefore: finiteNumber(body[wireKey('pointsBefore')]),
    pointsAfter: finiteNumber(body[wireKey('pointsAfter')]),
    duelsLeft: finiteNumber(body[wireKey('duelsLeft')]),
    duelsMax: finiteNumber(body[wireKey('duelsMax')]),
    tier: stateObject === null ? null : parseString(stateObject[wireKey('stateTier')]),
    tierFloor: stateObject === null ? null : finiteNumber(stateObject[wireKey('phase')]),
  };
  if (!isComplete(fields)) return { record: null, missing: missingNames(fields) };

  return {
    record: {
      ...fields,
      prize: parsePrize(body[wireKey('prize')]),
      squadHeroIds: parseSquadHeroIds(stateObject?.[wireKey('stateSquad')]),
    },
    missing: [],
  };
}

export function parsePvpDuelResult(body: unknown): PvpDuelRecord | null {
  return readPvpDuelResult(body).record;
}

/** Reads a film's header. The frames are counted, never decoded — the body is kept whole. */
export function parsePvpFilm(body: unknown): PvpFilmSummary | null {
  if (!isPlainObject(body)) return null;
  const filmId = finiteNumber(body[wireKey('filmIdField')]);
  const phase = finiteNumber(body[wireKey('phase')]);
  const visualPhase = finiteNumber(body[wireKey('filmVisualPhase')]);
  const hz = finiteNumber(body[wireKey('filmHz')]);
  const seconds = finiteNumber(body[wireKey('seconds')]);
  const rooms = finiteNumber(body[wireKey('rooms')]);
  const frames = body[wireKey('filmFrames')];
  if (filmId === null || phase === null || !Array.isArray(frames)) return null;
  return {
    filmId,
    phase,
    visualPhase: visualPhase ?? phase,
    hz: hz ?? 0,
    seconds: seconds ?? 0,
    rooms: rooms ?? 0,
    frames: frames.length,
  };
}
