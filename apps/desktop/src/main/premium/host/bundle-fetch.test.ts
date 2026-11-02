import { PLUGIN_API_VERSION } from '@bombfarm/contracts';
import { describe, expect, it } from 'vitest';
import type { FixtureOptions } from '../../../../tests/fixtures/premium/sign-fixture.mjs';
import { createLogSink } from '../premium-test-support.js';
import type { DeviceGetRequest, DeviceGetResult } from '../licence/licence-runner.js';
import { DEFAULT_FETCH_LIMITS, fetchBundle, type FetchOutcome } from './bundle-fetch.js';
import type { BundleInput, VerifyContext } from './bundle-verify.js';
import { signedInput, VERIFY_CTX } from './host-test-support.js';

const enc = (value: unknown): Uint8Array => new Uint8Array(Buffer.from(JSON.stringify(value), 'utf8'));
const fail = (reason: Extract<DeviceGetResult, { ok: false }>['reason']): DeviceGetResult => ({ ok: false, reason });
const ok = (status: number, bytes: Uint8Array): DeviceGetResult => ({ ok: true, status, bytes, retryAfterSec: null });

function answerFor(input: BundleInput, overrides: Record<string, unknown> = {}): Uint8Array {
  const manifest = JSON.parse(Buffer.from(input.manifestBytes).toString('utf8')) as { sequence: number };
  return enc({
    sequence: manifest.sequence,
    manifest: Buffer.from(input.manifestBytes).toString('base64'),
    signature: Buffer.from(input.sig).toString('base64url'),
    files: [],
    ...overrides,
  });
}

interface Stub {
  requests: DeviceGetRequest[];
  deviceGet: (req: DeviceGetRequest) => Promise<DeviceGetResult>;
}

/** A server holding one bundle; `file` may override what a file request answers. */
function server(
  input: BundleInput,
  options: {
    manifest?: DeviceGetResult;
    file?: (path: string) => DeviceGetResult | undefined;
  } = {},
): Stub {
  const requests: DeviceGetRequest[] = [];
  return {
    requests,
    deviceGet: async (req) => {
      requests.push(req);
      await Promise.resolve();
      if (req.route.r === 'bundle') return options.manifest ?? ok(200, answerFor(input));
      const { path } = req.route;
      return options.file?.(path) ?? ok(200, input.files.get(path) ?? new Uint8Array());
    },
  };
}

function run(
  stub: Stub,
  context: Partial<VerifyContext> = {},
  extra: { signal?: AbortSignal; limits?: typeof DEFAULT_FETCH_LIMITS } = {},
): { outcome: Promise<FetchOutcome>; log: ReturnType<typeof createLogSink> } {
  const log = createLogSink();
  const outcome = fetchBundle({
    deviceGet: stub.deviceGet,
    context: () => ({ ...VERIFY_CTX, ...context }),
    signal: extra.signal ?? new AbortController().signal,
    log,
    ...(extra.limits ? { limits: extra.limits } : {}),
  });
  return { outcome, log };
}

function reason(outcome: FetchOutcome): string {
  return outcome.ok ? 'ok' : outcome.reason;
}

function fixture(options: FixtureOptions = {}): BundleInput {
  return signedInput(options);
}

