import type { PvpDuelPrize, PvpDuelRecord, PvpDuelSide, PvpFilmSummary } from '@bombfarm/contracts';
import { isPlainObject } from '../type-guards.js';
import { wireKey } from './lexicon.js';

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

function parsePrize(value: unknown): PvpDuelPrize | null {
  return value === 'won' || value === 'lost' ? value : null;
}

function parseSquadHeroIds(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isPlainObject)
    .map((entry) => ({ slot: finiteNumber(entry[wireKey('squadSlot')]), heroId: entry[wireKey('squadHeroId')] }))
    .filter((entry): entry is { slot: number | null; heroId: string } => typeof entry.heroId === 'string')
    .sort((left, right) => (left.slot ?? Number.MAX_SAFE_INTEGER) - (right.slot ?? Number.MAX_SAFE_INTEGER))
    .map((entry) => entry.heroId);
}

/**
 * Reads a duel result body into its record, or `null` when a field the row cannot do without is
 * missing or mistyped. The state object is read for the tier, its floor and the squad only —
 * everything else it carries is the account's standing PVP state, not this duel's.
 */
export function parsePvpDuelResult(body: unknown): PvpDuelRecord | null {
  if (!isPlainObject(body)) return null;
  const won = body[wireKey('won')];
  const phase = finiteNumber(body[wireKey('phase')]);
  const filmId = finiteNumber(body[wireKey('filmId')]);
  const rooms = finiteNumber(body[wireKey('rooms')]);
  const seconds = finiteNumber(body[wireKey('seconds')]);
  const attacker = parseSide(body[wireKey('attacker')]);
  const defender = parseSide(body[wireKey('defender')]);
  const pointsBefore = finiteNumber(body[wireKey('pointsBefore')]);
  const pointsAfter = finiteNumber(body[wireKey('pointsAfter')]);
  const duelsLeft = finiteNumber(body[wireKey('duelsLeft')]);
  const duelsMax = finiteNumber(body[wireKey('duelsMax')]);
  const prize = parsePrize(body[wireKey('prize')]);
  const state = body[wireKey('state')];
  if (
    typeof won !== 'boolean' ||
    phase === null ||
    filmId === null ||
    rooms === null ||
    seconds === null ||
    attacker === null ||
    defender === null ||
    pointsBefore === null ||
    pointsAfter === null ||
    duelsLeft === null ||
    duelsMax === null ||
    prize === null ||
    !isPlainObject(state)
  ) {
    return null;
  }
  const tier = state[wireKey('stateTier')];
  const tierFloor = finiteNumber(state[wireKey('phase')]);
  if (typeof tier !== 'string' || tierFloor === null) return null;

  return {
    won,
    phase,
    filmId,
    rooms,
    seconds,
    attacker,
    defender,
    pointsBefore,
    pointsAfter,
    duelsLeft,
    duelsMax,
    prize,
    tier,
    tierFloor,
    squadHeroIds: parseSquadHeroIds(state[wireKey('stateSquad')]),
  };
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
