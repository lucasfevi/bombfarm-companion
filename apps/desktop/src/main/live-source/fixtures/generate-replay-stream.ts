import type { LiveTick } from '@bombfarm/contracts';
import { liveFrameWireKey as wireKey } from '@bombfarm/game-api';
import { toLiveTick } from '../tls-stream.js';

/**
 * Synthesises the byte stream `tls-stream.ts` is decoding: an HTTP response, an idle run, a
 * combat run (with a hero leaving the field partway through), a frame the decoder cannot parse,
 * and a truncated tail — all deterministic from a seed, so the committed fixture this produces
 * can be regenerated and byte-compared rather than trusted blind.
 *
 * Every wire key below comes from the live-frame lexicon, the same way `tls-stream.ts` itself
 * reads them, and the expected {@link LiveTick} for each frame is computed by calling
 * `toLiveTick` on the constructed wire JSON rather than hand-building a second, parallel
 * translation — the previous version of this file hand-built both sides using the wrong wire
 * keys, and its own decoder test suite never caught it because generator and decoder agreed with
 * each other while both disagreed with the game.
 */

const DEFAULT_SEED = 20260822;

const HERO_IDS = ['hero-01', 'hero-02', 'hero-03', 'hero-04', 'hero-05', 'hero-06'] as const;
const AURA_CARRIER_ID = 'hero-06';

const IDLE_FRAME_COUNT = 6;
const COMBAT_BLOCK_A_COUNT = 20;
const AURA_CARRIER_LEAVES_AT_INDEX = 10;
const COMBAT_BLOCK_B_COUNT = 8;

export interface ReplayFrame {
  readonly offset: number;
  readonly endOffset: number;
  readonly tick: LiveTick;
}

