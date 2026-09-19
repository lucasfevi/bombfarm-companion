import type { LiveTick } from '@bombfarm/contracts';
import { liveFrameWireKey as wireKey } from '@bombfarm/game-api';
import { deflateSync, gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  buildHttpResponse,
  buildOversized64BitLengthFrame,
  buildServerBinaryFrame,
  buildServerTextFrame,
  generateReplayStream,
  type ReplayStream,
} from './fixtures/generate-replay-stream.js';
import { FrameRing } from './frame-ring.js';
import { findWsFrameStart, toLiveTick, TlsConnections, type Ctx, type FrameRingPort, type TapEvent } from './tls-stream.js';

const stream = generateReplayStream();

function isTick(event: TapEvent): event is Extract<TapEvent, { kind: 'tick' }> {
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

/** The whole tick event a `{ t: 'snap', heroes: [...] }` payload decodes to. Spelled once so the
 *  assertions below stay exact — the event carries the wire object as well as the decoded tick,
 *  and a `toMatchObject` here would stop noticing either. */
function tickEvent(id: string, extraWire: Record<string, unknown> = {}): Extract<TapEvent, { kind: 'tick' }> {
  return {
    kind: 'tick',
    tick: { heroes: [{ id }] },
    raw: { t: 'snap', heroes: [{ id }], ...extraWire },
  };
}

describe('TlsConnections: decoding the full replay stream', () => {
  it('recognises the HTTP response and recovers every snap tick in order', () => {
    const conn = new TlsConnections();
    const events = pushWholeStream(conn, 'main', stream);

    expect(events[0]).toEqual({
      kind: 'http',
      status: stream.httpResponse.status,
      body: Buffer.from(JSON.stringify({ ok: true }), 'utf8'),
    });
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

    expect(conn.push('flaky', frameA)).toEqual([tickEvent('hero-01')]);
    expect(conn.push('flaky', malformed)).toEqual([]);
    expect(conn.push('flaky', frameB)).toEqual([tickEvent('hero-02')]);
  });
});

describe('TlsConnections: good frames preceding a malformed frame in the same chunk survive', () => {
  it('delivers every frame decoded before a malformed frame arriving in the same push call', () => {
    const conn = new TlsConnections();
    const frameA = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] })));
    const frameB = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-02' }] })));
    const frameC = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-03' }] })));
    const malformed = buildOversized64BitLengthFrame();

    const events = conn.push('one-chunk', Buffer.concat([frameA, frameB, frameC, malformed]));

    expect(events).toEqual([
      tickEvent('hero-01'),
      tickEvent('hero-02'),
      tickEvent('hero-03'),
    ]);
  });

  it('still resyncs after the malformed frame, decoding frames that arrive in a later chunk', () => {
    const conn = new TlsConnections();
    const good = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] })));
    const malformed = buildOversized64BitLengthFrame();
    const later = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-02' }] })));

    conn.push('one-chunk-resync', Buffer.concat([good, malformed]));
    const events = conn.push('one-chunk-resync', later);

    expect(events).toEqual([tickEvent('hero-02')]);
  });

  it('emits ticks for both valid frames when a malformed frame arrives between them in one push', () => {
    const conn = new TlsConnections();
    const frameA = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] })));
    const malformed = buildOversized64BitLengthFrame();
    const frameB = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-02' }] })));

    const events = conn.push('sandwiched', Buffer.concat([frameA, malformed, frameB]));

    expect(events).toEqual([
      tickEvent('hero-01'),
      tickEvent('hero-02'),
    ]);
  });

  it('terminates and still delivers the frames after the second malformed frame, given two in one push', () => {
    const conn = new TlsConnections();
    const frameA = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] })));
    const malformed1 = buildOversized64BitLengthFrame();
    const frameB = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-02' }] })));
    const malformed2 = buildOversized64BitLengthFrame();
    const frameC = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-03' }] })));

    const events = conn.push('double-malformed', Buffer.concat([frameA, malformed1, frameB, malformed2, frameC]));

    expect(events).toEqual([
      tickEvent('hero-01'),
      tickEvent('hero-02'),
      tickEvent('hero-03'),
    ]);
  });

  it('pushes the pre-failure frames into the ring before the parse failure dumps it, so the dump is not empty', () => {
    class FakeRing implements FrameRingPort {
      pushed: Buffer[] = [];
      dumpReasons: Array<'parse-failure' | 'manual'> = [];
      push(bytes: Uint8Array): void {
        this.pushed.push(Buffer.from(bytes));
      }
      dumpToDisk(reason: 'parse-failure' | 'manual'): void {
        this.dumpReasons.push(reason);
      }
    }
    const ring = new FakeRing();
    const conn = new TlsConnections({ ring });
    const frameA = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] })));
    const frameB = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-02' }] })));
    const malformed = buildOversized64BitLengthFrame();

    conn.push('one-chunk-ring', Buffer.concat([frameA, frameB, malformed]));

    expect(ring.pushed).toHaveLength(2);
    expect(ring.dumpReasons.length).toBeGreaterThan(0);
  });

  it('dumps to disk exactly once for a single parse failure, even with several frames preceding it', () => {
    class FakeRing implements FrameRingPort {
      dumpReasons: Array<'parse-failure' | 'manual'> = [];
      push(): void {
        /* not exercised */
      }
      dumpToDisk(reason: 'parse-failure' | 'manual'): void {
        this.dumpReasons.push(reason);
      }
    }
    const ring = new FakeRing();
    const conn = new TlsConnections({ ring });
    const frameA = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] })));
    const frameB = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-02' }] })));
    const frameC = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-03' }] })));
    const malformed = buildOversized64BitLengthFrame();

    conn.push('one-chunk-dump-once', Buffer.concat([frameA, frameB, frameC, malformed]));

    expect(ring.dumpReasons).toEqual(['parse-failure']);
  });
});

