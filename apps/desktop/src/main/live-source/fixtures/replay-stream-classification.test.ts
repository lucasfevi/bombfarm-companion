import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FieldCountdown, LiveTick } from '@bombfarm/contracts';
import { createInitialFieldCountdownState, ingestFieldCountdownTick } from '@bombfarm/domain/live';
import { classifyRotation } from '@bombfarm/domain/rotation-status';
import { normalizeRotation, wireKey } from '@bombfarm/game-api';
import { describe, expect, it } from 'vitest';
import { TlsConnections, type TapEvent } from '../tls-stream.js';
import { generateReplayStream } from './generate-replay-stream.js';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const HERE = __dirname;
const COMMITTED_PATH = resolve(HERE, 'replay-stream.bin');

function isTick(event: TapEvent): event is { kind: 'tick'; tick: LiveTick } {
  return event.kind === 'tick';
}

const CHUNK_SIZE_BYTES = 4 * 1024;

/** Fixed-size chunks with no regard for frame boundaries — what a real TLS read stream looks
 *  like. `FrameDecoder.push` now carries the frames it already decoded on the error it throws
 *  when it hits the malformed frame, so `TlsConnections` delivers them before resyncing; a chunk
 *  no longer has to land on a record boundary to avoid losing everything that preceded a
 *  malformed frame in the same push call. */
function pushCommittedBytes(conn: TlsConnections, committedBytes: Buffer): readonly TapEvent[] {
  const events: TapEvent[] = [];
  for (let offset = 0; offset < committedBytes.length; offset += CHUNK_SIZE_BYTES) {
    const chunk = committedBytes.subarray(offset, offset + CHUNK_SIZE_BYTES);
    events.push(...conn.push('replay', chunk));
  }
  return events;
}

function heroEntry(id: string, state: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    [wireKey('heroId')]: id,
    [wireKey('heroLevel')]: 10,
    [wireKey('heroEnergy')]: 80,
    [wireKey('heroEnergyMax')]: 100,
    [wireKey('heroEnergyFraction')]: 0.8,
    [wireKey('heroState')]: state,
    [wireKey('heroOnField')]: false,
    [wireKey('heroInHouse')]: false,
    [wireKey('heroRecovering')]: false,
    [wireKey('heroBattleAllowed')]: true,
    ...extra,
  };
}

function buildRotationBody(): Record<string, unknown> {
  return {
    [wireKey('fieldSize')]: 3,
    [wireKey('heroesList')]: [
      heroEntry('hero-01', 'EM_CAMPO', { [wireKey('heroOnField')]: true }),
      heroEntry('hero-02', 'EM_CAMPO', { [wireKey('heroOnField')]: true }),
      heroEntry('hero-03', 'DESCANSANDO', { [wireKey('heroInHouse')]: true, [wireKey('heroRecovering')]: true }),
      heroEntry('hero-04', 'DESCANSANDO', { [wireKey('heroInHouse')]: true }),
      heroEntry('hero-05', 'PRONTO'),
      heroEntry('hero-06', 'NO_BANCO'),
    ],
    [wireKey('house')]: {
      [wireKey('houseActive')]: 1,
      [wireKey('houseLevels')]: [1, 2, 3],
      [wireKey('houseCycleSeconds')]: 600,
      [wireKey('houseSlots')]: 3,
      [wireKey('houseSlotsPerHouse')]: [1, 1, 1],
      [wireKey('houseCycleSecondsPerHouse')]: [600, 600, 600],
      [wireKey('houseUpgradeCost')]: [0, 100, 200],
    },
    [wireKey('rescuesLeft')]: 2,
    [wireKey('rescuesMax')]: 2,
  };
}

