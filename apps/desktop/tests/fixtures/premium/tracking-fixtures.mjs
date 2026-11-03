import { Buffer } from 'node:buffer';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signFixture } from './sign-fixture.mjs';

/**
 * What the tracking smoke needs besides the signed bundle: the capture the replay tap plays, the
 * game folder the battle-log feed reads, and the values planted so a spec can tell what arrived.
 * Everything here is invented; nothing is read from a real game.
 */

const FIXTURES_DIR = dirname(fileURLToPath(import.meta.url));
const GAME_FOLDER = join(FIXTURES_DIR, 'tracking-game');

/** Every Premium capability, and the slot the bundle asks to be drawn in besides its own tab. */
export const TRACKING_CAPABILITIES = Object.freeze([
  'premium.status',
  'store',
  'log',
  'notify',
  'db',
  'raw.tap',
  'raw.battleLog',
  'premium.worker',
  'live.section',
]);
export const TRACKING_HOST_API = '>=1.2.0 <2.0.0';

/** The session token the spec writes into its `session.cfg`; the capture carries it so a leak shows. */
export const TOKEN_MARKER = 'SMOKE_TOKEN_MARKER_0001';
/** In the other account's battle-log section, which must never be delivered. */
export const OTHER_SECTION_MARKER = 'OTHER_ACCOUNT_SECTION_MARKER';
/** The licensed account, as the game would name it, and its battle-log section header. */
export const LINKED_PAIR = Object.freeze({
  accountId: '424242',
  steamId64: '76561198000000001',
  token: TOKEN_MARKER,
});
export const OTHER_ACCOUNT_ID = '999';
export const PLAYER_NAME = 'Smoke Fixture Player';
/** The bundle's own panel text, shared with the check the build runs for test material. */
export const BUNDLE_MARKER = 'bfc-premium-fixture-marker';

/** The tracking bundle, signed with the test key; `sequence` and `version` pick the release. */
export function trackingBundle({ sequence = 1, version = '1.0.0', ...rest } = {}) {
  return signFixture({
    dir: 'tracking-bundle',
    sequence,
    version,
    hostApi: TRACKING_HOST_API,
    capabilities: TRACKING_CAPABILITIES,
    ...rest,
  });
}

const CAPTURE_HEADER = Buffer.concat([Buffer.from('BFCC', 'ascii'), Buffer.from([1])]);

function captureRecord(ctx, bytes) {
  const ctxBytes = Buffer.from(String(ctx), 'utf8');
  const record = Buffer.alloc(1 + 4 + ctxBytes.length + 4 + bytes.length);
  let offset = 0;
  record.writeUInt8(typeof ctx === 'number' ? 0 : 1, offset);
  offset += 1;
  record.writeUInt32LE(ctxBytes.length, offset);
  offset += 4;
  ctxBytes.copy(record, offset);
  offset += ctxBytes.length;
  record.writeUInt32LE(bytes.length, offset);
  offset += 4;
  bytes.copy(record, offset);
  return record;
}

function httpJsonResponse(body) {
  const payload = Buffer.from(JSON.stringify(body), 'utf8');
  const head = `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: ${payload.length}\r\n\r\n`;
  return Buffer.concat([Buffer.from(head, 'latin1'), payload]);
}

function serverTextFrame(json) {
  const payload = Buffer.from(JSON.stringify(json), 'utf8');
  const length =
    payload.length <= 125 ? Buffer.from([payload.length]) : Buffer.from([126, payload.length >> 8, payload.length & 255]);
  return Buffer.concat([Buffer.from([0x81]), length, payload]);
}

/** The one body the capture carries: a response with a credential key and the token inside text. */
export function captureBody() {
  return {
    token: TOKEN_MARKER,
    profile: { account_id: LINKED_PAIR.accountId, player_name: PLAYER_NAME },
    note: `signed in with ${TOKEN_MARKER} on ${LINKED_PAIR.steamId64}`,
  };
}

/** The one frame the capture carries: a combat snapshot with the same planted values. */
export function captureFrame() {
  return {
    t: 'snap',
    phase: 26,
    wave: 3,
    gold: '123456',
    room_hp: 200,
    idle: false,
    token: TOKEN_MARKER,
    player_name: PLAYER_NAME,
    note: `session ${TOKEN_MARKER} for ${LINKED_PAIR.steamId64}`,
  };
}

/**
 * Writes a replay capture holding one response body and one frame, in that order, on one
 * connection. Played with `BFC_LIVE_SOURCE=replay` and `BFC_REPLAY_CAPTURE=<file>`; the replay
 * loops it, so the same pair arrives again on every pass.
 */
export function writeTrackingCapture(file) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    Buffer.concat([
      CAPTURE_HEADER,
      captureRecord(1, httpJsonResponse(captureBody())),
      captureRecord(1, serverTextFrame(captureFrame())),
    ]),
  );
  return file;
}

export const BATTLE_LOG_FILES = Object.freeze(['battle_log.cfg', 'settings.cfg']);

/**
 * Copies the game folder fixture (a battle log with the licensed account's section and one other,
 * and a `settings.cfg`) into `dir`, which a spec then names in `BFC_BATTLE_LOG_DIR_OVERRIDE`. The
 * override is honoured by an unpackaged build only.
 */
export function stageBattleLogFolder(dir) {
  mkdirSync(dir, { recursive: true });
  for (const name of BATTLE_LOG_FILES) copyFileSync(join(GAME_FOLDER, name), join(dir, name));
  return dir;
}