describe('TlsConnections: a single push does not grow the call stack per frame', () => {
  it('drains thousands of alternating malformed/valid frames in one push without overflowing the stack', () => {
    const ALTERNATION_COUNT = 5_000;
    const parts: Buffer[] = [];
    const expectedIds: string[] = [];
    for (let i = 0; i < ALTERNATION_COUNT; i += 1) {
      parts.push(buildOversized64BitLengthFrame());
      const id = `hero-${String(i)}`;
      parts.push(buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id }] }))));
      expectedIds.push(id);
    }

    const conn = new TlsConnections();
    const events = conn.push('stack-safety-frames', Buffer.concat(parts));
    const ticks = events.filter(isTick).map((e) => e.tick);

    expect(ticks).toHaveLength(ALTERNATION_COUNT);
    expect(ticks.map((t) => t.heroes[0]?.id)).toEqual(expectedIds);
  });

  it('drains thousands of back-to-back HTTP responses in one push without overflowing the stack', () => {
    const RESPONSE_COUNT = 20_000;
    const responses: Buffer[] = [];
    for (let i = 0; i < RESPONSE_COUNT; i += 1) responses.push(buildHttpResponse(200, 'OK', ''));

    const conn = new TlsConnections();
    const events = conn.push('stack-safety-http', Buffer.concat(responses));

    expect(events).toHaveLength(RESPONSE_COUNT);
    expect(events.every((e) => e.kind === 'http' && e.status === 200)).toBe(true);
  });
});

describe('TlsConnections: websocket upgrade caught live', () => {
  it('emits upgrade and starts decoding frames straight after the handshake headers', () => {
    const conn = new TlsConnections();
    const handshake = buildHttpResponse(101, 'Switching Protocols', '');
    const frame = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] })));

    const events = conn.push('handshake', Buffer.concat([handshake, frame]));

    expect(events).toEqual([{ kind: 'upgrade' }, tickEvent('hero-01')]);
  });
});