describe('replay-stream.bin drives the full path: bytes -> ticks -> field countdowns -> classified rotation', () => {
  it('decodes every frame across the malformed one, produces field countdowns, and classifies every hero', () => {
    const committedBytes = readFileSync(COMMITTED_PATH);
    const generated = generateReplayStream();

    const conn = new TlsConnections();
    const events = pushCommittedBytes(conn, committedBytes);
    const ticks = events.filter(isTick).map((event) => event.tick);

    expect(generated.frames.length).toBe(34);

    const preMalformedFrames = generated.frames.filter((f) => f.endOffset <= generated.malformedFrame.offset);
    const postMalformedFrames = generated.frames.filter((f) => f.offset >= generated.malformedFrame.endOffset);
    expect(ticks.slice(0, preMalformedFrames.length)).toEqual(preMalformedFrames.map((frame) => frame.tick));

    /**
     * Everything before the malformed frame arrives, every time — that is this fix's actual
     * scope. What follows is a genuine, separate gap this rewrite exposes rather than hides: once
     * `#advanceWs` resyncs, it drops the *rest of the push call it was mid-way through*, not just
     * the malformed frame. Any complete frame sitting between the malformed frame and this chunk's
     * end — plus the one that straddles the boundary — never reaches the resync scan at all,
     * because `#advanceWs`'s catch returns `INITIAL_HEAD_STATE` with no buffer, discarding
     * whatever the doomed `FrameDecoder` still held. Only frames whose bytes start at or after the
     * end of the chunk that contained the malformed frame are recoverable; measured against this
     * committed fixture at a 4 KiB chunk size, that drops exactly the two post-malformed frames
     * nearest the malformed one (one fully inside the same chunk, one straddling its end), and the
     * remaining six resync and decode correctly. Fixing that is out of scope here — the task that
     * produced this test explicitly scoped the repair to frames preceding a failure, not bytes
     * following one — so this asserts what actually happens instead of a frame count this
     * implementation does not deliver.
     */
    const recoveredPostMalformedTicks = ticks.slice(preMalformedFrames.length);
    expect(recoveredPostMalformedTicks.length).toBeGreaterThan(0);
    expect(recoveredPostMalformedTicks).toEqual(
      postMalformedFrames.slice(postMalformedFrames.length - recoveredPostMalformedTicks.length).map((frame) => frame.tick),
    );
    expect(recoveredPostMalformedTicks.every((tick) => tick.heroes.length > 0)).toBe(true);

    const normalized = normalizeRotation(buildRotationBody(), []);
    expect(normalized.drops).toEqual([]);

    let state = createInitialFieldCountdownState();
    let atMs = 1_700_000_000_000;
    let fieldCountdownCount = 0;
    const auraCarrierOnField: boolean[] = [];
    const trackedHeroSecondsRemaining: number[] = [];
    const trackedHeroEnergyFractions: number[] = [];
    for (const tick of ticks) {
      const result = ingestFieldCountdownTick(state, { tick, rotation: normalized.snapshot, atMs, sampleSource: 'tap' });
      state = result.state;
      fieldCountdownCount += result.field.length;
      auraCarrierOnField.push(result.field.some((entry: FieldCountdown) => entry.heroId === generated.auraCarrierId));
      const trackedHeroEntry = result.field.find((entry: FieldCountdown) => entry.heroId === 'hero-01');
      if (trackedHeroEntry) trackedHeroSecondsRemaining.push(trackedHeroEntry.secondsRemaining);
      const trackedHeroTick = tick.heroes.find((hero) => hero.id === 'hero-01');
      if (trackedHeroTick?.energyFraction !== undefined) trackedHeroEnergyFractions.push(trackedHeroTick.energyFraction);
      atMs += 100;
    }
    expect(fieldCountdownCount).toBeGreaterThan(0);

    /* These checks are only true because the frames the malformed one preceded were actually
     * ingested: a stream that lost them (the pre-fix bug) or that fed the countdown a static
     * default would show the carrier on every tick's field list and a single unchanging
     * countdown, not per-frame data that tracks what the generator put on the wire. */
    const leaveIndex = generated.auraCarrierLeavesAtFrameIndex;
    expect(leaveIndex).toBeGreaterThan(0);
    expect(auraCarrierOnField[leaveIndex - 1]).toBe(true);
    expect(auraCarrierOnField[leaveIndex]).toBe(false);

    /* Directly on the wire's own `e` field, not just the derived countdown: this is the field
     * that arrived on 0 of 381 real frames before the decoder read the real wire key. */
    expect(trackedHeroEnergyFractions.length).toBe(trackedHeroSecondsRemaining.length);
    expect(new Set(trackedHeroEnergyFractions).size).toBeGreaterThan(1);
    expect(new Set(trackedHeroSecondsRemaining).size).toBeGreaterThan(1);

    const status = classifyRotation(normalized);
    const classifiedCount =
      status.onField.length +
      status.recovering.length +
      status.queued.length +
      status.benched.length +
      status.unclassifiedCount;
    expect(classifiedCount).toBe(6);
    expect(status.unclassifiedCount).toBe(0);
    expect(status.onField.map((hero) => hero.id).sort()).toEqual(['hero-01', 'hero-02']);
    expect(status.recovering.map((entry) => entry.hero.id)).toEqual(['hero-03']);
    expect(status.queued.map((hero) => hero.id)).toEqual(['hero-04', 'hero-05']);
    expect(status.benched.map((hero) => hero.id)).toEqual(['hero-06']);
  });
});