export interface ReplayStream {
  readonly bytes: Buffer;
  readonly httpResponse: { readonly offset: number; readonly endOffset: number; readonly status: number };
  readonly frames: readonly ReplayFrame[];
  readonly malformedFrame: { readonly offset: number; readonly endOffset: number };
  readonly truncatedTail: { readonly offset: number };
  readonly auraCarrierId: string;
  readonly auraCarrierLeavesAtFrameIndex: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildServerTextFrame(payload: Buffer): Buffer {
  if (payload.length > 0xffff) {
    throw new Error('generate-replay-stream: payload too large for the 16-bit length form');
  }
  const lengthBytes =
    payload.length <= 125
      ? Buffer.from([payload.length])
      : (() => {
          const buf = Buffer.alloc(3);
          buf.writeUInt8(126, 0);
          buf.writeUInt16BE(payload.length, 1);
          return buf;
        })();
  return Buffer.concat([Buffer.from([0x81]), lengthBytes, payload]);
}

export function buildServerBinaryFrame(payload: Buffer): Buffer {
  if (payload.length > 0xffff) {
    throw new Error('generate-replay-stream: payload too large for the 16-bit length form');
  }
  const lengthBytes =
    payload.length <= 125
      ? Buffer.from([payload.length])
      : (() => {
          const buf = Buffer.alloc(3);
          buf.writeUInt8(126, 0);
          buf.writeUInt16BE(payload.length, 1);
          return buf;
        })();
  return Buffer.concat([Buffer.from([0x82]), lengthBytes, payload]);
}

export function buildOversized64BitLengthFrame(): Buffer {
  const header = Buffer.alloc(10);
  header.writeUInt8(0x81, 0);
  header.writeUInt8(127, 1);
  header.writeUInt32BE(0xffffffff, 2);
  header.writeUInt32BE(0xffffffff, 6);
  return header;
}

export function buildHttpResponse(status: number, statusText: string, body: string): Buffer {
  const bodyBuf = Buffer.from(body, 'utf8');
  const head =
    `HTTP/1.1 ${String(status)} ${statusText}\r\n` +
    `Content-Type: application/json\r\n` +
    `Content-Length: ${String(bodyBuf.length)}\r\n` +
    `\r\n`;
  return Buffer.concat([Buffer.from(head, 'latin1'), bodyBuf]);
}

function buildSnapPayload(
  rand: () => number,
  heroIds: readonly string[],
  idle: boolean,
  index: number,
): { readonly json: unknown; readonly tick: LiveTick } {
  const heroes = heroIds.map((id) => ({
    [wireKey('heroId')]: id,
    [wireKey('heroEnergyFraction')]: Number((0.4 + rand() * 0.6).toFixed(4)),
    [wireKey('heroX')]: Number((rand() * 800).toFixed(2)),
    [wireKey('heroY')]: Number((rand() * 450).toFixed(2)),
  }));

  const hits = idle
    ? undefined
    : Array.from({ length: 30 + Math.floor(rand() * 15) }, () => ({
        [wireKey('hitCell')]: Math.floor(rand() * 64),
        [wireKey('hitDamage')]: Math.floor(200 + rand() * 4000),
        [wireKey('hitCritical')]: rand() < 0.25,
      }));

  const loot =
    !idle && index % 5 === 0
      ? Array.from({ length: 1 + Math.floor(rand() * 3) }, () => ({
          [wireKey('lootCell')]: Math.floor(rand() * 64),
          [wireKey('lootGold')]: String(Math.floor(20 + rand() * 400)),
        }))
      : undefined;

  const includeBonus = !idle && index % 7 === 0;
  // The wire's own `room_hp` is a 0-255 scale, not the [0, 1] fraction this fixture used to
  // synthesise — see packages/game-api/src/live-frame/lexicon.ts.
  const roomHp = Math.max(0, Math.round(idle ? 255 : 255 - index * 2.55));
  const wave = idle ? 0 : 1 + Math.floor(index / 3);
  const gold = 100000 + index * 137;

  const json: Record<string, unknown> = {
    [wireKey('messageType')]: wireKey('snapMessageType'),
    [wireKey('heroesList')]: heroes,
    [wireKey('phase')]: 26,
    [wireKey('wave')]: wave,
    [wireKey('gold')]: String(gold),
    [wireKey('roomHp')]: roomHp,
    [wireKey('idle')]: idle,
    ...(hits !== undefined ? { [wireKey('hitsList')]: hits } : {}),
    ...(loot !== undefined ? { [wireKey('lootList')]: loot } : {}),
    ...(includeBonus ? { [wireKey('bonusSeconds')]: 30, [wireKey('bonusMultiplier')]: 2 } : {}),
  };

  return { json, tick: toLiveTick(json) };
}

export function generateReplayStream(seed: number = DEFAULT_SEED): ReplayStream {
  const rand = mulberry32(seed);
  const parts: Buffer[] = [];
  let cursor = 0;

  function append(buf: Buffer): { offset: number; endOffset: number } {
    const offset = cursor;
    parts.push(buf);
    cursor += buf.length;
    return { offset, endOffset: cursor };
  }

  const httpRange = append(buildHttpResponse(200, 'OK', JSON.stringify({ ok: true })));

  const frames: ReplayFrame[] = [];
  function appendSnapFrame(heroIds: readonly string[], idle: boolean, index: number): void {
    const { json, tick } = buildSnapPayload(rand, heroIds, idle, index);
    const range = append(buildServerTextFrame(Buffer.from(JSON.stringify(json), 'utf8')));
    frames.push({ offset: range.offset, endOffset: range.endOffset, tick });
  }

  for (let i = 0; i < IDLE_FRAME_COUNT; i += 1) {
    appendSnapFrame(HERO_IDS, true, i);
  }

  const afterCarrierLeaves = HERO_IDS.filter((id) => id !== AURA_CARRIER_ID);
  let auraCarrierLeavesAtFrameIndex = -1;
  for (let i = 0; i < COMBAT_BLOCK_A_COUNT; i += 1) {
    if (i === AURA_CARRIER_LEAVES_AT_INDEX) auraCarrierLeavesAtFrameIndex = frames.length;
    const roster = i < AURA_CARRIER_LEAVES_AT_INDEX ? HERO_IDS : afterCarrierLeaves;
    appendSnapFrame(roster, false, i);
  }

  const malformedRange = append(buildOversized64BitLengthFrame());

  for (let i = 0; i < COMBAT_BLOCK_B_COUNT; i += 1) {
    appendSnapFrame(afterCarrierLeaves, false, COMBAT_BLOCK_A_COUNT + i);
  }

  const { json: tailJson } = buildSnapPayload(rand, afterCarrierLeaves, false, 999);
  const fullTailFrame = buildServerTextFrame(Buffer.from(JSON.stringify(tailJson), 'utf8'));
  const truncatedRange = append(fullTailFrame.subarray(0, Math.floor(fullTailFrame.length * 0.4)));

  return {
    bytes: Buffer.concat(parts),
    httpResponse: { offset: httpRange.offset, endOffset: httpRange.endOffset, status: 200 },
    frames,
    malformedFrame: { offset: malformedRange.offset, endOffset: malformedRange.endOffset },
    truncatedTail: { offset: truncatedRange.offset },
    auraCarrierId: AURA_CARRIER_ID,
    auraCarrierLeavesAtFrameIndex,
  };
}