describe('TlsConnections: HTTP recognition', () => {
  it('recognises an HTTP response on an otherwise silent connection', () => {
    const conn = new TlsConnections();
    const events = conn.push('rest-only', buildHttpResponse(204, 'No Content', ''));

    expect(events).toEqual([{ kind: 'http', status: 204 }]);
  });

  it('gives up classifying a connection after 8 MiB of unrecognisable bytes, and says so once', () => {
    const warnings: Record<string, unknown>[] = [];
    const conn = new TlsConnections({ log: { warn: (record) => warnings.push(record) } });
    const noise = Buffer.alloc(256 * 1024, 0x00);
    for (let i = 0; i < 32; i += 1) {
      expect(conn.push('noise', noise)).toEqual([]);
    }

    const valid = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [] })));
    expect(conn.push('noise', valid)).toEqual([]);
    expect(warnings).toEqual([
      { scope: 'live-source', event: 'live-source.connection_ignored', reason: 'unrecognised_bytes', bytes: 8 * 1024 * 1024 },
    ]);
  });
});

describe('TlsConnections: resyncing to the next response behind bytes that are not one', () => {
  const duelResult = buildRawHttpResponse(200, ['Content-Length: 25'], '{"venceu":true,"filme":6}');

  it('attached in the middle of a body, delivers the next response on that connection instead of burying it', () => {
    const warnings: Record<string, unknown>[] = [];
    const conn = new TlsConnections({ log: { warn: (record) => warnings.push(record) } });
    const tailOfSomeBody = Buffer.from('"export_lock_secs":0}]}', 'utf8');

    expect(conn.push('mid-body', tailOfSomeBody)).toEqual([]);
    expect(conn.push('mid-body', duelResult)).toEqual([{ kind: 'http', status: 200, body: Buffer.from('{"venceu":true,"filme":6}') }]);
    expect(warnings).toEqual([
      { scope: 'live-source', event: 'live-source.http_resynced', reason: 'unrecognised_prefix', discardedBytes: tailOfSomeBody.length },
    ]);
    expect(conn.push('mid-body', duelResult)).toHaveLength(1);
  });

  it('delivers a response the client sent on a reused connection whose previous body it abandoned mid-way', () => {
    const warnings: Record<string, unknown>[] = [];
    const conn = new TlsConnections({ log: { warn: (record) => warnings.push(record) } });
    const abandoned = Buffer.concat([
      Buffer.from('HTTP/1.1 200 OK\r\nContent-Length: 128000\r\n\r\n', 'latin1'),
      Buffer.from('{"items":[{"id":1', 'utf8'),
    ]);

    expect(conn.push('0x1f3a', abandoned)).toEqual([]);
    expect(conn.push('0x1f3a', duelResult)).toEqual([{ kind: 'http', status: 200, body: Buffer.from('{"venceu":true,"filme":6}') }]);
    expect(warnings).toEqual([
      { scope: 'live-source', event: 'live-source.http_resynced', reason: 'body_cut_short', discardedBytes: abandoned.length },
    ]);
  });

  it('keeps waiting for a declared body that is still arriving — the resync needs a whole header, not a status line', () => {
    const conn = new TlsConnections();
    const head = Buffer.from('HTTP/1.1 200 OK\r\nContent-Length: 40\r\n\r\n', 'latin1');
    const bodyMentioningHttp = Buffer.from('{"note":"HTTP/1.1 200 OK is not a resync","z":0}', 'utf8').subarray(0, 40);

    expect(conn.push('honest', head)).toEqual([]);
    expect(conn.push('honest', bodyMentioningHttp.subarray(0, 30))).toEqual([]);
    expect(conn.push('honest', bodyMentioningHttp.subarray(30))).toEqual([{ kind: 'http', status: 200, body: bodyMentioningHttp }]);
  });

  it('finds a response whose header straddles two reads behind the junk', () => {
    const conn = new TlsConnections();
    const junk = Buffer.alloc(3000, 0x2a);
    const split = 20;

    expect(conn.push('straddle', Buffer.concat([junk, duelResult.subarray(0, split)]))).toEqual([]);
    expect(conn.push('straddle', duelResult.subarray(split))).toEqual([{ kind: 'http', status: 200, body: Buffer.from('{"venceu":true,"filme":6}') }]);
  });

  it('still recovers a combat frame behind junk, the resync the websocket side already had', () => {
    const conn = new TlsConnections();
    const frame = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [] })));

    const events = conn.push('ws-after-junk', Buffer.concat([Buffer.from('garbage', 'latin1'), frame]));
    expect(events.map((event) => event.kind)).toEqual(['tick']);
  });
});

