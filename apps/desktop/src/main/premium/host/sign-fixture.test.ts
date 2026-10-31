import { createHash, createPublicKey, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { PremiumManifest } from '@bombfarm/contracts';
import { TEST_BUNDLE_KEYPAIR } from '../../../../tests/fixtures/premium/keys.mjs';
import { FIXTURE_FILES, signFixture } from '../../../../tests/fixtures/premium/sign-fixture.mjs';

const publicKey = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: TEST_BUNDLE_KEYPAIR.x }, format: 'jwk' });

function parse(bytes: Uint8Array): PremiumManifest {
  return JSON.parse(Buffer.from(bytes).toString('utf8')) as PremiumManifest;
}

describe('signFixture', () => {
  it('signs the exact manifest bytes with the test bundle key', () => {
    const { manifestBytes, sig } = signFixture();
    expect(sig).toHaveLength(64);
    expect(verify(null, manifestBytes, publicKey, sig)).toBe(true);
  });

  it('describes every bundle file with its real size and hash, in role order', () => {
    const { manifestBytes, files } = signFixture({ sequence: 7 });
    const manifest = parse(manifestBytes);
    expect(manifest.sequence).toBe(7);
    expect(manifest.keyId).toBe(TEST_BUNDLE_KEYPAIR.keyId);
    expect(manifest.files.map((f) => f.path)).toEqual([...FIXTURE_FILES]);
    expect(manifest.files.map((f) => f.role).sort()).toEqual(['renderer', 'style', 'worker']);
    for (const file of manifest.files) {
      const bytes = files.get(file.path);
      expect(bytes?.length).toBe(file.size);
      expect(createHash('sha256').update(bytes ?? new Uint8Array()).digest('hex')).toBe(file.sha256);
    }
    expect(files.size).toBe(FIXTURE_FILES.length);
  });

  it('writes the key id early in the manifest and mints fresh timestamps', () => {
    const before = Date.now();
    const { manifestBytes } = signFixture();
    const text = Buffer.from(manifestBytes).toString('utf8');
    expect(text.indexOf('"keyId"')).toBeLessThan(64);
    const manifest = parse(manifestBytes);
    expect(Date.parse(manifest.createdAt)).toBeGreaterThanOrEqual(before - 1000);
    expect(Date.parse(manifest.expiresAt) - Date.parse(manifest.createdAt)).toBe(180 * 86_400_000);
  });

  it('takes the declared fields from its options', () => {
    const manifest = parse(
      signFixture({
        hostApi: '^2.0.0',
        minAppVersion: '9.9.9',
        flavors: ['beta'],
        capabilities: ['x.y'],
        version: '3.1.4',
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-02-01T00:00:00.000Z',
      }).manifestBytes,
    );
    expect(manifest).toMatchObject({
      hostApi: '^2.0.0',
      minAppVersion: '9.9.9',
      flavors: ['beta'],
      capabilities: ['x.y'],
      version: '3.1.4',
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-02-01T00:00:00.000Z',
    });
  });

  it('signs what edit changed before signing', () => {
    const { manifestBytes, sig } = signFixture({
      edit: ({ manifest }) => {
        manifest['bundle'] = 'other';
      },
    });
    expect(parse(manifestBytes).bundle).toBe('other' as never);
    expect(verify(null, manifestBytes, publicKey, sig)).toBe(true);
  });

  it('lets mutate alter bytes after signing, so the signature no longer holds', () => {
    const { manifestBytes, sig } = signFixture({
      mutate: (signed) => ({ ...signed, manifestBytes: new Uint8Array([...signed.manifestBytes, 0x20]) }),
    });
    expect(verify(null, manifestBytes, publicKey, sig)).toBe(false);
  });
});
