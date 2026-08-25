import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LiveTick } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import { CAPTURE_MAGIC, CAPTURE_VERSION, readCaptureRecords, type CaptureRecord } from '../capture-format.js';
import { TlsConnections, type TapEvent } from '../tls-stream.js';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const HERE = __dirname;
const COMMITTED_PATH = resolve(HERE, 'live-capture.bfcc');

function isTick(event: TapEvent): event is { kind: 'tick'; tick: LiveTick } {
  return event.kind === 'tick';
}

function readCommittedRecords(): { readonly bytes: Buffer; readonly records: readonly CaptureRecord[] } {
  const bytes = readFileSync(COMMITTED_PATH);
  return { bytes, records: [...readCaptureRecords(bytes)] };
}

function replay(records: readonly CaptureRecord[]): readonly LiveTick[] {
  const conn = new TlsConnections();
  const events: TapEvent[] = [];
  for (const record of records) events.push(...conn.push(record.ctx, record.bytes));
  return events.filter(isTick).map((event) => event.tick);
}

describe('live-capture.bfcc format integrity', () => {
  it('starts with the capture magic and version this reader expects', () => {
    const { bytes } = readCommittedRecords();
    expect(bytes.toString('ascii', 0, CAPTURE_MAGIC.length)).toBe(CAPTURE_MAGIC);
    expect(bytes.readUInt8(CAPTURE_MAGIC.length)).toBe(CAPTURE_VERSION);
  });

  it('decodes into 60 records on a single connection, by construction of this fixture', () => {
    const { records } = readCommittedRecords();
    expect(records.length).toBe(60);
    expect(new Set(records.map((record) => record.ctx)).size).toBe(1);
  });
});

describe('live-capture.bfcc drives the real decode path: records -> TlsConnections -> ticks', () => {
  it('produces 58 tick events from the 60 committed records, not zero', () => {
    const { records } = readCommittedRecords();
    const ticks = replay(records);
    expect(ticks.length).toBe(58);
  });

  it('carries an in-range energyFraction on every one of the 522 hero entries, and it varies', () => {
    const { records } = readCommittedRecords();
    const ticks = replay(records);
    const heroes = ticks.flatMap((tick) => tick.heroes);
    expect(heroes.length).toBe(522);

    const withEnergy = heroes.filter((hero) => hero.energyFraction !== undefined);
    expect(withEnergy.length).toBe(522);
    for (const hero of withEnergy) {
      expect(hero.energyFraction).toBeGreaterThanOrEqual(0);
      expect(hero.energyFraction).toBeLessThanOrEqual(1);
    }

    const distinctEnergyValues = new Set(withEnergy.map((hero) => hero.energyFraction));
    expect(distinctEnergyValues.size).toBeGreaterThan(1);
  });

  it('decodes gold as a finite number on every tick, not the digit string the wire sends', () => {
    const { records } = readCommittedRecords();
    const ticks = replay(records);
    const ticksWithGold = ticks.filter((tick) => tick.gold !== undefined);
    expect(ticksWithGold.length).toBe(58);

    for (const tick of ticksWithGold) {
      expect(typeof tick.gold).toBe('number');
      expect(Number.isFinite(tick.gold)).toBe(true);
    }
    expect(new Set(ticksWithGold.map((tick) => tick.gold)).size).toBe(9);
  });

  it('decodes 10 loot entries, each with a finite numeric gold payout', () => {
    const { records } = readCommittedRecords();
    const ticks = replay(records);
    const loot = ticks.flatMap((tick) => tick.loot ?? []);
    expect(loot.length).toBe(10);

    for (const pop of loot) {
      expect(typeof pop.gold).toBe('number');
      expect(Number.isFinite(pop.gold)).toBe(true);
    }
  });

  it('decodes 21 hit entries, each with a numeric damage and a boolean critical flag', () => {
    const { records } = readCommittedRecords();
    const ticks = replay(records);
    const hits = ticks.flatMap((tick) => tick.hits ?? []);
    expect(hits.length).toBe(21);

    for (const hit of hits) {
      expect(typeof hit.damage).toBe('number');
      expect(Number.isFinite(hit.damage)).toBe(true);
      expect(typeof hit.critical).toBe('boolean');
    }
  });

  it('decodes a finite numeric roomHp on every tick', () => {
    const { records } = readCommittedRecords();
    const ticks = replay(records);
    const ticksWithRoomHp = ticks.filter((tick) => tick.roomHp !== undefined);
    expect(ticksWithRoomHp.length).toBe(58);

    for (const tick of ticksWithRoomHp) {
      expect(typeof tick.roomHp).toBe('number');
      expect(Number.isFinite(tick.roomHp)).toBe(true);
    }
  });

  it('maps every hit to exactly the wire-documented keys, and every tick to exactly the fields this capture carries', () => {
    const { records } = readCommittedRecords();
    const ticks = replay(records);
    const hits = ticks.flatMap((tick) => tick.hits ?? []);

    const hitKeys = new Set(hits.flatMap((hit) => Object.keys(hit)));
    expect([...hitKeys].sort()).toEqual(['cell', 'critical', 'damage']);

    const tickKeys = new Set(ticks.flatMap((tick) => Object.keys(tick)));
    expect([...tickKeys].sort()).toEqual(['gold', 'heroes', 'hits', 'idle', 'loot', 'phase', 'roomHp', 'wave']);
  });
});