function buildRawHttpResponse(status: number, extraHeaders: readonly string[], body: string): Buffer {
  const bodyBuf = Buffer.from(body, 'utf8');
  const head = [`HTTP/1.1 ${String(status)} X`, 'Content-Type: application/json', ...extraHeaders].join('\r\n') + '\r\n\r\n';
  return Buffer.concat([Buffer.from(head, 'latin1'), bodyBuf]);
}

describe('TlsConnections: HTTP body reassembly', () => {
  it('buffers a body across multiple reads until content-length is satisfied, then delivers it whole', () => {
    const json = JSON.stringify({ heroes: [], field_size: 3 });
    const response = buildHttpResponse(200, 'OK', json);
    const splitAt = response.length - 5;

    const conn = new TlsConnections();
    expect(conn.push('slow-body', response.subarray(0, splitAt))).toEqual([]);
    expect(conn.push('slow-body', response.subarray(splitAt))).toEqual([
      { kind: 'http', status: 200, body: Buffer.from(json, 'utf8') },
    ]);
  });

  it('does not report a skip for a response with a genuinely empty body', () => {
    const warnings: Record<string, unknown>[] = [];
    const conn = new TlsConnections({ log: { warn: (record) => warnings.push(record) } });

    conn.push('empty-body', buildHttpResponse(204, 'No Content', ''));

    expect(warnings).toEqual([]);
  });

  it('reassembles a chunked body — chunk extensions and trailers included — and delivers it whole', () => {
    const warnings: Record<string, unknown>[] = [];
    const conn = new TlsConnections({ log: { warn: (record) => warnings.push(record) } });

    const events = conn.push(
      'chunked',
      buildRawHttpResponse(
        200,
        ['Transfer-Encoding: chunked'],
        '5;ext=1\r\nhello\r\n7\r\n, world\r\n0\r\nX-Trailer: yes\r\n\r\n',
      ),
    );

    expect(events).toEqual([{ kind: 'http', status: 200, body: Buffer.from('hello, world', 'utf8') }]);
    expect(warnings).toEqual([]);
  });

  it('keeps buffering a chunked body split across reads mid-chunk, scanning none of it for a frame start', () => {
    const json = JSON.stringify({ venceu: true, filme: 7, padding: 'x'.repeat(3000) });
    const chunks = [json.slice(0, 1000), json.slice(1000, 2500), json.slice(2500)];
    const wire = chunks.map((chunk) => `${chunk.length.toString(16)}\r\n${chunk}\r\n`).join('') + '0\r\n\r\n';
    const response = buildRawHttpResponse(200, ['Transfer-Encoding: chunked'], wire);
    const next = buildHttpResponse(200, 'OK', '{"after":true}');

    const conn = new TlsConnections();
    const events: unknown[] = [];
    for (let offset = 0; offset < response.length; offset += 700) {
      events.push(...conn.push('split-chunked', response.subarray(offset, offset + 700)));
    }
    expect(events).toEqual([{ kind: 'http', status: 200, body: Buffer.from(json, 'utf8') }]);
    expect(conn.push('split-chunked', next)).toEqual([{ kind: 'http', status: 200, body: Buffer.from('{"after":true}', 'utf8') }]);
  });

  it('inflates a gzip body declared by content-length', () => {
    const json = JSON.stringify({ venceu: true, filme: 48117 });
    const gz = gzipSync(Buffer.from(json, 'utf8'));
    const head = ['HTTP/1.1 200 OK', 'Content-Type: application/json', 'Content-Encoding: gzip', `Content-Length: ${String(gz.length)}`].join('\r\n') + '\r\n\r\n';

    const conn = new TlsConnections();
    expect(conn.push('gzip', Buffer.concat([Buffer.from(head, 'latin1'), gz]))).toEqual([
      { kind: 'http', status: 200, body: Buffer.from(json, 'utf8') },
    ]);
  });

  it('reads a film-sized body — hundreds of KB of frames, chunked and gzipped, in 16 KiB reads — as the JSON it was', () => {
    // Pseudo-random figures, so the frames compress the way real ones do rather than collapsing
    // to a few kilobytes — the wire form has to be what beat the old 256 KiB cap.
    let seed = 20260916;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const film = JSON.stringify({
      id: 48117,
      fase: 120,
      q: Array.from({ length: 721 }, (_, index) => ({
        t: index / 12,
        hp: Math.round(rand() * 100000),
        da: Math.round(rand() * 200000),
        dd: Math.round(rand() * 200000),
        h: Array.from({ length: 10 }, (__, slot) => ({ i: slot, e: rand(), x: rand() * 19, y: rand() * 15, s: rand() })),
        b: Array.from({ length: 6 }, () => ({ c: Math.round(rand() * 300), r: Math.round(rand() * 3), f: rand() })),
      })),
    });
    expect(film.length).toBeGreaterThan(800_000);
    const gz = gzipSync(Buffer.from(film, 'utf8'));
    const chunkSize = 8192;
    const wireParts: Buffer[] = [];
    for (let offset = 0; offset < gz.length; offset += chunkSize) {
      const chunk = gz.subarray(offset, offset + chunkSize);
      wireParts.push(Buffer.from(`${chunk.length.toString(16)}\r\n`, 'latin1'), chunk, Buffer.from('\r\n', 'latin1'));
    }
    wireParts.push(Buffer.from('0\r\n\r\n', 'latin1'));
    const head = ['HTTP/1.1 200 OK', 'Content-Type: application/json', 'Content-Encoding: gzip', 'Transfer-Encoding: chunked'].join('\r\n') + '\r\n\r\n';
    const response = Buffer.concat([Buffer.from(head, 'latin1'), ...wireParts]);
    expect(response.length).toBeGreaterThan(256 * 1024);

    const warnings: Record<string, unknown>[] = [];
    const conn = new TlsConnections({ log: { warn: (record) => warnings.push(record) } });
    const events: unknown[] = [];
    for (let offset = 0; offset < response.length; offset += 16 * 1024) {
      events.push(...conn.push('film', response.subarray(offset, offset + 16 * 1024)));
    }
    expect(warnings).toEqual([]);
    expect(events).toHaveLength(1);
    const [event] = events as [{ kind: string; body?: Buffer }];
    expect(event.kind).toBe('http');
    expect(event.body?.toString('utf8')).toBe(film);
  });

  it('skips a body under an encoding it cannot inflate and reports the skip once via the injected log', () => {
    const warnings: Record<string, unknown>[] = [];
    const conn = new TlsConnections({ log: { warn: (record) => warnings.push(record) } });

    const events = conn.push(
      'compressed',
      buildRawHttpResponse(200, ['Content-Length: 5', 'Content-Encoding: zstd'], 'xxxxx'),
    );

    expect(events).toEqual([{ kind: 'http', status: 200 }]);
    expect(warnings).toEqual([
      { scope: 'live-source', event: 'live-source.http_body_skipped', reason: 'compressed', status: 200 },
    ]);
  });

  it('skips a body whose declared gzip encoding refuses the bytes, rather than delivering garbage', () => {
    const warnings: Record<string, unknown>[] = [];
    const conn = new TlsConnections({ log: { warn: (record) => warnings.push(record) } });

    const events = conn.push(
      'bad-gzip',
      buildRawHttpResponse(200, ['Content-Length: 5', 'Content-Encoding: gzip'], 'xxxxx'),
    );

    expect(events).toEqual([{ kind: 'http', status: 200 }]);
    expect(warnings).toEqual([
      { scope: 'live-source', event: 'live-source.http_body_skipped', reason: 'compressed', status: 200 },
    ]);
  });

  it('skips a body with no usable content-length and reports the skip once via the injected log', () => {
    const warnings: Record<string, unknown>[] = [];
    const conn = new TlsConnections({ log: { warn: (record) => warnings.push(record) } });

    const events = conn.push('no-length', buildRawHttpResponse(200, [], 'irrelevant body text'));

    expect(events).toEqual([{ kind: 'http', status: 200 }]);
    expect(warnings).toEqual([
      { scope: 'live-source', event: 'live-source.http_body_skipped', reason: 'no_length', status: 200 },
    ]);
  });

  it('never reports a skip for a websocket upgrade handshake, which carries no body to identify', () => {
    const warnings: Record<string, unknown>[] = [];
    const conn = new TlsConnections({ log: { warn: (record) => warnings.push(record) } });

    conn.push('handshake', buildHttpResponse(101, 'Switching Protocols', ''));

    expect(warnings).toEqual([]);
  });

  it('gives up on a declared body that never fully arrives, rather than buffering it without limit', () => {
    const warnings: Record<string, unknown>[] = [];
    const conn = new TlsConnections({ log: { warn: (record) => warnings.push(record) } });
    const headers = 'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 99999999\r\n\r\n';
    expect(conn.push('runaway-body', Buffer.from(headers, 'latin1'))).toEqual([]);

    const chunk = Buffer.alloc(256 * 1024, 0x61);
    for (let i = 0; i < 32; i += 1) {
      expect(conn.push('runaway-body', chunk)).toEqual([]);
    }

    // Once the connection has given up (8 MiB — see GIVEUP_BYTES's own justification), further
    // bytes are discarded outright rather than kept in an ever-growing buffer.
    expect(conn.push('runaway-body', chunk)).toEqual([]);
    expect(warnings).toEqual([
      {
        scope: 'live-source',
        event: 'live-source.connection_ignored',
        reason: 'body_never_completed',
        bytes: headers.length + 32 * 256 * 1024,
      },
    ]);
  });
});

