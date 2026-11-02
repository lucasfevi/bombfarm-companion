import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { deviceHeader } from './device-signature.js';

// A fixed Ed25519 seed (bytes 1..32) wrapped as PKCS#8, so every signature below is a known value.
const SEED_PKCS8_HEX = '302e020100300506032b6570042204200102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20';
const KEY_ID = 'ZbYGc9btiEvwHCwiLYKtoHQPKawzVdapJcgfF_R6J7g';
const BODY = '{"playing":null,"fingerprint":"ab"}';
const PATH = '/v1/premium/lease';
const KNOWN_HEADER =
  'ZbYGc9btiEvwHCwiLYKtoHQPKawzVdapJcgfF_R6J7g.1792497600.jN_KL-rhB3v_ZFIedJYcgm6hYTmow7f1dK-PkmzFtm6pg9wsfm6AQA6U8jLVcadoR68T7Qg7HcFer4-Z5_54AA';
// 1792497600 s plus half a second of local time and a 9.999 s offset: floors to the same second.
const NOW_MS = 1_792_497_590_500;
const OFFSET_MS = 9_999;

function fixedKey(): KeyObject {
  return createPrivateKey({ key: Buffer.from(SEED_PKCS8_HEX, 'hex'), format: 'der', type: 'pkcs8' });
}

const request = (over: Partial<Parameters<typeof deviceHeader>[0]> = {}): Parameters<typeof deviceHeader>[0] => ({
  keyId: KEY_ID,
  privateKey: fixedKey(),
  method: 'POST',
  path: PATH,
  body: BODY,
  nowMs: NOW_MS,
  offsetMs: OFFSET_MS,
  ...over,
});

// The device guard's steps, re-written from the published contract: header shape, a skew of at
// most 120 s, then an Ed25519 check over METHOD, path, seconds and the body's sha256 joined by line
// feeds.
function serverAccepts(
  header: string,
  publicKey: KeyObject,
  received: { method: string; path: string; body: string; serverNowMs: number },
): boolean {
  const match = /^([A-Za-z0-9_-]{43})\.(\d{1,12})\.([A-Za-z0-9_-]{86})$/.exec(header);
  if (match === null) return false;
  const [, , seconds, signature] = match as unknown as [string, string, string, string];
  if (Math.abs(received.serverNowMs - Number(seconds) * 1000) > 120_000) return false;
  const digest = createHash('sha256').update(Buffer.from(received.body, 'utf8')).digest('hex');
  const message = `${received.method}\n${received.path}\n${seconds}\n${digest}`;
  const sig = Buffer.from(signature, 'base64url');
  return sig.length === 64 && verify(null, Buffer.from(message), publicKey, sig);
}

describe('deviceHeader', () => {
  const publicKey = createPublicKey(fixedKey());
  const sent = { method: 'POST', path: PATH, body: BODY, serverNowMs: 1_792_497_600_000 };

  it('produces the known header for a fixed key, method, path, body, time and offset', () => {
    expect(deviceHeader(request())).toBe(KNOWN_HEADER);
  });

  it('is accepted by the server steps re-implemented from the contract', () => {
    expect(serverAccepts(deviceHeader(request()), publicKey, sent)).toBe(true);
  });

  it('is rejected when one body byte changes after signing', () => {
    const header = deviceHeader(request());
    expect(serverAccepts(header, publicKey, { ...sent, body: BODY.replace('ab', 'ac') })).toBe(false);
  });

  it('is rejected when the path differs from the signed one', () => {
    expect(serverAccepts(deviceHeader(request()), publicKey, { ...sent, path: '/v1/premium/licence' })).toBe(false);
  });

  it('is rejected by a different key', () => {
    const other = generateKeyPairSync('ed25519').publicKey;
    expect(serverAccepts(deviceHeader(request()), other, sent)).toBe(false);
  });

  it('signs a multi-byte body as UTF-8, over the same string that is sent', () => {
    const body = '{"computerName":"Café テスト"}';
    const path = '/v1/premium/licence/activate';
    const header = deviceHeader(request({ body, path }));
    expect(serverAccepts(header, publicKey, { method: 'POST', path, body, serverNowMs: 1_792_497_600_000 })).toBe(true);
  });

  it('puts the key id first and the floored seconds second', () => {
    const [keyId, seconds] = deviceHeader(request()).split('.');
    expect(keyId).toBe(KEY_ID);
    expect(seconds).toBe('1792497600');
  });

  it('timestamps nowMs plus offsetMs, floored to seconds', () => {
    const seconds = (nowMs: number, offsetMs: number): string =>
      deviceHeader(request({ nowMs, offsetMs })).split('.')[1] ?? '';
    expect(seconds(1_000_999, 0)).toBe('1000');
    expect(seconds(1_000_000, 999)).toBe('1000');
    expect(seconds(1_000_000, 1_000)).toBe('1001');
    // A PC whose clock runs ten minutes slow is put back on server time by a positive offset.
    expect(seconds(1_000_000_000 - 600_000, 600_000)).toBe('1000000');
    // A PC whose clock runs ahead takes a negative offset.
    expect(seconds(1_000_000_000 + 600_000, -600_000)).toBe('1000000');
  });
});