describe('a bundle that downloads', () => {
  it('asks for the manifest, then each listed file in order, and hands back the verified bytes', async () => {
    const input = fixture({ sequence: 6 });
    const stub = server(input);
    const { outcome, log } = run(stub);
    const result = await outcome;

    expect(result.ok).toBe(true);
    expect(stub.requests.map((r) => r.route)).toEqual([
      { r: 'bundle', query: { hostApi: PLUGIN_API_VERSION, appVersion: '1.0.0', flavor: 'dev' } },
      { r: 'file', sequence: 6, path: 'ui/index.css' },
      { r: 'file', sequence: 6, path: 'ui/index.js' },
      { r: 'file', sequence: 6, path: 'worker/index.cjs' },
    ]);
    if (result.ok) {
      expect(result.bundle.manifest.sequence).toBe(6);
      for (const [path, bytes] of input.files) {
        expect(Buffer.from(result.bundle.files.get(path) ?? []).equals(Buffer.from(bytes))).toBe(true);
      }
    }
    expect(log.records.filter((r) => r['event'] === 'premium.bundle_fetch')).toEqual([
      { scope: 'premium', event: 'premium.bundle_fetch', outcome: 'ok', sequence: 6 },
    ]);
  });

  it('caps the answer, and each file at the size the manifest lists', async () => {
    const input = fixture();
    const stub = server(input);
    await run(stub).outcome;
    const manifest = JSON.parse(Buffer.from(input.manifestBytes).toString('utf8')) as {
      files: { path: string; size: number }[];
    };
    expect(stub.requests[0]?.maxBytes).toBe(DEFAULT_FETCH_LIMITS.answerBytes);
    for (const file of manifest.files) {
      const request = stub.requests.find((r) => r.route.r === 'file' && r.route.path === file.path);
      expect(request?.maxBytes).toBe(file.size);
    }
  });

  it('passes the caller\'s abort signal to every request', async () => {
    const controller = new AbortController();
    const stub = server(fixture());
    await run(stub, {}, { signal: controller.signal }).outcome;
    expect(stub.requests.every((r) => r.signal === controller.signal)).toBe(true);
  });
});

describe('the manifest request', () => {
  it.each(['none', 'pulled', 'below_floor', 'audience', 'host_api', 'app_version', 'flavor', 'expiring'])(
    'a 404 naming %s is none_%s and asks for no file',
    async (name) => {
      const stub = server(fixture(), { manifest: ok(404, enc({ reason: name })) });
      const { outcome, log } = run(stub);
      const result = await outcome;
      expect(result).toEqual({ ok: false, reason: `none_${name}`, sequence: null });
      expect(stub.requests).toHaveLength(1);
      expect(log.records[0]).toMatchObject({ event: 'premium.bundle_fetch', outcome: `none_${name}`, sequence: null });
    },
  );

  it.each([
    ['a 404 with no usable reason', ok(404, enc({ reason: 'Not A Reason!' })), 'bad_status'],
    ['a 500', ok(500, new Uint8Array()), 'bad_status'],
    ['a 403', ok(403, enc({ reason: 'lease_required' })), 'bad_status'],
    ['a 429', ok(429, new Uint8Array()), 'rate_limited'],
    ['a body that is not JSON', ok(200, new Uint8Array([1, 2, 3])), 'bad_answer'],
    ['a body missing the signature', ok(200, enc({ sequence: 3, manifest: 'AAAA' })), 'bad_answer'],
    ['a manifest that is not base64', ok(200, enc({ sequence: 3, manifest: '!!!', signature: 'AAAA' })), 'bad_answer'],
    ['a closed gate', fail('gate_closed'), 'gate_closed'],
    ['a bearer refusal', fail('unauthorized'), 'unauthorized'],
    ['a size breach', fail('too_large'), 'too_large'],
    ['a timeout or network fault', fail('unreachable'), 'unreachable'],
  ])('%s is %s with nothing kept', async (_name, manifest, expected) => {
    const stub = server(fixture(), { manifest });
    const result = await run(stub).outcome;
    expect(reason(result)).toBe(expected);
    expect(stub.requests).toHaveLength(1);
    expect(result.ok).toBe(false);
  });

  it('refuses an answer whose sequence differs from the signed manifest', async () => {
    const input = fixture({ sequence: 6 });
    const stub = server(input, { manifest: ok(200, answerFor(input, { sequence: 7 })) });
    expect(reason(await run(stub).outcome)).toBe('bad_answer');
    expect(stub.requests).toHaveLength(1);
  });
});