describe('TlsConnections: an HTTP response body can never evict a combat frame from the shared ring', () => {
  it('a burst of large HTTP bodies well over the ring budget leaves an earlier combat frame in place, because a body is never pushed into the ring at all', () => {
    class FakeRing implements FrameRingPort {
      pushed: Buffer[] = [];
      push(bytes: Uint8Array): void {
        this.pushed.push(Buffer.from(bytes));
      }
      dumpToDisk(): void {
        /* not exercised */
      }
    }
    const ring = new FakeRing();
    const conn = new TlsConnections({ ring });
    const combatFrame = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] })));

    conn.push('combat', combatFrame);
    // 44 responses at ~85 KB each — the observed session's own numbers — several times over the
    // ring's 500 KB budget, which is exactly what would evict the frame above if a body reached it.
    for (let i = 0; i < 44; i += 1) {
      conn.push(`account-${String(i)}`, buildHttpResponse(200, 'OK', 'x'.repeat(85_000)));
    }

    expect(ring.pushed).toHaveLength(1);
    expect(JSON.parse(ring.pushed[0]?.toString('utf8') ?? '')).toEqual({ t: 'snap', heroes: [{ id: 'hero-01' }] });
  });

  it('a dump taken after an observed body carrying account_id and player_name arrives contains no trace of either value, because the body never entered the ring to begin with', () => {
    const written: string[] = [];
    const frameRing = new FrameRing({
      maxFrames: 50,
      maxBytes: 500_000,
      dumpPath: 'unused-in-test.json',
      writePort: {
        write: (_destination, contents) => {
          written.push(contents);
        },
      },
    });
    const conn = new TlsConnections({ ring: frameRing });
    const combatFrame = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] })));
    const body = JSON.stringify({ account_id: 'acct-123', player_name: 'Lucas', gold: 500 });

    conn.push('combat', combatFrame);
    conn.push('http-body', buildHttpResponse(200, 'OK', body));
    frameRing.dumpToDisk('manual');

    const dumped = JSON.parse(required(written[0])) as { frameCount: number };
    expect(dumped.frameCount).toBe(1);
    expect(written[0]).not.toContain('acct-123');
    expect(written[0]).not.toContain('Lucas');
    expect(written[0]).not.toContain('account_id');
    expect(written[0]).not.toContain('player_name');
  });
});

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a defined value in test');
  return value;
}

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
    expect(conn.push('ws-conn', frame)).toEqual([tickEvent('hero-01')]);
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
    expect(conn.push('split', rest)).toEqual([tickEvent('hero-01')]);
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
    expect([...first, ...second][0]).toEqual(tickEvent('hero-01', { pad: 'x'.repeat(1800) }));
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

