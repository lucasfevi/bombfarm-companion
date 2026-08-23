import type { LiveHit, LiveLootPop, LiveTick, LiveTickHero } from '@bombfarm/contracts';
import { DecodedFrame, FrameDecoder, OPCODE } from './ws-frame.js';

/**
 * Demultiplexes the plaintext byte stream a hook hands the app for every TLS read in the game
 * client. REST responses and the combat websocket arrive interleaved across many connections,
 * tagged only by an opaque {@link Ctx}, and the app almost always attaches after the websocket
 * handshake has long since scrolled off — so per connection this runs a `head` -> `ws` -> `ignore`
 * classifier that has to recover a frame boundary from raw mid-stream bytes, not just decode
 * frames it already knows the shape of. `findWsFrameStart` is the part that does that: cheap byte
 * checks narrow the candidate offsets, but only a JSON parse that lands on `t === 'snap'` is
 * accepted as proof, because a length-shaped false positive here would feed the panel garbage.
 */

export type Ctx = string | number;

export type TapEvent =
  | { readonly kind: 'http'; readonly status: number }
  | { readonly kind: 'upgrade' }
  | { readonly kind: 'tick'; readonly tick: LiveTick };

const HEAD_CAP_BYTES = 16 * 1024;
const GIVEUP_BYTES = 256 * 1024;
/** Rewalked on every call so a header split across a chunk boundary — the only way an offset
 *  already ruled out can start matching later — is still found, without resyncing from 0. */
const RESYNC_OVERLAP_BYTES = 8;
/** Well beyond any single REST round trip, so a connection this idle is done, not mid-transfer —
 *  the minimum safe bound against unbounded growth over a multi-hour session. A real close signal
 *  from the interceptor would replace this; nothing upstream carries one yet. */
const IDLE_SWEEP_TTL_MS = 5 * 60 * 1000;

interface WireHero {
  readonly id: string;
  readonly energy?: number;
  readonly x?: number;
  readonly y?: number;
}

interface WireLoot {
  readonly cell: number;
  readonly gold?: number;
}

interface WireHit {
  readonly cell: number;
  readonly amount: number;
  readonly critical?: boolean;
}

interface WireSnapMessage {
  readonly t: 'snap';
  readonly heroes?: readonly WireHero[];
  readonly phase?: number;
  readonly wave?: number;
  readonly gold?: number;
  readonly roomHp?: number;
  readonly idle?: boolean;
  readonly loot?: readonly WireLoot[];
  readonly hits?: readonly WireHit[];
  readonly bonusSeconds?: number;
  readonly bonusMultiplier?: number;
}

function isSnapMessage(value: unknown): value is WireSnapMessage {
  return typeof value === 'object' && value !== null && (value as { t?: unknown }).t === 'snap';
}

function mapHero(hero: WireHero): LiveTickHero {
  return {
    id: hero.id,
    ...(hero.energy !== undefined ? { energyFraction: hero.energy } : {}),
    ...(hero.x !== undefined ? { x: hero.x } : {}),
    ...(hero.y !== undefined ? { y: hero.y } : {}),
  };
}

function mapLoot(loot: WireLoot): LiveLootPop {
  return {
    cell: loot.cell,
    ...(loot.gold !== undefined ? { gold: loot.gold } : {}),
  };
}

function mapHit(hit: WireHit): LiveHit {
  return {
    cell: hit.cell,
    amount: hit.amount,
    ...(hit.critical !== undefined ? { critical: hit.critical } : {}),
  };
}

function toLiveTick(msg: WireSnapMessage): LiveTick {
  return {
    heroes: (msg.heroes ?? []).map(mapHero),
    ...(msg.phase !== undefined ? { phase: msg.phase } : {}),
    ...(msg.wave !== undefined ? { wave: msg.wave } : {}),
    ...(msg.gold !== undefined ? { gold: msg.gold } : {}),
    ...(msg.roomHp !== undefined ? { roomHp: msg.roomHp } : {}),
    ...(msg.idle !== undefined ? { idle: msg.idle } : {}),
    ...(msg.loot !== undefined ? { loot: msg.loot.map(mapLoot) } : {}),
    ...(msg.hits !== undefined ? { hits: msg.hits.map(mapHit) } : {}),
    ...(msg.bonusSeconds !== undefined ? { bonusSeconds: msg.bonusSeconds } : {}),
    ...(msg.bonusMultiplier !== undefined ? { bonusMultiplier: msg.bonusMultiplier } : {}),
  };
}

