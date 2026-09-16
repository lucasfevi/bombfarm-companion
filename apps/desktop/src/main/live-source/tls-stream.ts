import type { LiveHit, LiveLootPop, LiveTick, LiveTickHero } from '@bombfarm/contracts';
import { isPlainObject, liveFrameWireKey as wireKey } from '@bombfarm/game-api';
import { brotliDecompressSync, gunzipSync, inflateRawSync, inflateSync } from 'node:zlib';
import type { FrameDumpReason } from './frame-ring.js';
import { DecodedFrame, FrameDecodeError, FrameDecoder, OPCODE } from './ws-frame.js';

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
  | { readonly kind: 'http'; readonly status: number; readonly body?: Buffer }
  | { readonly kind: 'upgrade' }
  /** `raw` is the wire object the tick was decoded from, carried alongside it because
   *  {@link toLiveTick} reads a fixed key list and everything outside it — the cage fields among
   *  them — would otherwise be gone before any consumer sees it. It is the already-narrowed
   *  object, assigned rather than cloned, and it never crosses IPC. */
  | { readonly kind: 'tick'; readonly tick: LiveTick; readonly raw: Record<string, unknown> };

const HEAD_CAP_BYTES = 16 * 1024;
/** Also the cap on a single HTTP response body's reassembly. 8 MiB: the largest body the app has
 *  to finish is a PVP film — ~2 MB of frames as JSON (2026-09-16), which arrives chunked and
 *  compressed, so the wire form is smaller and the cap has to hold the wire form, not the
 *  inflated one. It used to be 256 KiB against an ~85 KB largest body (2026-08-25), and a film
 *  hit it silently. A declared length that never finishes arriving is still bounded — the same
 *  connection just gives up here, same as it already does for any other unrecognisable byte run,
 *  and the idle sweep releases what it buffered. */
const GIVEUP_BYTES = 8 * 1024 * 1024;
/** Rewalked on every call so a header split across a chunk boundary — the only way an offset
 *  already ruled out can start matching later — is still found, without resyncing from 0. */
const RESYNC_OVERLAP_BYTES = 8;
/** Well beyond any single REST round trip, so a connection this idle is done, not mid-transfer —
 *  the minimum safe bound against unbounded growth over a multi-hour session. A real close signal
 *  from the interceptor would replace this; nothing upstream carries one yet. */
const IDLE_SWEEP_TTL_MS = 5 * 60 * 1000;

/**
 * Every field below is read out of the raw parsed JSON with {@link wireKey}, never with a typed
 * interface's dotted field name — `packages/game-api/src/live-frame/lexicon.ts` names the
 * abbreviated wire key each of these actually is (`heroes[].e`, `hits[].d`, `loot[].g`, and so
 * on), and a `WireHero`/`WireHit`-style interface typed with those literal wire names would just
 * re-embed the same abbreviations this module exists to translate out of.
 */

function isSnapMessage(value: unknown): value is Record<string, unknown> {
  return isPlainObject(value) && value[wireKey('messageType')] === wireKey('snapMessageType');
}

type PayloadDecodeOutcome =
  | { readonly kind: 'decoded'; readonly json: unknown }
  | { readonly kind: 'unparseable' }
  | { readonly kind: 'undecodable'; readonly firstByte: number };

/**
 * The server's own combat-frame compression is application-level, not RFC 7692
 * permessage-deflate: RSV1 is never set and every payload still carries a full zlib header
 * (`78 ..`), so decoding it is a plain header-aware zlib inflate, not the raw/headerless inflate
 * permessage-deflate would need, and there is nothing to negotiate in the handshake either way.
 *
 * Each payload is its own independent zlib stream — the server keeps no compression context
 * across frames — so this never carries state between calls, and a skipped or malformed frame
 * costs nothing to the ones that follow.
 */
function decodeSnapPayload(payload: Buffer): PayloadDecodeOutcome {
  const firstByte = payload.length > 0 ? payload.readUInt8(0) : undefined;

  if (firstByte === 0x7b) {
    try {
      return { kind: 'decoded', json: JSON.parse(payload.toString('utf8')) };
    } catch {
      return { kind: 'unparseable' };
    }
  }

  if (firstByte === 0x78) {
    let inflated: Buffer;
    try {
      inflated = inflateSync(payload);
    } catch {
      return { kind: 'undecodable', firstByte };
    }
    try {
      return { kind: 'decoded', json: JSON.parse(inflated.toString('utf8')) };
    } catch {
      return { kind: 'unparseable' };
    }
  }

  return { kind: 'undecodable', firstByte: firstByte ?? 0 };
}

