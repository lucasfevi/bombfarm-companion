import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BUNDLE_PUBLIC_KEYS, PLUGIN_API_VERSION } from '@bombfarm/contracts';
import { TEST_BUNDLE_KEYPAIR } from '../../../../tests/fixtures/premium/keys.mjs';
import { signFixture, type FixtureOptions } from '../../../../tests/fixtures/premium/sign-fixture.mjs';
import {
  createBundleKeyTable,
  shippedBundleKeys,
  verifyBundle,
  verifyFiles,
  verifyFit,
  verifyFreshness,
  verifyManifest,
  VERIFY_REASON_ORDER,
  type BundleInput,
  type VerifyContext,
  type VerifyReason,
} from './bundle-verify.js';

const NOW = Date.parse('2026-11-01T12:00:00.000Z');
const CREATED = '2026-11-01T00:00:00.000Z';
const TEST_KEYS = createBundleKeyTable([{ keyId: TEST_BUNDLE_KEYPAIR.keyId, x: TEST_BUNDLE_KEYPAIR.x }]);

const BASE_CTX: VerifyContext = {
  keys: TEST_KEYS,
  highest: null,
  floor: 0,
  nowMs: NOW,
  hostApi: PLUGIN_API_VERSION,
  appVersion: '1.0.0',
  flavor: 'dev',
};

const testPrivateKey = createPrivateKey({
  key: { kty: 'OKP', crv: 'Ed25519', x: TEST_BUNDLE_KEYPAIR.x, d: TEST_BUNDLE_KEYPAIR.d },
  format: 'jwk',
});

function fixture(options: FixtureOptions = {}): BundleInput {
  return signFixture({ sequence: 4, createdAt: CREATED, ...options });
}

/** A signed manifest with arbitrary bytes, for shapes the fixture signer cannot produce. */
function signedRaw(text: string): BundleInput {
  const good = fixture();
  const manifestBytes = new Uint8Array(Buffer.from(text, 'utf8'));
  return { manifestBytes, sig: new Uint8Array(sign(null, manifestBytes, testPrivateKey)), files: good.files };
}

function reasonOf(input: BundleInput, ctx: Partial<VerifyContext> = {}): VerifyReason | 'ok' {
  const result = verifyBundle(input, { ...BASE_CTX, ...ctx });
  return result.ok ? 'ok' : result.reason;
}

type Entries = Array<Record<string, unknown>>;
const entries = (m: Record<string, unknown>): Entries => m['files'] as Entries;
const find = (m: Record<string, unknown>, role: string): Record<string, unknown> =>
  entries(m).find((f) => f['role'] === role) as Record<string, unknown>;

/**
 * One way to break each check. A fault touches only its own part of the fixture, so any two can
 * be applied together.
 */
interface Fault {
  readonly options?: FixtureOptions;
  readonly ctx?: Partial<VerifyContext>;
  readonly edit?: NonNullable<FixtureOptions['edit']>;
  readonly mutate?: NonNullable<FixtureOptions['mutate']>;
}

const FAULTS: Record<VerifyReason, Fault> = {
  too_large: {
    mutate: (s) => ({ ...s, manifestBytes: new Uint8Array([...s.manifestBytes, ...new Uint8Array(70_000).fill(32)]) }),
  },
  unknown_key: { options: { keyId: 'AAAAAAAA' } },
  bad_signature: {
    mutate: (s) => {
      const sig = new Uint8Array(s.sig);
      sig[0] = (sig[0] ?? 0) ^ 1;
      return { ...s, sig };
    },
  },
  bad_manifest: {
    edit: ({ manifest }) => {
      manifest['schema'] = 2;
    },
  },
  bad_path: {
    edit: ({ manifest }) => {
      find(manifest, 'style')['path'] = '../index.css';
    },
  },
  bad_layout: {
    edit: ({ manifest }) => {
      find(manifest, 'worker')['role'] = 'renderer';
    },
  },
  extra_file: {
    edit: ({ files }) => {
      files.set('ui/extra.js', new Uint8Array([1]));
    },
  },
  file_mismatch: {
    edit: ({ files }) => {
      files.set('ui/index.js', new Uint8Array([1, 2, 3]));
    },
  },
  rollback: { ctx: { highest: 9 } },
  below_floor: { ctx: { floor: 9 } },
  expired: { options: { expiresAt: '2026-11-01T06:00:00.000Z' } },
  host_range: { options: { hostApi: '^2.0.0' } },
  app_too_old: { options: { minAppVersion: '9.0.0' } },
  wrong_flavour: { options: { flavors: ['prod'] } },
};