interface ResyncCandidate {
  readonly headerLength: number;
  readonly payloadLength: number;
}

function parseResyncCandidate(buf: Buffer, offset: number): ResyncCandidate | undefined {
  if (buf.length < offset + 2) return undefined;
  if (buf.readUInt8(offset) !== 0x81) return undefined;

  const byte1 = buf.readUInt8(offset + 1);
  if ((byte1 & 0x80) !== 0) return undefined;

  const lenField = byte1 & 0x7f;
  if (lenField <= 125) return { headerLength: 2, payloadLength: lenField };
  if (lenField !== 126) return undefined;

  if (buf.length < offset + 4) return undefined;
  return { headerLength: 4, payloadLength: buf.readUInt16BE(offset + 2) };
}

function looksLikeSnapMessage(payload: Buffer): boolean {
  try {
    return isSnapMessage(JSON.parse(payload.toString('utf8')));
  } catch {
    return false;
  }
}

interface WsFrameScanResult {
  /** The confirmed frame start, when one was found. */
  readonly offset?: number;
  /** The earliest offset whose header parsed but whose payload has not fully arrived yet — a
   *  provisional rejection that more bytes could still resolve, as opposed to every other offset
   *  ruled out for good. `undefined` when nothing in the scanned range was merely incomplete. */
  readonly incompleteAt?: number;
}

function scanForWsFrameStart(buf: Buffer, fromOffset: number): WsFrameScanResult {
  let incompleteAt: number | undefined;
  for (let offset = fromOffset; offset + 2 <= buf.length; offset += 1) {
    const candidate = parseResyncCandidate(buf, offset);
    if (!candidate) continue;

    const frameEnd = offset + candidate.headerLength + candidate.payloadLength;
    if (frameEnd > buf.length) {
      if (incompleteAt === undefined) incompleteAt = offset;
      continue;
    }

    const payload = buf.subarray(offset + candidate.headerLength, frameEnd);
    if (looksLikeSnapMessage(payload)) return { offset };
  }
  return incompleteAt === undefined ? {} : { incompleteAt };
}

export function findWsFrameStart(buf: Buffer, fromOffset = 0): number | undefined {
  return scanForWsFrameStart(buf, fromOffset).offset;
}

interface HttpMatch {
  readonly status: number;
  readonly totalLength: number;
}

function matchHttpResponse(buf: Buffer): HttpMatch | undefined {
  const head = buf.subarray(0, Math.min(buf.length, HEAD_CAP_BYTES));
  const headerEnd = head.indexOf('\r\n\r\n');
  if (headerEnd === -1) return undefined;

  const headerText = head.subarray(0, headerEnd).toString('latin1');
  const statusMatch = /^HTTP\/1\.[01] (\d{3})/.exec(headerText);
  const statusText = statusMatch?.[1];
  if (statusText === undefined) return undefined;

  const lengthMatch = /\r\ncontent-length:\s*(\d+)/i.exec(headerText);
  const bodyLength = lengthMatch?.[1] !== undefined ? Number(lengthMatch[1]) : 0;
  const totalLength = headerEnd + 4 + bodyLength;
  if (buf.length < totalLength) return undefined;

  return { status: Number(statusText), totalLength };
}

interface HeadState {
  readonly kind: 'head';
  readonly buf: Buffer;
  /** How much of `buf` earlier calls already walked with `findWsFrameStart` — the next call
   *  resumes from here (minus a small overlap) instead of rescanning from offset 0. */
  readonly scannedUpTo: number;
}

const INITIAL_HEAD_STATE: HeadState = { kind: 'head', buf: Buffer.alloc(0), scannedUpTo: 0 };

interface WsState {
  readonly kind: 'ws';
  readonly decoder: FrameDecoder;
}

interface IgnoreState {
  readonly kind: 'ignore';
}

type ConnState = HeadState | WsState | IgnoreState;

export interface TlsConnectionsDeps {
  readonly now?: () => number;
  readonly idleSweepTtlMs?: number;
}

