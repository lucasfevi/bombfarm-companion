import type { LiveTick } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import {
  buildHttpResponse,
  buildOversized64BitLengthFrame,
  buildServerTextFrame,
  generateReplayStream,
  type ReplayStream,
} from './fixtures/generate-replay-stream.js';
import { findWsFrameStart, TlsConnections, type Ctx, type TapEvent } from './tls-stream.js';

const stream = generateReplayStream();

function isTick(event: TapEvent): event is { kind: 'tick'; tick: LiveTick } {
  return event.kind === 'tick';
}

/**
 * One push per logical unit (the HTTP response, each websocket frame, the malformed frame, the
 * truncated tail) rather than one push for the whole file. `FrameDecoder.push` returns whatever
 * it decoded only if the whole call succeeds — a call that decodes several good frames and then
 * hits the malformed one throws before returning any of them — so pushing record-aligned chunks
 * is what makes this decode lossless and gives the other tests a frame set to compare against.
 */
function pushWholeStream(conn: TlsConnections, ctx: Ctx, replay: ReplayStream): TapEvent[] {
  const beforeMalformed = replay.frames.filter((f) => f.endOffset <= replay.malformedFrame.offset);
  const afterMalformed = replay.frames.filter((f) => f.offset >= replay.malformedFrame.endOffset);
  const segments = [
    replay.httpResponse,
    ...beforeMalformed,
    replay.malformedFrame,
    ...afterMalformed,
    { offset: replay.truncatedTail.offset, endOffset: replay.bytes.length },
  ];

  const events: TapEvent[] = [];
  for (const segment of segments) {
    events.push(...conn.push(ctx, replay.bytes.subarray(segment.offset, segment.endOffset)));
  }
  return events;
}

describe('TlsConnections: decoding the full replay stream', () => {
  it('recognises the HTTP response and recovers every snap tick in order', () => {
    const conn = new TlsConnections();
    const events = pushWholeStream(conn, 'main', stream);

    expect(events[0]).toEqual({ kind: 'http', status: stream.httpResponse.status });
    expect(events.some((e) => e.kind === 'upgrade')).toBe(false);

    const ticks = events.filter(isTick).map((e) => e.tick);
    expect(ticks).toEqual(stream.frames.map((f) => f.tick));
  });

  it("carries the aura-carrier hero's departure as its absence from the heroes list", () => {
    const conn = new TlsConnections();
    const ticks = pushWholeStream(conn, 'main', stream)
      .filter(isTick)
      .map((e) => e.tick);

    const leaveIndex = stream.auraCarrierLeavesAtFrameIndex;
    expect(leaveIndex).toBeGreaterThan(0);

    const before = ticks[leaveIndex - 1];
    const after = ticks[leaveIndex];
    expect(before?.heroes.some((h) => h.id === stream.auraCarrierId)).toBe(true);
    expect(after?.heroes.some((h) => h.id === stream.auraCarrierId)).toBe(false);
  });
});

describe('TlsConnections: mid-stream resync from arbitrary offsets', () => {
  const blockA = stream.frames.filter((f) => f.endOffset <= stream.malformedFrame.offset);

  function offsetInto(index: number, fraction: number): number {
    const frame = blockA[index];
    if (!frame) throw new Error(`fixture has no block-A frame at index ${String(index)}`);
    return frame.offset + Math.floor((frame.endOffset - frame.offset) * fraction);
  }

  const offsets = [
    stream.httpResponse.offset + 10, // inside the HTTP response body
    offsetInto(0, 0), // exactly at a frame boundary
    offsetInto(0, 0.01), // just past a frame's header — the whole frame must be skipped
    offsetInto(2, 0.3),
    offsetInto(5, 1), // exactly where the next frame starts
    offsetInto(8, 0.2),
    offsetInto(10, 0.02),
    offsetInto(12, 0.5),
    offsetInto(14, 0.9),
    offsetInto(16, 0), // exactly at the aura-carrier's departure frame
    offsetInto(18, 0.02),
    offsetInto(20, 0.4),
  ];

  it.each(offsets)('recovers the same frames onward, with no partial frame, from offset %i', (start) => {
    const expectedStartIndex = blockA.findIndex((f) => f.offset >= start);
    expect(expectedStartIndex).toBeGreaterThanOrEqual(0);

    const conn = new TlsConnections();
    const events = conn.push(`offset-${String(start)}`, stream.bytes.subarray(start, stream.malformedFrame.offset));
    const ticks = events.filter(isTick).map((e) => e.tick);

    expect(ticks).toEqual(blockA.slice(expectedStartIndex).map((f) => f.tick));
  });
});