function withFaults(...reasons: VerifyReason[]): { input: BundleInput; ctx: Partial<VerifyContext> } {
  const faults = reasons.map((r) => FAULTS[r]);
  const options: FixtureOptions = faults.reduce<FixtureOptions>((acc, f) => ({ ...acc, ...f.options }), {});
  const input = fixture({
    ...options,
    edit: (draft) => {
      for (const f of faults) f.edit?.(draft);
    },
    mutate: (signed) => faults.reduce((acc, f) => f.mutate?.(acc) ?? acc, signed),
  });
  return { input, ctx: faults.reduce<Partial<VerifyContext>>((acc, f) => ({ ...acc, ...f.ctx }), {}) };
}

describe('verifyBundle: the fixture', () => {
  it('verifies and returns the exact manifest bytes and every file', () => {
    const input = fixture();
    const result = verifyBundle(input, BASE_CTX);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.manifestBytes).toBe(input.manifestBytes);
    expect(result.bundle.sig).toBe(input.sig);
    expect([...result.bundle.files.keys()].sort()).toEqual(['ui/index.css', 'ui/index.js', 'worker/index.cjs']);
    for (const [path, bytes] of input.files) expect(result.bundle.files.get(path)).toEqual(bytes);
    expect(result.bundle.manifest.sequence).toBe(4);
  });

  it('accepts the boundaries: the highest sequence itself, the floor itself, the exact minimum app version', () => {
    expect(reasonOf(fixture({ minAppVersion: '0.32.2' }), { highest: 4, floor: 4, appVersion: '0.32.2' })).toBe('ok');
  });
});

describe('verifyBundle: one row per reason', () => {
  it('lists the reasons in the order the checks run', () => {
    expect(VERIFY_REASON_ORDER).toEqual(Object.keys(FAULTS));
  });

  it.each(VERIFY_REASON_ORDER)('%s', (reason) => {
    const { input, ctx } = withFaults(reason);
    expect(reasonOf(input, ctx)).toBe(reason);
  });
});

describe('verifyBundle: a bundle failing two checks reports the earlier one', () => {
  const pairs = VERIFY_REASON_ORDER.slice(0, -1).map((earlier, i) => [earlier, VERIFY_REASON_ORDER.slice(i + 1)[0] as VerifyReason] as const);

  it.each(pairs)('%s before %s', (earlier, later) => {
    const { input, ctx } = withFaults(later, earlier);
    expect(reasonOf(input, ctx)).toBe(earlier);
  });

  it('puts an extra file before a mismatching file', () => {
    const { input } = withFaults('file_mismatch', 'extra_file');
    expect(reasonOf(input)).toBe('extra_file');
  });
});

