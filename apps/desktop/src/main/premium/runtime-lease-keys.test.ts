import { build } from 'esbuild';
import { createPrivateKey, sign } from 'node:crypto';
import Module from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEASE_PUBLIC_KEYS } from '@bombfarm/contracts';
import { TEST_LEASE_KEYPAIR } from '../../../tests/fixtures/premium/keys.mjs';
import { verifyLease, type LeaseKeyTable } from './licence/lease-verify.js';
import { runtimeLeaseKeys } from './runtime-lease-keys.js';

const SUBJECT = 'user-1';
const DEVICE = 'device-key-id-1';

/** A Lease signed with the test keypair, which only a dev build running as dev may trust. */
function testSigned(): { lease: string; sig: string; keyId: string } {
  const payload = {
    v: 1,
    user: SUBJECT,
    deviceKeyId: DEVICE,
    state: 'active',
    playing: null,
    until: null,
    issuedAt: '2026-10-30T10:00:00.000Z',
    expiresAt: '2026-10-30T11:00:00.000Z',
    minSequence: 0,
  };
  const bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const key = createPrivateKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: TEST_LEASE_KEYPAIR.x, d: TEST_LEASE_KEYPAIR.d },
    format: 'jwk',
  });
  return { lease: bytes.toString('base64url'), sig: sign(null, bytes, key).toString('base64url'), keyId: TEST_LEASE_KEYPAIR.keyId };
}

function verdictOf(keys: LeaseKeyTable): string {
  const verdict = verifyLease(testSigned(), { subject: SUBJECT, deviceKeyId: DEVICE, keys });
  return verdict.ok ? 'accepted' : verdict.check;
}

const shippedIds = LEASE_PUBLIC_KEYS.map((key) => key.keyId).sort();

describe('the Lease keys a run trusts', () => {
  it('accepts a Lease signed with the test key in a dev build running as dev', () => {
    expect(verdictOf(runtimeLeaseKeys('dev', {}))).toBe('accepted');
  });

  it.each(['beta', 'prod', 'other', undefined])('refuses it as %s even in a dev build', (flavor) => {
    expect(verdictOf(runtimeLeaseKeys(flavor, {}))).toBe('unknown_key');
  });

  it('keeps the two shipped keys in every case', () => {
    for (const flavor of ['dev', 'beta', 'prod', undefined]) {
      expect([...runtimeLeaseKeys(flavor, {}).keys()].filter((id) => shippedIds.includes(id)).sort()).toEqual(shippedIds);
    }
    expect(runtimeLeaseKeys('dev', {}).size).toBe(shippedIds.length + 1);
    expect(runtimeLeaseKeys('prod', {}).size).toBe(shippedIds.length);
  });

  it('refuses it in a build made for prod, whatever flavour it runs as', async () => {
    const built = await build({
      entryPoints: [join(__dirname, 'runtime-lease-keys.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      logLevel: 'silent',
      define: { __BFC_PREMIUM_DEV__: 'false', __BFC_BUILD_FLAVOR__: '"prod"' },
    });
    // Loaded the way Node loads any CommonJS file, so the bundle runs as the built app would.
    const loaded = new Module(join(__dirname, 'built-for-prod.cjs')) as Module & { _compile(code: string, file: string): void };
    loaded._compile(built.outputFiles[0]?.text ?? '', join(__dirname, 'built-for-prod.cjs'));
    const keys = (loaded.exports as { runtimeLeaseKeys: typeof runtimeLeaseKeys }).runtimeLeaseKeys('dev', {});
    expect(verdictOf(keys)).toBe('unknown_key');
    expect([...keys.keys()].sort()).toEqual(shippedIds);
  });
});
