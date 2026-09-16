import type { PvpFilmFacts, PvpFilmSecond, PvpFilmView } from '@bombfarm/contracts';
import { isPlainObject } from '../type-guards.js';
import { wireKey } from './lexicon.js';


const ATTACKER_SIDE = 0;
const DEFENDER_SIDE = 1;

interface Frame {
  readonly time: number;
  readonly hp: number;
  readonly attackerDamage: number;
  readonly defenderDamage: number;
  readonly bombs: readonly unknown[];
}

const FIRST_FRAME: Frame = { time: 0, hp: 1, attackerDamage: 0, defenderDamage: 0, bombs: [] };

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** A frame missing a figure carries the previous frame's; a frame without a time is dropped. */
function readFrames(raw: readonly unknown[]): Frame[] {
  const frames: Frame[] = [];
  let previous = FIRST_FRAME;
  for (const entry of raw) {
    if (!isPlainObject(entry)) continue;
    const time = finiteNumber(entry[wireKey('frameT')]);
    if (time === null) continue;
    const bombs = entry[wireKey('frameBombs')];
    const frame: Frame = {
      time,
      hp: finiteNumber(entry[wireKey('frameHp')]) ?? previous.hp,
      attackerDamage: finiteNumber(entry[wireKey('frameAttackerDamage')]) ?? previous.attackerDamage,
      defenderDamage: finiteNumber(entry[wireKey('frameDefenderDamage')]) ?? previous.defenderDamage,
      bombs: Array.isArray(bombs) ? bombs : [],
    };
    frames.push(frame);
    previous = frame;
  }
  return frames;
}

function seriesOf(frames: readonly Frame[], seconds: number): PvpFilmSecond[] {
  const series: PvpFilmSecond[] = [];
  let index = -1;
  for (let second = 0; second <= seconds; second += 1) {
    while (index + 1 < frames.length && (frames[index + 1] as Frame).time <= second) index += 1;
    const frame = index < 0 ? FIRST_FRAME : (frames[index] as Frame);
    series.push({
      second,
      attackerDamage: frame.attackerDamage,
      defenderDamage: frame.defenderDamage,
      roomHp: index < 0 ? 1 : frame.hp,
    });
  }
  return series;
}

function leadOf(second: PvpFilmSecond): number {
  return second.attackerDamage - second.defenderDamage;
}

function leadTakenAtSecond(series: readonly PvpFilmSecond[]): number | null {
  const last = series[series.length - 1];
  if (last === undefined) return null;
  const finalSign = Math.sign(leadOf(last));
  if (finalSign === 0) return null;
  let lastOpposite = -1;
  series.forEach((second, index) => {
    if (Math.sign(leadOf(second)) === -finalSign) lastOpposite = index;
  });
  if (lastOpposite < 0) return null;
  return (series[lastOpposite + 1] as PvpFilmSecond).second;
}

function widestLead(series: readonly PvpFilmSecond[]): PvpFilmFacts['widestLead'] {
  let widest: { amount: number; atSecond: number } | null = null;
  for (const second of series) {
    const amount = leadOf(second);
    if (amount !== 0 && (widest === null || Math.abs(amount) > Math.abs(widest.amount))) {
      widest = { amount, atSecond: second.second };
    }
  }
  return widest;
}

function bombsOf(frames: readonly Frame[]): PvpFilmFacts['bombs'] {
  const seen = new Set<string>();
  let attacker = 0;
  let defender = 0;
  for (const frame of frames) {
    for (const bomb of frame.bombs) {
      if (!isPlainObject(bomb)) continue;
      const side = finiteNumber(bomb[wireKey('bombSide')]);
      const cell = finiteNumber(bomb[wireKey('bombCell')]);
      const fuseTotal = finiteNumber(bomb[wireKey('bombFuseTotal')]);
      if (side === null || cell === null || fuseTotal === null) continue;
      if (side !== ATTACKER_SIDE && side !== DEFENDER_SIDE) continue;
      const key = `${String(side)}:${String(cell)}:${String(fuseTotal)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (side === ATTACKER_SIDE) attacker += 1;
      else defender += 1;
    }
  }
  return { attacker, defender };
}

function lengthOf(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * Reads a kept film into what the replay panel draws: one point per whole second and the facts
 * the frames settle. `null` for a body with no frame array or no id — a film the store should not
 * have kept.
 */
export function summarizePvpFilm(body: unknown): PvpFilmView | null {
  if (!isPlainObject(body)) return null;
  const filmId = finiteNumber(body[wireKey('filmIdField')]);
  const rawFrames = body[wireKey('filmFrames')];
  if (filmId === null || !Array.isArray(rawFrames)) return null;

  const frames = readFrames(rawFrames);
  const lastFrame = frames[frames.length - 1];
  const seconds = finiteNumber(body[wireKey('seconds')]) ?? Math.ceil(lastFrame?.time ?? 0);
  const series = seriesOf(frames, Math.max(0, Math.floor(seconds)));

  return {
    filmId,
    series,
    facts: {
      leadTakenAtSecond: leadTakenAtSecond(series),
      widestLead: widestLead(series),
      roomHpLeft: lastFrame === undefined ? 1 : lastFrame.hp,
      bombs: bombsOf(frames),
      heroes: {
        attacker: lengthOf(body[wireKey('filmAttackerHeroes')]),
        defender: lengthOf(body[wireKey('filmDefenderHeroes')]),
      },
      frames: rawFrames.length,
      hz: finiteNumber(body[wireKey('filmHz')]) ?? 0,
      seconds,
    },
  };
}