describe('verifyManifest', () => {
  it('refuses a manifest of exactly 64 KiB plus one byte, and takes one of exactly 64 KiB to the next check', () => {
    const base = fixture();
    const pad = (n: number): Uint8Array => new Uint8Array([...base.manifestBytes, ...new Uint8Array(n - base.manifestBytes.length).fill(32)]);
    expect(verifyManifest(pad(65_537), base.sig, { keys: TEST_KEYS })).toEqual({ ok: false, reason: 'too_large' });
    expect(verifyManifest(pad(65_536), base.sig, { keys: TEST_KEYS })).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('finds no key id past the first 4 KiB', () => {
    const text = `{"pad":"${'x'.repeat(4100)}","keyId":"${TEST_BUNDLE_KEYPAIR.keyId}"}`;
    const input = signedRaw(text);
    expect(verifyManifest(input.manifestBytes, input.sig, { keys: TEST_KEYS })).toEqual({ ok: false, reason: 'unknown_key' });
  });

  it('refuses a manifest naming no key id at all', () => {
    const input = signedRaw('{}');
    expect(verifyManifest(input.manifestBytes, input.sig, { keys: TEST_KEYS })).toEqual({ ok: false, reason: 'unknown_key' });
  });

  it('refuses a signature that is not 64 bytes', () => {
    const { manifestBytes, sig } = fixture();
    expect(verifyManifest(manifestBytes, sig.subarray(0, 63), { keys: TEST_KEYS })).toEqual({ ok: false, reason: 'bad_signature' });
    expect(verifyManifest(manifestBytes, new Uint8Array([...sig, 0]), { keys: TEST_KEYS })).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('refuses a manifest whose key id is shipped but whose signature is by another key', () => {
    const shipped = BUNDLE_PUBLIC_KEYS[0] as (typeof BUNDLE_PUBLIC_KEYS)[number];
    const { manifestBytes, sig } = fixture({ keyId: shipped.keyId });
    expect(verifyManifest(manifestBytes, sig, { keys: shippedBundleKeys() })).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('does not trust the test key in the shipped table', () => {
    const { manifestBytes, sig } = fixture();
    expect(verifyManifest(manifestBytes, sig, { keys: shippedBundleKeys() })).toEqual({ ok: false, reason: 'unknown_key' });
  });

  it('refuses a manifest re-serialised with different whitespace', () => {
    const { manifestBytes, sig } = fixture();
    const pretty = new Uint8Array(Buffer.from(JSON.stringify(JSON.parse(Buffer.from(manifestBytes).toString('utf8')), null, 2)));
    expect(verifyManifest(pretty, sig, { keys: TEST_KEYS })).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('verifies a manifest signed by the next key like one signed by the current key', () => {
    const current = generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' });
    const table = createBundleKeyTable([
      { keyId: 'cur00000', x: current.x as string },
      { keyId: TEST_BUNDLE_KEYPAIR.keyId, x: TEST_BUNDLE_KEYPAIR.x },
    ]);
    const { manifestBytes, sig } = fixture();
    expect(verifyManifest(manifestBytes, sig, { keys: table }).ok).toBe(true);
  });

  const badManifests: Array<[string, (text: string) => string]> = [
    ['not JSON', () => `{"keyId":"${TEST_BUNDLE_KEYPAIR.keyId}"`],
    ['a JSON array', () => `[{"keyId":"${TEST_BUNDLE_KEYPAIR.keyId}"}]`],
    ['a key id that differs from the scanned one', (t) => t.replace(/}$/, ',"keyId":"ZZZZZZZZ"}')],
    ['a missing field', (t) => t.replace('"sequence":4,', '')],
    ['a mistyped field', (t) => t.replace('"sequence":4', '"sequence":"4"')],
    ['a zero sequence', (t) => t.replace('"sequence":4', '"sequence":0')],
    ['a fractional sequence', (t) => t.replace('"sequence":4', '"sequence":4.5')],
    ['an unparseable timestamp', (t) => t.replace(/"expiresAt":"[^"]*"/, '"expiresAt":"soon"')],
    ['another bundle name', (t) => t.replace('"bundle":"premium"', '"bundle":"other"')],
    ['a minimum app version below the floor', (t) => t.replace('"minAppVersion":"0.32.2"', '"minAppVersion":"0.32.1"')],
    ['a minimum app version that is not a version', (t) => t.replace('"minAppVersion":"0.32.2"', '"minAppVersion":"new"')],
    ['a file entry without a size', (t) => t.replace(/"size":\d+,/, '')],
  ];

  it.each(badManifests)('refuses %s as bad_manifest', (_name, change) => {
    const good = Buffer.from(fixture().manifestBytes).toString('utf8');
    const changed = change(good);
    expect(changed).not.toBe(good);
    const input = signedRaw(changed);
    expect(verifyManifest(input.manifestBytes, input.sig, { keys: TEST_KEYS })).toEqual({ ok: false, reason: 'bad_manifest' });
  });
});

describe('verifyFiles', () => {
  const manifestOf = (options: FixtureOptions = {}) => {
    const input = fixture(options);
    const result = verifyManifest(input.manifestBytes, input.sig, { keys: TEST_KEYS });
    if (!result.ok) throw new Error(`fixture refused: ${result.reason}`);
    return { manifest: result.manifest, files: input.files };
  };

  it.each([
    ['a node addon', 'ui/index.node'],
    ['an archive', 'ui/index.asar'],
    ['an upper-case addon', 'ui/INDEX.NODE'],
  ])('refuses %s as bad_layout', (_name, to) => {
    const { manifest, files } = manifestOf({
      edit: ({ manifest: m }) => {
        find(m, 'style')['path'] = to;
      },
    });
    expect(verifyFiles(manifest, files)).toEqual({ ok: false, reason: 'bad_layout' });
  });

  it('refuses a role outside the three', () => {
    const { manifest, files } = manifestOf({ edit: ({ manifest: m }) => void (find(m, 'style')['role'] = 'plugin') });
    expect(verifyFiles(manifest, files)).toEqual({ ok: false, reason: 'bad_layout' });
  });

  it('refuses a bundle without a renderer', () => {
    const { manifest, files } = manifestOf({ edit: ({ manifest: m }) => void (m['files'] = entries(m).filter((f) => f['role'] !== 'renderer')) });
    expect(verifyFiles(manifest, files)).toEqual({ ok: false, reason: 'bad_layout' });
  });

  it('refuses two workers', () => {
    const { manifest, files } = manifestOf({ edit: ({ manifest: m }) => void entries(m).push({ ...find(m, 'worker') }) });
    expect(verifyFiles(manifest, files)).toEqual({ ok: false, reason: 'bad_layout' });
  });

  it('refuses more than sixteen files', () => {
    const { manifest, files } = manifestOf({
      edit: ({ manifest: m }) => {
        for (let i = 0; i < 14; i += 1) entries(m).push({ path: `ui/f${String(i)}.js`, role: 'style', size: 0, sha256: '0' });
      },
    });
    expect(verifyFiles(manifest, files)).toEqual({ ok: false, reason: 'bad_layout' });
  });

  it('takes a bundle without a stylesheet', () => {
    const { manifest, files } = manifestOf({
      edit: ({ manifest: m, files: f }) => {
        m['files'] = entries(m).filter((e) => e['role'] !== 'style');
        f.delete('ui/index.css');
      },
    });
    expect(verifyFiles(manifest, files)).toEqual({ ok: true });
  });

  it.each([
    ['an absolute path', '/etc/passwd'],
    ['a parent segment', 'ui/../x.js'],
    ['a backslash', 'ui\\x.js'],
    ['a drive letter', 'C:/x.js'],
    ['a NUL', 'ui/x\u0000.js'],
  ])('refuses %s as bad_path', (_name, path) => {
    const { manifest, files } = manifestOf({ edit: ({ manifest: m }) => void (find(m, 'style')['path'] = path) });
    expect(verifyFiles(manifest, files)).toEqual({ ok: false, reason: 'bad_path' });
  });

  it('refuses a file missing from the bytes, of another size, or with another hash', () => {
    const { manifest, files } = manifestOf();
    const missing = new Map(files);
    missing.delete('ui/index.js');
    const longer = new Map(files).set('ui/index.js', new Uint8Array([...(files.get('ui/index.js') ?? []), 0]));
    const flipped = new Map(files);
    const original = files.get('ui/index.js') ?? new Uint8Array();
    flipped.set('ui/index.js', new Uint8Array(original.map((b, i) => (i === 0 ? b ^ 1 : b))));
    for (const map of [missing, longer, flipped]) {
      expect(verifyFiles(manifest, map)).toEqual({ ok: false, reason: 'file_mismatch' });
    }
  });

  it.each([1, -1])('refuses a file whose listed size is off by %i though its hash is right', (delta) => {
    const edit: NonNullable<FixtureOptions['edit']> = ({ manifest: m }) => {
      find(m, 'renderer')['size'] = Number(find(m, 'renderer')['size']) + delta;
    };
    const { manifest, files } = manifestOf({ edit });
    expect(verifyFiles(manifest, files)).toEqual({ ok: false, reason: 'file_mismatch' });
    expect(reasonOf(fixture({ edit }))).toBe('file_mismatch');
  });

  it('refuses a hash that is not lower-case hex', () => {
    const { manifest, files } = manifestOf({
      edit: ({ manifest: m }) => void (find(m, 'style')['sha256'] = String(find(m, 'style')['sha256']).toUpperCase()),
    });
    expect(verifyFiles(manifest, files)).toEqual({ ok: false, reason: 'file_mismatch' });
  });
});

describe('verifyFreshness', () => {
  const manifest = (() => {
    const input = fixture({ expiresAt: '2026-11-02T00:00:00.000Z' });
    const result = verifyManifest(input.manifestBytes, input.sig, { keys: TEST_KEYS });
    if (!result.ok) throw new Error('fixture refused');
    return result.manifest;
  })();
  const ok = { highest: null, floor: 0, nowMs: NOW };

  it('takes a sequence equal to the highest accepted and to the floor', () => {
    expect(verifyFreshness(manifest, { ...ok, highest: 4, floor: 4 })).toEqual({ ok: true });
  });

  it('refuses a sequence below the highest accepted', () => {
    expect(verifyFreshness(manifest, { ...ok, highest: 5 })).toEqual({ ok: false, reason: 'rollback' });
  });

  it('refuses a sequence below the Lease floor', () => {
    expect(verifyFreshness(manifest, { ...ok, floor: 5 })).toEqual({ ok: false, reason: 'below_floor' });
  });

  it('refuses from the instant of expiry, not before', () => {
    const at = Date.parse('2026-11-02T00:00:00.000Z');
    expect(verifyFreshness(manifest, { ...ok, nowMs: at - 1 })).toEqual({ ok: true });
    expect(verifyFreshness(manifest, { ...ok, nowMs: at })).toEqual({ ok: false, reason: 'expired' });
  });
});

describe('verifyFit', () => {
  const manifest = (() => {
    const input = fixture({ hostApi: '^1.2.0', minAppVersion: '0.40.0', flavors: ['dev', 'beta'] });
    const result = verifyManifest(input.manifestBytes, input.sig, { keys: TEST_KEYS });
    if (!result.ok) throw new Error('fixture refused');
    return result.manifest;
  })();
  const fits = { hostApi: '1.2.0', appVersion: '0.40.0', flavor: 'beta' as const };

  it('takes a host API inside the range, the exact minimum app version and a listed flavour', () => {
    expect(verifyFit(manifest, fits)).toEqual({ ok: true });
  });

  it('refuses a host API below the range', () => {
    expect(verifyFit(manifest, { ...fits, hostApi: '1.1.0' })).toEqual({ ok: false, reason: 'host_range' });
  });

  it('takes a bundle written for any 1.x host on plugin API 1.1.0', () => {
    const input = fixture({ hostApi: '>=1.0.0 <2.0.0', minAppVersion: '0.40.0', flavors: ['dev', 'beta'] });
    const result = verifyManifest(input.manifestBytes, input.sig, { keys: TEST_KEYS });
    if (!result.ok) throw new Error('fixture refused');
    expect(verifyFit(result.manifest, { ...fits, hostApi: '1.1.0' })).toEqual({ ok: true });
  });

  it('refuses an app one patch below the minimum', () => {
    expect(verifyFit(manifest, { ...fits, appVersion: '0.39.9' })).toEqual({ ok: false, reason: 'app_too_old' });
  });

  it('refuses an app version that is not a version', () => {
    expect(verifyFit(manifest, { ...fits, appVersion: 'unknown' })).toEqual({ ok: false, reason: 'app_too_old' });
  });

  it('refuses a flavour the manifest does not list', () => {
    expect(verifyFit(manifest, { ...fits, flavor: 'prod' })).toEqual({ ok: false, reason: 'wrong_flavour' });
  });
});
