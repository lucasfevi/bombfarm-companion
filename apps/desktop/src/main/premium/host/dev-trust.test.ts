import { build, transformSync } from 'esbuild';
import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';
import Module from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { guardScanner } from '../../guard-scan';
import { TEST_BUNDLE_KEYPAIR, TEST_LEASE_KEYPAIR } from '../../../../tests/fixtures/premium/keys.mjs';
import {
  DEV_APP_VERSION_ENV,
  DEV_BUNDLE_DIR_ENV,
  TEST_BUNDLE_PUBLIC_KEY,
  TEST_LEASE_PUBLIC_KEY,
  devTrust,
  type DevTrustEnv,
} from './dev-trust';
import { loadDevTrust } from './dev-loader';

const SRC_ROOT = resolve(__dirname, '..', '..', '..');
const { readAll } = guardScanner(__filename);

function derivedPublic(pair: { x: string; d: string }): { x: string; keyId: string } {
  const privateKey = createPrivateKey({ key: { kty: 'OKP', crv: 'Ed25519', x: pair.x, d: pair.d }, format: 'jwk' });
  const x = createPublicKey(privateKey).export({ format: 'jwk' }).x ?? '';
  const keyId = createHash('sha256').update(Buffer.from(x, 'base64url')).digest('base64url').slice(0, 8);
  return { x, keyId };
}

function env(flavor: DevTrustEnv['flavor'], vars: Record<string, string | undefined> = {}): DevTrustEnv {
  return { flavor, vars };
}

describe('the test keypairs and the public halves dev trust names', () => {
  it('derives the bundle public key from the bundle private seed', () => {
    const derived = derivedPublic(TEST_BUNDLE_KEYPAIR);
    expect(TEST_BUNDLE_PUBLIC_KEY).toEqual({ keyId: derived.keyId, x: derived.x });
    expect(TEST_BUNDLE_KEYPAIR.x).toBe(derived.x);
    expect(TEST_BUNDLE_KEYPAIR.keyId).toBe(derived.keyId);
  });

  it('derives the lease public key from the lease private seed', () => {
    const derived = derivedPublic(TEST_LEASE_KEYPAIR);
    expect(TEST_LEASE_PUBLIC_KEY).toEqual({ keyId: derived.keyId, x: derived.x });
    expect(TEST_LEASE_KEYPAIR.x).toBe(derived.x);
    expect(TEST_LEASE_KEYPAIR.keyId).toBe(derived.keyId);
  });

  it('keeps the two keypairs distinct', () => {
    expect(TEST_BUNDLE_KEYPAIR.x).not.toBe(TEST_LEASE_KEYPAIR.x);
    expect(TEST_BUNDLE_KEYPAIR.keyId).not.toBe(TEST_LEASE_KEYPAIR.keyId);
  });
});

describe('devTrust', () => {
  it('trusts exactly the test bundle key and the test lease key in the dev flavour', () => {
    expect(devTrust(env('dev'))).toEqual({
      bundleKeys: [TEST_BUNDLE_PUBLIC_KEY],
      leaseKeys: [TEST_LEASE_PUBLIC_KEY],
      devBundleDir: null,
    });
  });

  it.each(['beta', 'prod'] as const)('trusts nothing as %s, even when the folder variable is set', (flavor) => {
    expect(devTrust(env(flavor, { [DEV_BUNDLE_DIR_ENV]: 'C:/local/bundle' }))).toBeNull();
  });

  it('reads the local bundle folder from the environment', () => {
    expect(devTrust(env('dev', { [DEV_BUNDLE_DIR_ENV]: 'C:/local/bundle' }))?.devBundleDir).toBe('C:/local/bundle');
  });

  it('reads the version bundle fit is judged against from the environment', () => {
    expect(devTrust(env('dev', { [DEV_APP_VERSION_ENV]: ' 0.32.2 ' }))?.appVersion).toBe('0.32.2');
  });

  it.each([undefined, '', 'not-a-version', '0.32'])('sets no version override for %j', (value) => {
    expect(devTrust(env('dev', { [DEV_APP_VERSION_ENV]: value }))).not.toHaveProperty('appVersion');
  });

  it.each(['beta', 'prod'] as const)('sets no version override as %s', (flavor) => {
    expect(devTrust(env(flavor, { [DEV_APP_VERSION_ENV]: '0.32.2' }))).toBeNull();
  });

  it.each([undefined, '', '   '])('treats %j as no local bundle folder', (value) => {
    expect(devTrust(env('dev', { [DEV_BUNDLE_DIR_ENV]: value }))?.devBundleDir).toBeNull();
  });
});