describe('TlsConnections: two connections interleaved on one push sequence', () => {
  it('keeps each connection to its own frames with no cross-talk', () => {
    const conn = new TlsConnections();
    const idleFrames = stream.frames.slice(0, 3);
    const combatFrames = stream.frames.slice(6, 9);

    const idleTicks: LiveTick[] = [];
    const combatTicks: LiveTick[] = [];

    for (let i = 0; i < 3; i += 1) {
      const idleFrame = idleFrames[i];
      const combatFrame = combatFrames[i];
      if (!idleFrame || !combatFrame) throw new Error('fixture missing expected frames for interleave test');

      idleTicks.push(
        ...conn
          .push('conn-idle', stream.bytes.subarray(idleFrame.offset, idleFrame.endOffset))
          .filter(isTick)
          .map((e) => e.tick),
      );
      combatTicks.push(
        ...conn
          .push('conn-combat', stream.bytes.subarray(combatFrame.offset, combatFrame.endOffset))
          .filter(isTick)
          .map((e) => e.tick),
      );
    }

    expect(idleTicks).toEqual(idleFrames.map((f) => f.tick));
    expect(combatTicks).toEqual(combatFrames.map((f) => f.tick));
  });
});

describe('TlsConnections: malformed frame mid-stream', () => {
  it('drops back to head and resyncs instead of terminating the stream', () => {
    const conn = new TlsConnections();
    const frameA = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] })));
    const malformed = buildOversized64BitLengthFrame();
    const frameB = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-02' }] })));

    expect(conn.push('flaky', frameA)).toEqual([{ kind: 'tick', tick: { heroes: [{ id: 'hero-01' }] } }]);
    expect(conn.push('flaky', malformed)).toEqual([]);
    expect(conn.push('flaky', frameB)).toEqual([{ kind: 'tick', tick: { heroes: [{ id: 'hero-02' }] } }]);
  });
});

describe('TlsConnections: websocket upgrade caught live', () => {
  it('emits upgrade and starts decoding frames straight after the handshake headers', () => {
    const conn = new TlsConnections();
    const handshake = buildHttpResponse(101, 'Switching Protocols', '');
    const frame = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] })));

    const events = conn.push('handshake', Buffer.concat([handshake, frame]));

    expect(events).toEqual([{ kind: 'upgrade' }, { kind: 'tick', tick: { heroes: [{ id: 'hero-01' }] } }]);
  });
});

describe('TlsConnections: HTTP recognition', () => {
  it('recognises an HTTP response on an otherwise silent connection', () => {
    const conn = new TlsConnections();
    const events = conn.push('rest-only', buildHttpResponse(204, 'No Content', ''));

    expect(events).toEqual([{ kind: 'http', status: 204 }]);
  });

  it('gives up classifying a connection after 256 KiB of unrecognisable bytes', () => {
    const conn = new TlsConnections();
    const noise = Buffer.alloc(1024, 0x00);
    for (let i = 0; i < 256; i += 1) {
      expect(conn.push('noise', noise)).toEqual([]);
    }

    const valid = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [] })));
    expect(conn.push('noise', valid)).toEqual([]);
  });
});

describe('TlsConnections: forget and reset', () => {
  it('drops per-connection state so a forgotten or reset connection starts fresh', () => {
    const conn = new TlsConnections();
    const combatFrame = stream.frames[6];
    if (!combatFrame) throw new Error('fixture missing expected combat frame');
    const frameBytes = stream.bytes.subarray(combatFrame.offset, combatFrame.endOffset);

    conn.push('a', frameBytes);
    conn.forget('a');
    expect(conn.push('a', buildHttpResponse(200, 'OK', ''))).toEqual([{ kind: 'http', status: 200 }]);

    conn.push('b', frameBytes);
    conn.reset();
    expect(conn.push('b', buildHttpResponse(200, 'OK', ''))).toEqual([{ kind: 'http', status: 200 }]);
  });
});

describe('TlsConnections: idle connection sweep', () => {
  it('does not grow without bound across many short-lived connections', () => {
    let now = 0;
    const conn = new TlsConnections({ now: () => now, idleSweepTtlMs: 1_000 });

    for (let i = 0; i < 200; i += 1) {
      conn.push(`rest-${String(i)}`, buildHttpResponse(200, 'OK', ''));
      now += 2_000;
    }

    expect(conn.size).toBeLessThanOrEqual(2);
  });

  it('never sweeps a connection mid-websocket-stream, no matter how long it sits idle', () => {
    let now = 0;
    const conn = new TlsConnections({ now: () => now, idleSweepTtlMs: 1_000 });
    const handshake = buildHttpResponse(101, 'Switching Protocols', '');
    conn.push('ws-conn', handshake);

    now += 10_000;
    conn.push('rest-conn', buildHttpResponse(200, 'OK', ''));

    const frame = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] })));
    expect(conn.push('ws-conn', frame)).toEqual([{ kind: 'tick', tick: { heroes: [{ id: 'hero-01' }] } }]);
  });
});