export class TlsConnections {
  #connections = new Map<Ctx, ConnState>();
  #lastTouchedAt = new Map<Ctx, number>();
  readonly #now: () => number;
  readonly #idleSweepTtlMs: number;

  constructor(deps: TlsConnectionsDeps = {}) {
    this.#now = deps.now ?? Date.now;
    this.#idleSweepTtlMs = deps.idleSweepTtlMs ?? IDLE_SWEEP_TTL_MS;
  }

  get size(): number {
    return this.#connections.size;
  }

  push(ctx: Ctx, bytes: Uint8Array): TapEvent[] {
    const now = this.#now();
    this.#sweepIdle(now);

    const events: TapEvent[] = [];
    const state = this.#connections.get(ctx) ?? INITIAL_HEAD_STATE;
    this.#connections.set(ctx, this.#advance(state, Buffer.from(bytes), events));
    this.#lastTouchedAt.set(ctx, now);
    return events;
  }

  forget(ctx: Ctx): void {
    this.#connections.delete(ctx);
    this.#lastTouchedAt.delete(ctx);
  }

  reset(): void {
    this.#connections.clear();
    this.#lastTouchedAt.clear();
  }

  /** Never sweeps a `ws` connection — that is the winner's live stream, or still could be, and
   *  must survive on nothing but the staleness watch above this class. Only `head`/`ignore`
   *  connections, the shape a finished or abandoned REST call settles into, are eligible. */
  #sweepIdle(now: number): void {
    for (const [ctx, state] of this.#connections) {
      if (state.kind === 'ws') continue;
      const lastTouchedAt = this.#lastTouchedAt.get(ctx) ?? now;
      if (now - lastTouchedAt > this.#idleSweepTtlMs) {
        this.#connections.delete(ctx);
        this.#lastTouchedAt.delete(ctx);
      }
    }
  }

  #advance(state: ConnState, bytes: Buffer, events: TapEvent[]): ConnState {
    if (state.kind === 'ignore') return state;
    if (state.kind === 'ws') return this.#advanceWs(state, bytes, events);
    return this.#advanceHead(state, bytes, events);
  }

  #advanceHead(state: HeadState, bytes: Buffer, events: TapEvent[]): ConnState {
    const buf = Buffer.concat([state.buf, bytes]);

    const httpMatch = matchHttpResponse(buf);
    if (httpMatch) {
      const rest = buf.subarray(httpMatch.totalLength);
      if (httpMatch.status === 101) {
        events.push({ kind: 'upgrade' });
        return this.#enterWs(rest, events);
      }
      events.push({ kind: 'http', status: httpMatch.status });
      return this.#advanceHead(INITIAL_HEAD_STATE, rest, events);
    }

    const scanFrom = Math.max(0, state.scannedUpTo - RESYNC_OVERLAP_BYTES);
    const scanResult = scanForWsFrameStart(buf, scanFrom);
    if (scanResult.offset !== undefined) return this.#enterWs(buf.subarray(scanResult.offset), events);

    if (buf.length >= GIVEUP_BYTES) return { kind: 'ignore' };
    return { kind: 'head', buf, scannedUpTo: scanResult.incompleteAt ?? buf.length };
  }

  #enterWs(bytes: Buffer, events: TapEvent[]): ConnState {
    return this.#advanceWs({ kind: 'ws', decoder: new FrameDecoder() }, bytes, events);
  }

  #advanceWs(state: WsState, bytes: Buffer, events: TapEvent[]): ConnState {
    try {
      for (const frame of state.decoder.push(bytes)) this.#handleFrame(frame, events);
      return state;
    } catch {
      // A frame the decoder cannot parse (the 64-bit length form is the one case ws-frame.ts
      // itself throws on) leaves the decoder's internal buffer in a state this class has no way
      // to inspect or rewind, so whatever this decoder had already buffered is unrecoverable.
      // Dropping to a fresh head-state resync is the only way back onto a real frame boundary.
      return INITIAL_HEAD_STATE;
    }
  }

  #handleFrame(frame: DecodedFrame, events: TapEvent[]): void {
    if (frame.opcode !== OPCODE.text) return;
    let json: unknown;
    try {
      json = JSON.parse(frame.payload.toString('utf8'));
    } catch {
      return;
    }
    if (isSnapMessage(json)) events.push({ kind: 'tick', tick: toLiveTick(json) });
  }
}
