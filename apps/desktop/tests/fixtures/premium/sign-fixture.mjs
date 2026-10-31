import { Buffer } from 'node:buffer';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_BUNDLE_KEYPAIR } from './keys.mjs';

/**
 * Builds the harmless fixture bundle and signs its manifest with the public test bundle key, at
 * call time, so a fixture never expires in the repo. The manifest is one compact `JSON.stringify`
 * in contract field order; its bytes are signed as they are and never re-serialised.
 */

const BUNDLE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'bundle');
const DAY_MS = 86_400_000;

const FILES = [
  { path: 'ui/index.css', role: 'style' },
  { path: 'ui/index.js', role: 'renderer' },
  { path: 'worker/index.cjs', role: 'worker' },
];

export const FIXTURE_FILES = Object.freeze(FILES.map((f) => f.path));

/**
 * @param {import('./sign-fixture.d.mts').FixtureOptions} [options]
 * @returns {import('./sign-fixture.d.mts').SignedFixture}
 */
export function signFixture(options = {}) {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const expiresAt = options.expiresAt ?? new Date(Date.parse(createdAt) + 180 * DAY_MS).toISOString();

  /** @type {Map<string, Uint8Array>} */
  const files = new Map();
  for (const { path } of FILES) files.set(path, new Uint8Array(readFileSync(join(BUNDLE_DIR, path))));

  const manifest = {
    schema: 1,
    keyId: options.keyId ?? TEST_BUNDLE_KEYPAIR.keyId,
    bundle: 'premium',
    version: options.version ?? '1.0.0',
    sequence: options.sequence ?? 1,
    createdAt,
    expiresAt,
    hostApi: options.hostApi ?? '^1.0.0',
    minAppVersion: options.minAppVersion ?? '0.32.2',
    flavors: [...(options.flavors ?? ['dev'])],
    capabilities: [...(options.capabilities ?? [])],
    files: FILES.map(({ path, role }) => {
      const bytes = files.get(path);
      return { path, role, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    }),
  };
  options.edit?.({ manifest, files });

  const manifestBytes = new Uint8Array(Buffer.from(JSON.stringify(manifest), 'utf8'));
  const key = createPrivateKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: TEST_BUNDLE_KEYPAIR.x, d: TEST_BUNDLE_KEYPAIR.d },
    format: 'jwk',
  });
  const signed = { manifestBytes, sig: new Uint8Array(sign(null, manifestBytes, key)), files };
  return options.mutate?.(signed) ?? signed;
}