describe('the signature comes first', () => {
  it('a bad signature stops before any file request', async () => {
    const input = fixture();
    const sig = new Uint8Array(input.sig);
    sig[0] = (sig[0] ?? 0) ^ 0xff;
    const stub = server({ ...input, sig });
    const result = await run(stub).outcome;
    expect(result).toEqual({ ok: false, reason: 'bad_signature', sequence: null });
    expect(stub.requests).toHaveLength(1);
  });

  it('an unknown key stops before any file request', async () => {
    const stub = server(fixture({ keyId: 'AAAAAAAA' }));
    expect(reason(await run(stub).outcome)).toBe('unknown_key');
    expect(stub.requests).toHaveLength(1);
  });

  it('a listing that cannot be downloaded asks for no file', async () => {
    const big = fixture({
      edit: ({ manifest }) => {
        const [first] = manifest['files'] as { size: number }[];
        if (first) first.size = 5 * 1024 * 1024;
      },
    });
    const stub = server(big);
    expect(reason(await run(stub).outcome)).toBe('too_large');
    expect(stub.requests).toHaveLength(1);
  });

  it('a path the host refuses asks for no file', async () => {
    const stub = server(
      fixture({
        edit: ({ manifest }) => {
          const [first] = manifest['files'] as { path: string }[];
          if (first) first.path = '../up.js';
        },
      }),
    );
    expect(reason(await run(stub).outcome)).toBe('bad_path');
    expect(stub.requests).toHaveLength(1);
  });
});

describe('a file request that fails', () => {
  it('a 500 on a file keeps nothing and stops asking', async () => {
    const stub = server(fixture(), { file: (path) => (path === 'ui/index.js' ? ok(500, new Uint8Array()) : undefined) });
    const result = await run(stub).outcome;
    expect(result).toEqual({ ok: false, reason: 'bad_status', sequence: 4 });
    expect(stub.requests.map((r) => (r.route.r === 'file' ? r.route.path : 'bundle'))).toEqual([
      'bundle',
      'ui/index.css',
      'ui/index.js',
    ]);
  });

  it('a size breach and a timeout each fail with the sequence and nothing kept', async () => {
    for (const failure of ['too_large', 'unreachable'] as const) {
      const stub = server(fixture(), { file: () => fail(failure) });
      const result = await run(stub).outcome;
      expect(result).toEqual({ ok: false, reason: failure, sequence: 4 });
    }
  });

  it('a gate that closes mid-download ends it', async () => {
    const stub = server(fixture(), { file: () => fail('gate_closed') });
    expect(reason(await run(stub).outcome)).toBe('gate_closed');
  });

  it('an abort between requests sends no more', async () => {
    const controller = new AbortController();
    const input = fixture();
    const stub = server(input, {
      file: () => {
        controller.abort();
        return undefined;
      },
    });
    const result = await run(stub, {}, { signal: controller.signal }).outcome;
    expect(reason(result)).toBe('aborted');
    expect(stub.requests.length).toBeLessThan(4);
  });
});

describe('the checks after the download', () => {
  it('a file that differs from the manifest is a file_mismatch', async () => {
    const input = fixture();
    const stub = server(input, {
      file: (path) => (path === 'ui/index.js' ? ok(200, new Uint8Array(input.files.get(path) ?? []).fill(65)) : undefined),
    });
    expect(reason(await run(stub).outcome)).toBe('file_mismatch');
  });

  it('rollback, expiry and fit use the context at the time of the check', async () => {
    expect(reason(await run(server(fixture({ sequence: 4 })), { highest: 5 }).outcome)).toBe('rollback');
    expect(reason(await run(server(fixture({ sequence: 4 })), { floor: 9 }).outcome)).toBe('below_floor');
    expect(reason(await run(server(fixture({ flavors: ['beta'] }))).outcome)).toBe('wrong_flavour');
    const expired = fixture({ createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-02-01T00:00:00.000Z' });
    expect(reason(await run(server(expired)).outcome)).toBe('expired');
  });

  it('logs the verification outcome with the sequence and never a byte', async () => {
    const { outcome, log } = run(server(fixture({ sequence: 4 })), { highest: 5 });
    await outcome;
    expect(log.records).toContainEqual({ scope: 'premium', event: 'premium.bundle_verify', outcome: 'rollback', sequence: 4 });
    expect(JSON.stringify(log.records)).not.toMatch(/bfc-premium-fixture-marker|manifest/);
  });
});
