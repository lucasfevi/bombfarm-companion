import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { summarizePvpFilm } from './film.js';
import { wireKey } from './lexicon.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OFFLINE_FIXTURE = resolve(HERE, '../../../../apps/desktop/src/main/live-source/fixtures/pvp-duels-offline.json');

function frame(time: number, hp: number, attackerDamage: number, defenderDamage: number, bombs: unknown[] = []): Record<string, unknown> {
  return {
    [wireKey('frameT')]: time,
    [wireKey('frameHp')]: hp,
    [wireKey('frameAttackerDamage')]: attackerDamage,
    [wireKey('frameDefenderDamage')]: defenderDamage,
    [wireKey('frameBombs')]: bombs,
    [wireKey('frameHeroes')]: [],
  };
}

function bomb(side: number, cell: number, fuseTotal: number, fuseLeft: number): Record<string, unknown> {
  return { l: side, ce: cell, ft: fuseTotal, f: fuseLeft, r: 2 };
}

function film(frames: unknown[], overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    [wireKey('filmIdField')]: 48117,
    [wireKey('phase')]: 120,
    [wireKey('filmVisualPhase')]: 51,
    [wireKey('filmHz')]: 12,
    [wireKey('seconds')]: 5,
    [wireKey('rooms')]: 3,
    [wireKey('filmAttackerHeroes')]: [{}, {}, {}],
    [wireKey('filmDefenderHeroes')]: [{}, {}],
    [wireKey('filmFrames')]: frames,
    ...overrides,
  };
}

/** Five seconds at 2 Hz: the defender leads through second 2, the attacker takes the lead
 *  inside second 3 and keeps it; two bombs, one per side, sit in the frames for three frames
 *  each while their fuses burn down. */
const LEAD_CHANGE_FRAMES = [
  frame(0, 1, 0, 0),
  frame(0.5, 0.95, 100, 300, [bomb(0, 7, 3, 3)]),
  frame(1, 0.9, 200, 500, [bomb(0, 7, 3, 2.5), bomb(1, 12, 3, 3)]),
  frame(1.5, 0.85, 400, 600, [bomb(0, 7, 3, 2), bomb(1, 12, 3, 2.5)]),
  frame(2, 0.8, 600, 700, [bomb(1, 12, 3, 2)]),
  frame(2.5, 0.7, 900, 800),
  frame(3, 0.6, 1200, 900),
  frame(3.5, 0.5, 1500, 950),
  frame(4, 0.4, 1800, 1000),
  frame(4.5, 0.35, 2100, 1050),
  frame(5, 0.3, 2400, 1100),
];