function readNumber(raw: Record<string, unknown>, key: string): number | undefined {
  const value = raw[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readBoolean(raw: Record<string, unknown>, key: string): boolean | undefined {
  const value = raw[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readString(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Gold arrives on the wire as a digit string (observed `"9724194"`…`"10294318"` for the account
 * total, `"1580"`…`"6636"` for a single loot payout), not a number — `LiveTick.gold` and
 * `LiveLootPop.gold` are both typed `number`, so a value that is not a well-formed digit string is
 * dropped here rather than reaching either as `NaN`.
 */
function readWireMoney(raw: Record<string, unknown>, key: string): number | undefined {
  const value = raw[key];
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readArray(raw: Record<string, unknown>, key: string): readonly unknown[] {
  const value = raw[key];
  return Array.isArray(value) ? value : [];
}

/** `undefined` when the wire omitted the array entirely, so a tick with no loot/hits this tick is
 *  told apart from one where the field was simply absent — matching the optional `readonly … []`
 *  contract fields these feed. */
function readOptionalArray(raw: Record<string, unknown>, key: string): readonly unknown[] | undefined {
  const value = raw[key];
  return Array.isArray(value) ? value : undefined;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function mapHero(raw: unknown): LiveTickHero | undefined {
  if (!isPlainObject(raw)) return undefined;
  const id = readString(raw, wireKey('heroId'));
  if (id === undefined) return undefined;

  const energyFraction = readNumber(raw, wireKey('heroEnergyFraction'));
  const x = readNumber(raw, wireKey('heroX'));
  const y = readNumber(raw, wireKey('heroY'));

  return {
    id,
    ...(energyFraction !== undefined ? { energyFraction } : {}),
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
  };
}

function mapLoot(raw: unknown): LiveLootPop | undefined {
  if (!isPlainObject(raw)) return undefined;
  const cell = readNumber(raw, wireKey('lootCell'));
  if (cell === undefined) return undefined;

  const gold = readWireMoney(raw, wireKey('lootGold'));
  return { cell, ...(gold !== undefined ? { gold } : {}) };
}

function mapHit(raw: unknown): LiveHit | undefined {
  if (!isPlainObject(raw)) return undefined;
  const cell = readNumber(raw, wireKey('hitCell'));
  const damage = readNumber(raw, wireKey('hitDamage'));
  if (cell === undefined || damage === undefined) return undefined;

  const critical = readBoolean(raw, wireKey('hitCritical'));
  return { cell, damage, ...(critical !== undefined ? { critical } : {}) };
}

export function toLiveTick(raw: Record<string, unknown>): LiveTick {
  const phase = readNumber(raw, wireKey('phase'));
  const wave = readNumber(raw, wireKey('wave'));
  const gold = readWireMoney(raw, wireKey('gold'));
  const roomHp = readNumber(raw, wireKey('roomHp'));
  const idle = readBoolean(raw, wireKey('idle'));
  const lootRaw = readOptionalArray(raw, wireKey('lootList'));
  const hitsRaw = readOptionalArray(raw, wireKey('hitsList'));
  const bonusSeconds = readNumber(raw, wireKey('bonusSeconds'));
  const bonusMultiplier = readNumber(raw, wireKey('bonusMultiplier'));
  const kindsRaw = readOptionalArray(raw, wireKey('kindsList'));
  const hpsRaw = readOptionalArray(raw, wireKey('hpsList'));

  return {
    heroes: readArray(raw, wireKey('heroesList')).map(mapHero).filter(isDefined),
    ...(phase !== undefined ? { phase } : {}),
    ...(wave !== undefined ? { wave } : {}),
    ...(gold !== undefined ? { gold } : {}),
    ...(roomHp !== undefined ? { roomHp } : {}),
    ...(idle !== undefined ? { idle } : {}),
    ...(lootRaw !== undefined ? { loot: lootRaw.map(mapLoot).filter(isDefined) } : {}),
    ...(hitsRaw !== undefined ? { hits: hitsRaw.map(mapHit).filter(isDefined) } : {}),
    ...(bonusSeconds !== undefined ? { bonusSeconds } : {}),
    ...(bonusMultiplier !== undefined ? { bonusMultiplier } : {}),
    ...(kindsRaw !== undefined ? { kinds: kindsRaw.filter((value): value is number => typeof value === 'number') } : {}),
    ...(hpsRaw !== undefined ? { hps: hpsRaw.filter((value): value is number => typeof value === 'number') } : {}),
  };
}

interface ResyncCandidate {
  readonly headerLength: number;
  readonly payloadLength: number;
}

function parseResyncCandidate(buf: Buffer, offset: number): ResyncCandidate | undefined {
  if (buf.length < offset + 2) return undefined;
  const opcodeByte = buf.readUInt8(offset);
  if (opcodeByte !== 0x81 && opcodeByte !== 0x82) return undefined;

  const byte1 = buf.readUInt8(offset + 1);
  if ((byte1 & 0x80) !== 0) return undefined;

  const lenField = byte1 & 0x7f;
  if (lenField <= 125) return { headerLength: 2, payloadLength: lenField };
  if (lenField !== 126) return undefined;

  if (buf.length < offset + 4) return undefined;
  return { headerLength: 4, payloadLength: buf.readUInt16BE(offset + 2) };
}

function looksLikeSnapMessage(payload: Buffer): boolean {
  const outcome = decodeSnapPayload(payload);
  return outcome.kind === 'decoded' && isSnapMessage(outcome.json);
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

/** Why a response body, though fully buffered, was left unread rather than guessed at — the
 *  two shapes {@link matchHttpResponse} cannot safely turn into a `Buffer`: no usable
 *  `Content-Length` and no chunked framing (nothing says where the body ends), and a declared
 *  `Content-Encoding` this app cannot inflate — an encoding it does not know, or bytes the
 *  declared one refuses. Chunked framing and gzip/deflate/br are read, not skipped: the PVP duel
 *  result and film both arrive that way (2026-09-16), and skipping them was an empty PVP tab. */
export type HttpBodySkipReason = 'compressed' | 'no_length';

interface HttpMatch {
  readonly status: number;
  readonly totalLength: number;
  readonly body?: Buffer;
  readonly bodySkipReason?: HttpBodySkipReason;
}

/** `undefined` when the response is not complete yet; `null` when the framing is broken. */
type ChunkedBody = { readonly body: Buffer; readonly totalLength: number } | null | undefined;

/**
 * Reassembles `Transfer-Encoding: chunked`: `<hex size>[;ext]\r\n<data>\r\n` repeated, then a
 * zero-size chunk, then optional trailers, then a blank line. Returns `undefined` while any chunk
 * is still arriving so the caller keeps buffering rather than scanning the half-body for frames.
 */
function readChunkedBody(buf: Buffer, from: number): ChunkedBody {
  const parts: Buffer[] = [];
  let offset = from;
  for (;;) {
    const lineEnd = buf.indexOf('\r\n', offset);
    if (lineEnd === -1) return undefined;
    const sizeText = buf.subarray(offset, lineEnd).toString('latin1').split(';')[0]?.trim() ?? '';
    if (!/^[0-9a-f]+$/i.test(sizeText)) return null;
    const size = Number.parseInt(sizeText, 16);
    if (size === 0) {
      const trailersEnd = buf.indexOf('\r\n\r\n', lineEnd);
      if (trailersEnd === -1) return undefined;
      return { body: Buffer.concat(parts), totalLength: trailersEnd + 4 };
    }
    const dataStart = lineEnd + 2;
    const dataEnd = dataStart + size;
    if (buf.length < dataEnd + 2) return undefined;
    if (buf[dataEnd] !== 0x0d || buf[dataEnd + 1] !== 0x0a) return null;
    parts.push(buf.subarray(dataStart, dataEnd));
    offset = dataEnd + 2;
  }
}

/** `undefined` for an encoding this app does not know, or a body the declared one refuses. */
function decodeBody(body: Buffer, encoding: string): Buffer | undefined {
  try {
    switch (encoding) {
      case 'identity':
        return body;
      case 'gzip':
      case 'x-gzip':
        return gunzipSync(body);
      case 'deflate':
        // The zlib-wrapped form is the standard one; a raw deflate stream is what some servers
        // actually send under the same name, and it fails the first attempt with a header error.
        try {
          return inflateSync(body);
        } catch {
          return inflateRawSync(body);
        }
      case 'br':
        return brotliDecompressSync(body);
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

function matchHttpResponse(buf: Buffer): HttpMatch | undefined {
  const head = buf.subarray(0, Math.min(buf.length, HEAD_CAP_BYTES));
  const headerEnd = head.indexOf('\r\n\r\n');
  if (headerEnd === -1) return undefined;

  const headerText = head.subarray(0, headerEnd).toString('latin1');
  const statusMatch = /^HTTP\/1\.[01] (\d{3})/.exec(headerText);
  const statusText = statusMatch?.[1];
  if (statusText === undefined) return undefined;
  const status = Number(statusText);
  const bodyStart = headerEnd + 4;

  // A protocol upgrade handshake carries no body to identify — #advanceHead branches on this
  // status before ever looking at `body`/`bodySkipReason`, so nothing downstream needs either.
  if (status === 101) return { status, totalLength: bodyStart };

  const chunked = /\r\ntransfer-encoding:\s*chunked/i.test(headerText);
  const lengthMatch = /\r\ncontent-length:\s*(\d+)/i.exec(headerText);
  let wireBody: Buffer;
  let totalLength: number;
  if (chunked) {
    const reassembled = readChunkedBody(buf, bodyStart);
    if (reassembled === undefined) return undefined;
    // Broken framing: hand the head back as a bodiless response so the connection moves on,
    // the way an undeclared length already does, rather than buffering until the cap.
    if (reassembled === null) return { status, totalLength: bodyStart, bodySkipReason: 'no_length' };
    ({ body: wireBody, totalLength } = reassembled);
  } else if (lengthMatch?.[1] !== undefined) {
    totalLength = bodyStart + Number(lengthMatch[1]);
    if (buf.length < totalLength) return undefined;
    wireBody = buf.subarray(bodyStart, totalLength);
  } else {
    return { status, totalLength: bodyStart, bodySkipReason: 'no_length' };
  }

  if (wireBody.length === 0) return { status, totalLength };
  const encodingMatch = /\r\ncontent-encoding:\s*([\w-]+)/i.exec(headerText);
  const body = decodeBody(wireBody, (encodingMatch?.[1] ?? 'identity').toLowerCase());
  if (body === undefined) return { status, totalLength, bodySkipReason: 'compressed' };
  return { status, totalLength, body };
}

/** Whether `buf` opens with a complete HTTP response header — the case where a still-incomplete
 *  body must be waited for rather than scanned for a frame start: a compressed body is arbitrary
 *  bytes, and a scan across half of one can find a length-shaped false positive. */
function startsWithHttpHead(buf: Buffer): boolean {
  if (!buf.subarray(0, 5).equals(Buffer.from('HTTP/', 'latin1'))) return false;
  return buf.subarray(0, Math.min(buf.length, HEAD_CAP_BYTES)).indexOf('\r\n\r\n') !== -1;
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

interface AdvanceStep {
  readonly state: ConnState;
  /** Bytes this step could not finish with — the loop in `#advance` re-enters `state` with them,
   *  so a read carrying many HTTP responses or many malformed frames costs iterations, not stack. */
  readonly rest?: Buffer;
}

export interface FrameRingPort {
  push(bytes: Uint8Array): void;
  dumpToDisk(reason: FrameDumpReason): void;
}

/** Just enough of the boundary log to report a body-reassembly skip once — the boundary log's own
 *  dedup collapses repeats, so this class never needs to suppress anything itself. */
export interface TlsConnectionsLogPort {
  warn(record: Record<string, unknown>): void;
}

export interface TlsConnectionsDeps {
  readonly now?: () => number;
  readonly idleSweepTtlMs?: number;
  /** Fed every decoded websocket frame payload as it arrives, so a later parse failure can be
   *  dumped with the bytes that led into it. An HTTP response body never goes through this ring —
   *  a single ~85 KB account body would otherwise evict the whole 500 KB/50-frame budget's worth
   *  of the combat frames this ring exists to preserve. Optional so every existing construction
   *  site and test is unaffected. */
  readonly ring?: FrameRingPort;
  /** Optional so every existing construction site and test is unaffected. */
  readonly log?: TlsConnectionsLogPort;
}

export class TlsConnections {
  #connections = new Map<Ctx, ConnState>();
  #lastTouchedAt = new Map<Ctx, number>();
  readonly #now: () => number;
  readonly #idleSweepTtlMs: number;
  readonly #ring: FrameRingPort | undefined;
  readonly #log: TlsConnectionsLogPort | undefined;
  #undecodablePayloadCount = 0;
  #hasWarnedUndecodablePayload = false;

  constructor(deps: TlsConnectionsDeps = {}) {
    this.#now = deps.now ?? Date.now;
    this.#idleSweepTtlMs = deps.idleSweepTtlMs ?? IDLE_SWEEP_TTL_MS;
    this.#ring = deps.ring;
    this.#log = deps.log;
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

  /** Terminates: every step below that returns `rest` strictly shrinks it. An HTTP step consumes
   *  at least the response header. A frame-decode-error step's remainder starts at the malformed
   *  frame, and the head scan that follows can't re-enter `ws` there — `parseHeader` throws only
   *  on the 64-bit length form, which `parseResyncCandidate` rejects outright — so it must find a
   *  later offset or find nothing and stop. */
  #advance(state: ConnState, bytes: Buffer, events: TapEvent[]): ConnState {
    let step: AdvanceStep = { state, rest: bytes };
    while (step.rest !== undefined) {
      const { state: current, rest } = step;
      if (current.kind === 'ignore') return current;
      step = current.kind === 'ws' ? this.#advanceWs(current, rest, events) : this.#advanceHead(current, rest, events);
    }
    return step.state;
  }

  #advanceHead(state: HeadState, bytes: Buffer, events: TapEvent[]): AdvanceStep {
    const buf = Buffer.concat([state.buf, bytes]);

    const httpMatch = matchHttpResponse(buf);
    if (httpMatch) {
      const rest = buf.subarray(httpMatch.totalLength);
      if (httpMatch.status === 101) {
        events.push({ kind: 'upgrade' });
        return { state: { kind: 'ws', decoder: new FrameDecoder() }, rest };
      }
      if (httpMatch.body !== undefined) {
        events.push({ kind: 'http', status: httpMatch.status, body: httpMatch.body });
      } else {
        if (httpMatch.bodySkipReason) {
          this.#log?.warn({
            scope: 'live-source',
            event: 'live-source.http_body_skipped',
            reason: httpMatch.bodySkipReason,
            status: httpMatch.status,
          });
        }
        events.push({ kind: 'http', status: httpMatch.status });
      }
      return { state: INITIAL_HEAD_STATE, rest };
    }

    if (startsWithHttpHead(buf)) {
      if (buf.length >= GIVEUP_BYTES) return { state: { kind: 'ignore' } };
      return { state: { kind: 'head', buf, scannedUpTo: state.scannedUpTo } };
    }

    const scanFrom = Math.max(0, state.scannedUpTo - RESYNC_OVERLAP_BYTES);
    const scanResult = scanForWsFrameStart(buf, scanFrom);
    if (scanResult.offset !== undefined) {
      return { state: { kind: 'ws', decoder: new FrameDecoder() }, rest: buf.subarray(scanResult.offset) };
    }

    if (buf.length >= GIVEUP_BYTES) return { state: { kind: 'ignore' } };
    return { state: { kind: 'head', buf, scannedUpTo: scanResult.incompleteAt ?? buf.length } };
  }

  #advanceWs(state: WsState, bytes: Buffer, events: TapEvent[]): AdvanceStep {
    try {
      for (const frame of state.decoder.push(bytes)) this.#handleFrame(frame, events);
      return { state };
    } catch (error) {
      if (error instanceof FrameDecodeError) {
        for (const frame of error.decoded) this.#handleFrame(frame, events);
        this.#ring?.dumpToDisk('parse-failure');
        return { state: INITIAL_HEAD_STATE, rest: error.remainder };
      }
      this.#ring?.dumpToDisk('parse-failure');
      return { state: INITIAL_HEAD_STATE };
    }
  }

  #handleFrame(frame: DecodedFrame, events: TapEvent[]): void {
    this.#ring?.push(frame.payload);
    if (frame.opcode !== OPCODE.text && frame.opcode !== OPCODE.binary) return;

    const outcome = decodeSnapPayload(frame.payload);
    if (outcome.kind === 'undecodable') {
      this.#reportUndecodablePayload(outcome.firstByte);
      return;
    }
    if (outcome.kind === 'unparseable') return;
    if (isSnapMessage(outcome.json)) {
      events.push({ kind: 'tick', tick: toLiveTick(outcome.json), raw: outcome.json });
    }
  }

  #reportUndecodablePayload(firstByte: number): void {
    this.#undecodablePayloadCount += 1;
    if (this.#hasWarnedUndecodablePayload) return;
    this.#hasWarnedUndecodablePayload = true;
    this.#log?.warn({
      scope: 'live-source',
      event: 'live-source.undecodable_payload',
      count: this.#undecodablePayloadCount,
      firstByte,
    });
  }
}