describe('TlsConnections: optional frame ring', () => {
  class FakeRing implements FrameRingPort {
    pushed: Buffer[] = [];
    dumpReasons: Array<'parse-failure' | 'manual'> = [];

    push(bytes: Uint8Array): void {
      this.pushed.push(Buffer.from(bytes));
    }

    dumpToDisk(reason: 'parse-failure' | 'manual'): void {
      this.dumpReasons.push(reason);
    }
  }

  it('pushes every decoded frame payload into the ring', () => {
    const ring = new FakeRing();
    const conn = new TlsConnections({ ring });
    const frame = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] })));

    conn.push('ringed', frame);

    expect(ring.pushed).toHaveLength(1);
    expect(JSON.parse(ring.pushed[0]?.toString('utf8') ?? '')).toEqual({ t: 'snap', heroes: [{ id: 'hero-01' }] });
  });

  it('dumps the ring to disk when a frame fails to parse', () => {
    const ring = new FakeRing();
    const conn = new TlsConnections({ ring });
    const validFrame = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [] })));

    conn.push('ringed', validFrame);
    conn.push('ringed', buildOversized64BitLengthFrame());

    expect(ring.dumpReasons).toEqual(['parse-failure']);
  });

  it('never touches the ring when none is configured', () => {
    const conn = new TlsConnections();
    expect(() => conn.push('unringed', buildOversized64BitLengthFrame())).not.toThrow();
  });
});

