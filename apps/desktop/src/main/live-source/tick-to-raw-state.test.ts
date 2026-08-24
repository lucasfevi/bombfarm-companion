import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LiveTick } from '@bombfarm/contracts';
import { buildSnapshot, classifyGameState } from '@bombfarm/game-data';
import { generateReplayStream } from './fixtures/generate-replay-stream.js';
import { tickToRawGameState } from './tick-to-raw-state.js';

/** `__dirname`, not `import.meta.url`: `tsconfig.main.json` builds this tree to CommonJS. */
const HERE = __dirname;
const COMMITTED_PATH = resolve(HERE, 'fixtures/replay-stream.bin');

describe('tickToRawGameState', () => {
  const stream = generateReplayStream();

  it('sanity: the frames used below are the committed replay fixture, not an ad-hoc sample', () => {
    const committed = readFileSync(COMMITTED_PATH);
    expect(stream.bytes.equals(committed)).toBe(true);
    expect(stream.frames.length).toBeGreaterThan(0);
  });

  it('every frame of the replay fixture, once adapted, passes the real classifyGameState', () => {
    for (const frame of stream.frames) {
      const raw = tickToRawGameState(frame.tick);
      expect(classifyGameState(raw)).toBe(true);
    }
  });

  it('round-trips gold, phase, and wave exactly', () => {
    for (const frame of stream.frames) {
      const raw = tickToRawGameState(frame.tick);
      expect(raw?.gold).toBe(frame.tick.gold);
      expect(raw?.phase).toBe(frame.tick.phase);
      expect(raw?.wave).toBe(frame.tick.wave);
    }
  });

  it('returns null for a tick with no gold, rather than fabricating gold: 0', () => {
    const tick: LiveTick = { heroes: [], phase: 26, wave: 3 };
    expect(tickToRawGameState(tick)).toBeNull();
  });

  it('feeds the real buildSnapshot end to end: snapshot.gold and snapshot.phase match the source tick', () => {
    for (const frame of stream.frames) {
      const raw = tickToRawGameState(frame.tick);
      const built = buildSnapshot({ takenAt: '2026-08-22T00:00:00.000Z', source: 'live', state: raw });
      expect(built.snapshot?.gold).toBe(frame.tick.gold);
      expect(built.snapshot?.phase).toBe(frame.tick.phase);
    }
  });
});
