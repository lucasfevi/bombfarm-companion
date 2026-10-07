import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LiveBomb, LiveTick } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import { CAPTURE_MAGIC, CAPTURE_VERSION, readCaptureRecords, type CaptureRecord } from '../capture-format.js';
import { TlsConnections, type TapEvent } from '../tls-stream.js';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const HERE = __dirname;
const FIXTURE_PATH = resolve(HERE, 'live-capture-combat.bfcc');
const ROSTER_PATH = resolve(HERE, 'live-capture-combat.roster.json');

const GRID_COLS = 19;
const GRID_ROWS = 16;
const FUSE_STEP_TOLERANCE = 1e-6;
const FRESH_BIRTH_MAX_AGE_SECONDS = 0.21;

function readFixtureRecords(): readonly CaptureRecord[] {
  return [...readCaptureRecords(readFileSync(FIXTURE_PATH))];
}

function replayTicks(records: readonly CaptureRecord[]): readonly LiveTick[] {
  const conn = new TlsConnections();
  const events: TapEvent[] = [];
  for (const record of records) events.push(...conn.push(record.ctx, record.bytes));
  return events.flatMap((event) => (event.kind === 'tick' ? [event.tick] : []));
}

function crossCells(center: number, reach: number): ReadonlySet<number> {
  const col = center % GRID_COLS;
  const row = Math.floor(center / GRID_COLS);
  const cells = new Set<number>([center]);
  for (let k = 1; k <= reach; k += 1) {
    if (col - k >= 0) cells.add(center - k);
    if (col + k < GRID_COLS) cells.add(center + k);
    if (row - k >= 0) cells.add(center - GRID_COLS * k);
    if (row + k < GRID_ROWS) cells.add(center + GRID_COLS * k);
  }
  return cells;
}

function isNewBomb(bomb: LiveBomb, previousAtCell: LiveBomb | undefined): boolean {
  if (previousAtCell === undefined) return true;
  const fuseTotalMoved = Math.abs(bomb.fuseTotalSeconds - previousAtCell.fuseTotalSeconds) > FUSE_STEP_TOLERANCE;
  const fuseRemainingRose = bomb.fuseRemainingSeconds > previousAtCell.fuseRemainingSeconds;
  return fuseTotalMoved || fuseRemainingRose;
}

function countBirths(ticks: readonly LiveTick[]): { readonly fresh: number; readonly adopted: number } {
  let fresh = 0;
  let adopted = 0;
  let previous = new Map<number, LiveBomb>();
  for (const tick of ticks) {
    const current = new Map<number, LiveBomb>();
    for (const bomb of tick.bombs ?? []) {
      current.set(bomb.cell, bomb);
      if (!isNewBomb(bomb, previous.get(bomb.cell))) continue;
      const age = bomb.fuseTotalSeconds - bomb.fuseRemainingSeconds;
      if (age <= FRESH_BIRTH_MAX_AGE_SECONDS) fresh += 1;
      else adopted += 1;
    }
    previous = current;
  }
  return { fresh, adopted };
}

function crossesCovering(tick: LiveTick, cell: number): number {
  return (tick.explosions ?? []).filter(
    (explosion) => explosion.secondBlast === undefined && crossCells(explosion.cell, explosion.radius).has(cell),
  ).length;
}

function plainHitCrossCounts(ticks: readonly LiveTick[]): readonly number[] {
  return ticks.flatMap((tick) =>
    (tick.hits ?? [])
      .filter((hit) => hit.secondBlast === undefined && hit.shardOrigin === undefined)
      .map((hit) => crossesCovering(tick, hit.cell)),
  );
}

describe('live-capture-combat.bfcc format integrity', () => {
  it('starts with the capture magic and version this reader expects', () => {
    const bytes = readFileSync(FIXTURE_PATH);
    expect(bytes.toString('ascii', 0, CAPTURE_MAGIC.length)).toBe(CAPTURE_MAGIC);
    expect(bytes.readUInt8(CAPTURE_MAGIC.length)).toBe(CAPTURE_VERSION);
  });

  it('decodes into 601 records on a single connection', () => {
    const records = readFixtureRecords();
    expect(records.length).toBe(601);
    expect(new Set(records.map((record) => record.ctx)).size).toBe(1);
  });

  it('decodes every one of the 601 records into a tick', () => {
    expect(replayTicks(readFixtureRecords()).length).toBe(601);
  });
});

describe('live-capture-combat.bfcc combat shape', () => {
  const ticks = replayTicks(readFixtureRecords());
  const hits = ticks.flatMap((tick) => tick.hits ?? []);
  const explosions = ticks.flatMap((tick) => tick.explosions ?? []);

  it('holds 2770 bomb entries across all ticks, none dropped as malformed by the decoder', () => {
    expect(ticks.flatMap((tick) => tick.bombs ?? []).length).toBe(2770);
  });

  it('holds 328 fresh Births and 7 adopted bombs', () => {
    expect(countBirths(ticks)).toEqual({ fresh: 328, adopted: 7 });
  });

  it('holds 345 explosions, 15 of them second blasts', () => {
    expect(explosions.length).toBe(345);
    expect(explosions.filter((explosion) => explosion.secondBlast === true).length).toBe(15);
  });

  it('holds 972 hits, 16 marked second blast, none carrying a shard origin, 956 plain', () => {
    expect(hits.length).toBe(972);
    expect(hits.filter((hit) => hit.secondBlast === true).length).toBe(16);
    expect(hits.filter((hit) => hit.shardOrigin !== undefined).length).toBe(0);
    expect(hits.filter((hit) => hit.secondBlast === undefined && hit.shardOrigin === undefined).length).toBe(956);
  });

  it('holds 93 plain hits on no ordinary same-tick explosion cross', () => {
    expect(plainHitCrossCounts(ticks).filter((crosses) => crosses === 0).length).toBe(93);
  });

  it('holds 18 plain hits on two or more ordinary same-tick explosion crosses', () => {
    expect(plainHitCrossCounts(ticks).filter((crosses) => crosses >= 2).length).toBe(18);
  });

  it('fields 12 distinct heroes', () => {
    expect(new Set(ticks.flatMap((tick) => tick.heroes.map((hero) => hero.id))).size).toBe(12);
  });
});

describe('live-capture-combat.roster.json sidecar', () => {
  const roster = JSON.parse(readFileSync(ROSTER_PATH, 'utf8')) as readonly Record<string, unknown>[];
  const fieldedIds = new Set(replayTicks(readFixtureRecords()).flatMap((tick) => tick.heroes.map((hero) => hero.id)));

  it('holds exactly the keys id, cooldownReduction and carriesFantasma on every entry', () => {
    expect(roster.length).toBe(12);
    for (const entry of roster) {
      expect(Object.keys(entry).sort()).toEqual(['carriesFantasma', 'cooldownReduction', 'id']);
    }
  });

  it('names only heroes that appear in the fixture hero lists, and every fielded hero', () => {
    expect(new Set(roster.map((entry) => entry.id))).toEqual(fieldedIds);
  });

  it('marks three heroes as carrying Fantasma', () => {
    expect(roster.filter((entry) => entry.carriesFantasma === true).length).toBe(3);
  });
});