describe('loadDevTrust', () => {
  // The loader `require`s the module the way the bundled app does, and Node cannot load a
  // TypeScript file by itself, so this suite teaches `require` to read one for its duration.
  type Extensions = Record<string, (module: { _compile(code: string, file: string): void }, file: string) => void>;
  const extensions = (Module as unknown as { _extensions: Extensions })._extensions;

  beforeAll(() => {
    extensions['.ts'] = (module, file) => {
      module._compile(transformSync(readFileSync(file, 'utf8'), { loader: 'ts', format: 'cjs' }).code, file);
    };
  });

  afterAll(() => {
    delete extensions['.ts'];
  });

  it('answers like devTrust in a dev build running as dev', () => {
    expect(loadDevTrust(env('dev'))).toEqual(devTrust(env('dev')));
    expect(loadDevTrust(env('dev'))).not.toBeNull();
  });

  it.each(['beta', 'prod'] as const)('answers null as %s even in a dev build', (flavor) => {
    expect(loadDevTrust(env(flavor, { [DEV_BUNDLE_DIR_ENV]: 'C:/local/bundle' }))).toBeNull();
  });
});

describe('the loader in a built bundle', () => {
  async function bundled(dev: boolean): Promise<string> {
    const result = await build({
      entryPoints: [join(__dirname, 'dev-loader.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      logLevel: 'silent',
      define: { __BFC_PREMIUM_DEV__: String(dev), __BFC_BUILD_FLAVOR__: JSON.stringify(dev ? 'dev' : 'prod') },
    });
    return result.outputFiles[0]?.text ?? '';
  }

  it('carries both test public keys and the folder variable in a dev bundle', async () => {
    const output = await bundled(true);
    expect(output).toContain(TEST_BUNDLE_KEYPAIR.x);
    expect(output).toContain(TEST_LEASE_KEYPAIR.x);
    expect(output).toContain(DEV_BUNDLE_DIR_ENV);
  });

  it('carries none of them, nor the module name, in a prod bundle', async () => {
    const output = await bundled(false);
    expect(output).not.toContain(TEST_BUNDLE_KEYPAIR.x);
    expect(output).not.toContain(TEST_LEASE_KEYPAIR.x);
    expect(output).not.toContain(DEV_BUNDLE_DIR_ENV);
    expect(output).not.toContain('dev-trust');
  });
});

describe('who may name the test keys and the folder variable', () => {
  const needles: ReadonlyArray<readonly [string, string]> = [
    ['the test bundle public key', TEST_BUNDLE_KEYPAIR.x],
    ['the test lease public key', TEST_LEASE_KEYPAIR.x],
    ['the local bundle folder variable', DEV_BUNDLE_DIR_ENV],
    ['the app version override variable', DEV_APP_VERSION_ENV],
  ];

  it('finds them in no file under src other than the dev trust module', () => {
    const owner = join(SRC_ROOT, 'main', 'premium', 'host', 'dev-trust.ts');
    const files = readAll(SRC_ROOT, ['.ts', '.tsx', '.mjs'], { includeTests: true }).filter(
      (file) => file.path !== owner,
    );
    expect(files.length).toBeGreaterThan(50);
    const hits = files.flatMap((file) =>
      needles.filter(([, needle]) => file.source.includes(needle)).map(([label]) => `${label}: ${relative(SRC_ROOT, file.path)}`),
    );
    expect(hits).toEqual([]);
  });

  it('finds them in the dev trust module itself', () => {
    const owner = readAll(join(SRC_ROOT, 'main', 'premium', 'host'), ['.ts']).find((file) =>
      file.path.endsWith('dev-trust.ts'),
    );
    expect(needles.every(([, needle]) => owner?.source.includes(needle))).toBe(true);
  });

  it('reaches the dev trust module only through the loader', () => {
    const importers = readAll(SRC_ROOT, ['.ts', '.tsx'], { includeTests: false }).filter((file) =>
      /['"]\.{1,2}\/(?:[\w./-]*\/)?dev-trust(?:\.js)?['"]/.test(file.source),
    );
    expect(importers.map((file) => relative(SRC_ROOT, file.path).split(sep).join('/'))).toEqual([
      'main/premium/host/dev-loader.ts',
    ]);
  });
});