describe('TlsConnections: resync overlap across a chunk boundary', () => {
  it('still finds a frame whose header byte arrives in a chunk before the rest of the header', () => {
    const conn = new TlsConnections();
    const payload = Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] }));
    const frame = buildServerTextFrame(payload);
    const headerFirstByte = frame.subarray(0, 1);
    const rest = frame.subarray(1);

    expect(conn.push('split', Buffer.alloc(20, 0x00))).toEqual([]);
    expect(conn.push('split', headerFirstByte)).toEqual([]);
    expect(conn.push('split', rest)).toEqual([{ kind: 'tick', tick: { heroes: [{ id: 'hero-01' }] } }]);
  });
});

describe('TlsConnections: a frame split across the resync boundary is revisited, not lost', () => {
  it('recovers a snap frame whose header lands before scannedUpTo and whose payload arrives in a later push', () => {
    const payload = Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }], pad: 'x'.repeat(1800) }));
    const frame = buildServerTextFrame(payload);
    const bytes = Buffer.concat([Buffer.alloc(200, 0x00), frame]);

    const conn = new TlsConnections();
    const first = conn.push('split-payload', bytes.subarray(0, 1000));
    const second = conn.push('split-payload', bytes.subarray(1000));

    expect([...first, ...second]).toHaveLength(1);
    expect([...first, ...second][0]).toEqual({ kind: 'tick', tick: { heroes: [{ id: 'hero-01' }] } });
  });

  /**
   * Best-of-3 wall time, not a call-count spy: `scannedUpTo` is private connection state with no
   * seam to observe directly, and the regression this guards against is exactly the one `push`'s
   * scannedUpTo optimisation exists to prevent — rescanning already-dead bytes from offset 0 on
   * every call. A dead zone (no 0x81 byte anywhere) makes the per-push scan cost proportional to
   * the new bytes only if the optimisation holds; reverting to a full rescan turns 512 pushes over
   * a ~256 KiB buffer quadratic, which blows well past this ceiling even on a slow CI runner.
   *
   * MEASURED BASELINE (developer machine, Windows, Node 24, fastest of 3 runs): under 15ms with
   * the optimisation intact.
   */
  it('stays fast across many pushes on a connection that never resyncs (scannedUpTo is not lost)', () => {
    const NO_RESYNC_MAX_MS = 800;
    // Every byte stays below 0x81 (the WS frame marker `parseResyncCandidate` requires), so the
    // scan never sees a candidate at all — the buffer is unambiguously dead, isolating the
    // measurement from the "genuinely incomplete candidate" path this same fix intentionally
    // keeps re-scannable.
    const chunk = Buffer.alloc(500, 0x00);
    for (let i = 0; i < chunk.length; i += 1) chunk[i] = i % 0x81;

    let fastestMs = Number.POSITIVE_INFINITY;
    for (let sample = 0; sample < 3; sample += 1) {
      const conn = new TlsConnections();
      const startedAt = performance.now();
      for (let i = 0; i < 512; i += 1) {
        expect(conn.push('dead-zone', chunk)).toEqual([]);
      }
      fastestMs = Math.min(fastestMs, performance.now() - startedAt);
    }

    console.log(`[perf] 512 pushes over a non-resyncing connection: ${fastestMs.toFixed(1)}ms`);
    expect(
      fastestMs,
      `512 pushes took ${fastestMs.toFixed(1)}ms (ceiling ${String(NO_RESYNC_MAX_MS)}ms) — scannedUpTo may be rescanning from 0`,
    ).toBeLessThan(NO_RESYNC_MAX_MS);
  });
});

describe('findWsFrameStart', () => {
  it('rejects a 64-bit length candidate during resync and finds the real frame after it', () => {
    const fake = buildOversized64BitLengthFrame();
    const real = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [] })));

    expect(findWsFrameStart(Buffer.concat([fake, real]))).toBe(fake.length);
  });

  it('rejects a length-plausible candidate whose payload is not a snap message', () => {
    const notSnap = buildServerTextFrame(Buffer.from('not json at all'));
    const real = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [] })));

    expect(findWsFrameStart(Buffer.concat([notSnap, real]))).toBe(notSnap.length);
  });

  it('returns undefined when nothing in the buffer parses as a snap message', () => {
    expect(findWsFrameStart(Buffer.from('nothing to see here, move along'))).toBeUndefined();
  });
});