describe('toLiveTick: wire money is dropped unless it is a well-formed digit string', () => {
  const NOT_A_WELL_FORMED_DIGIT_STRING = [
    { label: 'exponential notation', value: '1e5' },
    { label: 'a leading plus sign', value: '+123' },
    { label: 'leading whitespace', value: ' 123' },
    { label: 'trailing whitespace', value: '123 ' },
    { label: 'hex notation', value: '0x10' },
    { label: 'the literal string Infinity', value: 'Infinity' },
    { label: 'an empty string', value: '' },
    { label: 'a non-numeric string', value: 'not-a-number' },
  ];

  it.each(NOT_A_WELL_FORMED_DIGIT_STRING)('drops tick.gold when the wire sends $label ($value)', ({ value }) => {
    const tick = toLiveTick({ [wireKey('gold')]: value });

    expect(tick.gold).toBeUndefined();
    expect('gold' in tick).toBe(false);
  });

  it('drops tick.gold when the wire sends a genuine number instead of a digit string', () => {
    const tick = toLiveTick({ [wireKey('gold')]: 123 });

    expect('gold' in tick).toBe(false);
  });

  it('keeps a well-formed digit string as a finite number, for control', () => {
    const tick = toLiveTick({ [wireKey('gold')]: '123' });

    expect(tick.gold).toBe(123);
  });

  it.each(NOT_A_WELL_FORMED_DIGIT_STRING)('drops loot[].gold when the wire sends $label ($value), never NaN', ({ value }) => {
    const raw = {
      [wireKey('lootList')]: [{ [wireKey('lootCell')]: 1, [wireKey('lootGold')]: value }],
    };

    const tick = toLiveTick(raw);

    expect(tick.loot).toHaveLength(1);
    expect(tick.loot?.[0]).toEqual({ cell: 1 });
  });
});