describe('summarizePvpFilm', () => {
  it('samples one point per whole second from the last frame at or before it, and carries the last frame past the end of the frames', () => {
    const view = summarizePvpFilm(film(LEAD_CHANGE_FRAMES, { [wireKey('seconds')]: 7 }));
    expect(view?.series.map((s) => s.second)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(view?.series[3]).toEqual({ second: 3, attackerDamage: 1200, defenderDamage: 900, roomHp: 0.6 });
    expect(view?.series[7]).toEqual({ second: 7, attackerDamage: 2400, defenderDamage: 1100, roomHp: 0.3 });
  });

  it('carries zero damage and a full room for a second no frame has reached yet', () => {
    const view = summarizePvpFilm(film([frame(2, 0.5, 10, 20)]));
    expect(view?.series[0]).toEqual({ second: 0, attackerDamage: 0, defenderDamage: 0, roomHp: 1 });
    expect(view?.series[1]).toEqual({ second: 1, attackerDamage: 0, defenderDamage: 0, roomHp: 1 });
    expect(view?.series[2]).toEqual({ second: 2, attackerDamage: 10, defenderDamage: 20, roomHp: 0.5 });
  });

  it('dates the lead at the second from which the side that finished ahead stayed ahead', () => {
    const facts = summarizePvpFilm(film(LEAD_CHANGE_FRAMES))?.facts;
    expect(facts?.leadTakenAtSecond).toBe(3);
    expect(facts?.widestLead).toEqual({ amount: 1300, atSecond: 5 });
  });

  it('signs the widest lead for the attacker, so a defender lead is negative', () => {
    const facts = summarizePvpFilm(film([frame(0, 1, 0, 0), frame(1, 0.9, 100, 700), frame(2, 0.8, 900, 800)]))?.facts;
    expect(facts?.leadTakenAtSecond).toBe(2);
    expect(facts?.widestLead).toEqual({ amount: -600, atSecond: 1 });
  });

  it('leaves the lead undated when it never changed hands, and both facts null with no damage at all', () => {
    const wireToWire = summarizePvpFilm(film([frame(0, 1, 0, 0), frame(1, 0.9, 100, 50), frame(2, 0.8, 300, 100)]))?.facts;
    expect(wireToWire?.leadTakenAtSecond).toBeNull();
    expect(wireToWire?.widestLead).toEqual({ amount: 200, atSecond: 2 });

    const noDamage = summarizePvpFilm(film([frame(0, 1, 0, 0), frame(1, 1, 0, 0)]))?.facts;
    expect(noDamage?.leadTakenAtSecond).toBeNull();
    expect(noDamage?.widestLead).toBeNull();
  });

  it('counts a bomb once however many frames it burns through, per side, and ignores an entry of another shape', () => {
    const frames = [...LEAD_CHANGE_FRAMES, frame(5.5, 0.3, 2400, 1100, [{ ce: 1 }, 'x', bomb(0, 7, 3, 3), bomb(0, 7, 5, 5)])];
    const facts = summarizePvpFilm(film(frames))?.facts;
    expect(facts?.bombs).toEqual({ attacker: 2, defender: 1 });
  });

  it('reports the room HP left, the hero counts, the frame count, the rate and the length', () => {
    const facts = summarizePvpFilm(film(LEAD_CHANGE_FRAMES))?.facts;
    expect(facts?.roomHpLeft).toBe(0.3);
    expect(facts?.heroes).toEqual({ attacker: 3, defender: 2 });
    expect(facts?.frames).toBe(11);
    expect(facts?.hz).toBe(12);
    expect(facts?.seconds).toBe(5);
  });

  it('tolerates frames missing a figure by carrying the previous one, and drops a frame with no time', () => {
    const frames = [frame(0, 1, 0, 0), { [wireKey('frameT')]: 1, [wireKey('frameAttackerDamage')]: 50 }, { [wireKey('frameHp')]: 0 }, frame(2, 0.5, 80, 30)];
    const view = summarizePvpFilm(film(frames, { [wireKey('seconds')]: 2 }));
    expect(view?.series[1]).toEqual({ second: 1, attackerDamage: 50, defenderDamage: 0, roomHp: 1 });
    expect(view?.facts.frames).toBe(4);
    expect(view?.facts.roomHpLeft).toBe(0.5);
  });

  it('refuses a body without a frame array or without a film id', () => {
    expect(summarizePvpFilm(null)).toBeNull();
    expect(summarizePvpFilm([])).toBeNull();
    expect(summarizePvpFilm(film([], { [wireKey('filmFrames')]: 'none' }))).toBeNull();
    expect(summarizePvpFilm(film([], { [wireKey('filmIdField')]: '48117' }))).toBeNull();
  });

  it('reads the offline fixture film: the attacker overtakes at 30 s, two bombs a side, the room at 4%', () => {
    const bodies = (JSON.parse(readFileSync(OFFLINE_FIXTURE, 'utf8')) as { bodies: unknown[] }).bodies;
    const view = summarizePvpFilm(bodies[1]);
    expect(view?.filmId).toBe(48117);
    expect(view?.series).toHaveLength(61);
    expect(view?.series[0]).toEqual({ second: 0, attackerDamage: 0, defenderDamage: 0, roomHp: 1 });
    expect(view?.series[10]).toEqual({ second: 10, attackerDamage: 23480, defenderDamage: 30296, roomHp: 0.84 });
    expect(view?.series[60]).toEqual({ second: 60, attackerDamage: 184320, defenderDamage: 151960, roomHp: 0.04 });
    expect(view?.facts).toEqual({
      leadTakenAtSecond: 30,
      widestLead: { amount: 32360, atSecond: 60 },
      roomHpLeft: 0.04,
      bombs: { attacker: 2, defender: 2 },
      heroes: { attacker: 5, defender: 5 },
      frames: 25,
      hz: 12,
      seconds: 60,
    });
  });
});