describe('toLiveTick: kinds/hps are absent, not empty arrays, when the wire omits them', () => {
  it('leaves both undefined when the wire carries neither token', () => {
    const tick = toLiveTick({});

    expect(tick.kinds).toBeUndefined();
    expect(tick.hps).toBeUndefined();
    expect('kinds' in tick).toBe(false);
    expect('hps' in tick).toBe(false);
  });

  it('decodes kinds alone and leaves hps undefined when only kinds arrives', () => {
    const tick = toLiveTick({ [wireKey('kindsList')]: [0, -1, 3] });

    expect(tick.kinds).toEqual([0, -1, 3]);
    expect(tick.hps).toBeUndefined();
    expect('hps' in tick).toBe(false);
  });

  it('decodes hps alone and leaves kinds undefined when only hps arrives', () => {
    const tick = toLiveTick({ [wireKey('hpsList')]: [10, -1, 20] });

    expect(tick.hps).toEqual([10, -1, 20]);
    expect(tick.kinds).toBeUndefined();
    expect('kinds' in tick).toBe(false);
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

describe('TlsConnections: application-level zlib-compressed combat frames', () => {
  it('decodes a binary frame carrying zlib-compressed snap JSON to the same tick as the plain-text equivalent', () => {
    const payload = Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-01' }] }));
    const textEvents = new TlsConnections().push('text', buildServerTextFrame(payload));
    const binaryEvents = new TlsConnections().push('binary', buildServerBinaryFrame(deflateSync(payload)));

    expect(binaryEvents).toEqual(textEvents);
    expect(binaryEvents).toEqual([tickEvent('hero-01')]);
  });

  it('still decodes a plain-text frame with verbatim JSON (the pre-compression path is unaffected)', () => {
    const conn = new TlsConnections();
    const frame = buildServerTextFrame(Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-09' }] })));

    expect(conn.push('plain', frame)).toEqual([tickEvent('hero-09')]);
  });

  it('does not treat a payload whose first byte is neither "{" nor the zlib header as a snap', () => {
    const conn = new TlsConnections();
    const handshake = buildHttpResponse(101, 'Switching Protocols', '');
    const frame = buildServerBinaryFrame(Buffer.from('not a recognised payload shape'));

    expect(conn.push('unrecognised', Buffer.concat([handshake, frame]))).toEqual([{ kind: 'upgrade' }]);
  });

  it('resyncs onto a compressed binary frame arriving mid-stream', () => {
    const conn = new TlsConnections();
    const payload = Buffer.from(JSON.stringify({ t: 'snap', heroes: [{ id: 'hero-05' }] }));
    const frame = buildServerBinaryFrame(deflateSync(payload));
    const bytes = Buffer.concat([Buffer.alloc(37, 0x00), frame]);

    expect(conn.push('resync-binary', bytes)).toEqual([tickEvent('hero-05')]);
  });

  it('fires the undecodable-payload diagnostic once, not per frame', () => {
    const warnings: Record<string, unknown>[] = [];
    const conn = new TlsConnections({ log: { warn: (record) => warnings.push(record) } });
    const handshake = buildHttpResponse(101, 'Switching Protocols', '');
    const badPayload = Buffer.from('not a recognised payload shape');
    const bad = buildServerBinaryFrame(badPayload);

    conn.push('undecodable', Buffer.concat([handshake, bad, bad, bad]));

    expect(warnings).toEqual([
      {
        scope: 'live-source',
        event: 'live-source.undecodable_payload',
        count: 1,
        firstByte: badPayload.readUInt8(0),
      },
    ]);
  });
});

/** The cage fields this exists to preserve are declared on the wire but not modelled by
 *  {@link toLiveTick}, so probing the decoded tick can never testify about them — the event has to
 *  carry the wire object itself. */
describe('TlsConnections: the tick event carries the wire object it was decoded from', () => {
  const WIRE_TICK = {
    [wireKey('messageType')]: wireKey('snapMessageType'),
    [wireKey('phase')]: 26,
    [wireKey('wave')]: 3,
    jaula_state: 2,
    jaula_secs: 118,
    jaula_teto: 4,
    jaula_ato: 1,
    seca_secs: 41,
  };

  function pushTick(payload: Record<string, unknown>): TapEvent[] {
    const conn = new TlsConnections();
    const frame = buildServerTextFrame(Buffer.from(JSON.stringify(payload), 'utf8'));
    return [...conn.push('main', frame)];
  }

  it('keeps every wire key the decoded tick does not model, cage fields included', () => {
    const [event] = pushTick(WIRE_TICK).filter(isTick);

    expect(event?.raw).toEqual(WIRE_TICK);
    for (const unmodelled of ['jaula_state', 'jaula_secs', 'jaula_teto', 'jaula_ato', 'seca_secs']) {
      expect(event?.raw).toHaveProperty(unmodelled);
      expect(event?.tick).not.toHaveProperty(unmodelled);
    }
  });

  it('carries the same object the tick was built from, not a separately parsed one', () => {
    const [event] = pushTick(WIRE_TICK).filter(isTick);

    expect(event?.tick.phase).toBe(event?.raw[wireKey('phase')]);
    expect(event?.tick.wave).toBe(event?.raw[wireKey('wave')]);
  });
});
