import { createHash, createPublicKey, type KeyObject, verify } from 'node:crypto';
import { gte, lt, satisfies, valid } from 'semver';
import {
  type AppFlavor,
  BUNDLE_PUBLIC_KEYS,
  type BundlePublicKey,
  type PremiumBundleRole,
  type PremiumManifest,
  type PremiumManifestFile,
} from '@bombfarm/contracts';
import { checkBundlePath } from './bundle-paths.js';

/**
 * Why a bundle was refused, in the order the checks run. The first failure is the answer, so a
 * bundle that fails two checks reports the earlier one.
 */
export type VerifyReason =
  | 'too_large'
  | 'unknown_key'
  | 'bad_signature'
  | 'bad_manifest'
  | 'bad_path'
  | 'bad_layout'
  | 'extra_file'
  | 'file_mismatch'
  | 'rollback'
  | 'below_floor'
  | 'expired'
  | 'host_range'
  | 'app_too_old'
  | 'wrong_flavour';

export const VERIFY_REASON_ORDER: readonly VerifyReason[] = [
  'too_large',
  'unknown_key',
  'bad_signature',
  'bad_manifest',
  'bad_path',
  'bad_layout',
  'extra_file',
  'file_mismatch',
  'rollback',
  'below_floor',
  'expired',
  'host_range',
  'app_too_old',
  'wrong_flavour',
];

export const MANIFEST_MAX_BYTES = 64 * 1024;
export const BUNDLE_MAX_FILES = 16;
/** The oldest app version a manifest may name as its minimum. */
export const MIN_APP_VERSION_FLOOR = '0.32.2';

const KEY_SCAN_BYTES = 4096;
const KEY_ID_PATTERN = /"keyId"\s*:\s*"([A-Za-z0-9_-]{8})"/;
const SIGNATURE_BYTES = 64;
const ROLES: readonly PremiumBundleRole[] = ['worker', 'renderer', 'style'];
const ROLE_PATHS: Readonly<Record<PremiumBundleRole, string>> = {
  worker: 'worker/index.cjs',
  renderer: 'ui/index.js',
  style: 'ui/index.css',
};

/** The public keys a manifest may be signed with, by key id. */
export type BundleKeyTable = ReadonlyMap<string, KeyObject>;

export function createBundleKeyTable(keys: readonly BundlePublicKey[]): BundleKeyTable {
  const table = new Map<string, KeyObject>();
  for (const { keyId, x } of keys) {
    table.set(keyId, createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' }));
  }
  return table;
}

/** The keys the app ships: the current one and the spare. */
export function shippedBundleKeys(): BundleKeyTable {
  return createBundleKeyTable(BUNDLE_PUBLIC_KEYS);
}

export type Fail = { readonly ok: false; readonly reason: VerifyReason };
const fail = (reason: VerifyReason): Fail => ({ ok: false, reason });

export interface VerifiedBundle {
  readonly manifest: PremiumManifest;
  /** The exact signed bytes; never re-serialised. */
  readonly manifestBytes: Uint8Array;
  readonly sig: Uint8Array;
  readonly files: ReadonlyMap<string, Uint8Array>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isString = (value: unknown): value is string => typeof value === 'string';
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString);
const isTimestamp = (value: unknown): value is string => isString(value) && !Number.isNaN(Date.parse(value));

function readFile(value: unknown): PremiumManifestFile | undefined {
  if (!isRecord(value)) return undefined;
  const { path, role, size, sha256 } = value;
  if (!isString(path) || !isString(role) || !Number.isSafeInteger(size) || (size as number) < 0 || !isString(sha256)) {
    return undefined;
  }
  // A role outside the three is a layout fault, not a malformed manifest.
  return { path, role: role as PremiumBundleRole, size: size as number, sha256 };
}

/**
 * The manifest as parsed, or undefined when it is not schema 1 or a field is missing or mistyped.
 * A local development manifest is unsigned: its key id may be null and its sequence is 0.
 */
function readManifest(value: unknown, local = false): PremiumManifest | undefined {
  if (!isRecord(value)) return undefined;
  const { schema, keyId, bundle, version, sequence, createdAt, expiresAt, hostApi, minAppVersion, flavors, capabilities } =
    value;
  const rawFiles = value['files'];
  if (
    schema !== 1 ||
    !(isString(keyId) || (local && keyId === null)) ||
    bundle !== 'premium' ||
    !isString(version) ||
    !Number.isSafeInteger(sequence) ||
    (sequence as number) < (local ? 0 : 1) ||
    !isTimestamp(createdAt) ||
    !isTimestamp(expiresAt) ||
    !isString(hostApi) ||
    !isString(minAppVersion) ||
    valid(minAppVersion) === null ||
    lt(minAppVersion, MIN_APP_VERSION_FLOOR) ||
    !isStringArray(flavors) ||
    !isStringArray(capabilities) ||
    !Array.isArray(rawFiles)
  ) {
    return undefined;
  }
  const files: PremiumManifestFile[] = [];
  for (const raw of rawFiles) {
    const file = readFile(raw);
    if (file === undefined) return undefined;
    files.push(file);
  }
  return {
    schema: 1,
    keyId: keyId ?? '',
    bundle: 'premium',
    version,
    sequence: sequence as number,
    createdAt,
    expiresAt,
    hostApi,
    minAppVersion,
    flavors: flavors as AppFlavor[],
    capabilities,
    files,
  };
}

/** A local development manifest's bytes parsed with the same schema rules, minus the signature's. */
export function parseLocalManifest(raw: Uint8Array): PremiumManifest | null {
  if (raw.length > MANIFEST_MAX_BYTES) return null;
  try {
    return readManifest(JSON.parse(Buffer.from(raw).toString('utf8')), true) ?? null;
  } catch {
    return null;
  }
}

/** The key id the raw bytes name, found without parsing them. */
function scanKeyId(raw: Uint8Array): string | null {
  const head = Buffer.from(raw.subarray(0, KEY_SCAN_BYTES)).toString('latin1');
  return KEY_ID_PATTERN.exec(head)?.[1] ?? null;
}

/**
 * Size, signature, then schema. The signature is checked over the raw bytes before they are
 * parsed, and the parsed object is never serialised again.
 */
export function verifyManifest(
  raw: Uint8Array,
  sig: Uint8Array,
  ctx: { readonly keys: BundleKeyTable },
): { readonly ok: true; readonly manifest: PremiumManifest } | Fail {
  if (raw.length > MANIFEST_MAX_BYTES) return fail('too_large');

  const scanned = scanKeyId(raw);
  const key = scanned === null ? undefined : ctx.keys.get(scanned);
  if (key === undefined) return fail('unknown_key');

  let signed = false;
  if (sig.length === SIGNATURE_BYTES) {
    try {
      signed = verify(null, raw, key, sig);
    } catch {
      signed = false;
    }
  }
  if (!signed) return fail('bad_signature');

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw).toString('utf8'));
  } catch {
    return fail('bad_manifest');
  }
  const manifest = readManifest(parsed);
  if (manifest === undefined || manifest.keyId !== scanned) return fail('bad_manifest');
  return { ok: true, manifest };
}

function layoutOk(files: readonly PremiumManifestFile[]): boolean {
  if (files.length > BUNDLE_MAX_FILES) return false;
  if (new Set(files.map((f) => f.path)).size !== files.length) return false;
  const counts: Record<PremiumBundleRole, number> = { worker: 0, renderer: 0, style: 0 };
  for (const file of files) {
    if (!ROLES.includes(file.role)) return false;
    if (/\.(node|asar)$/i.test(file.path)) return false;
    if (file.path !== ROLE_PATHS[file.role]) return false;
    counts[file.role] += 1;
  }
  return counts.worker === 1 && counts.renderer === 1 && counts.style <= 1;
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Paths, layout, then every file against the manifest. */
export function verifyFiles(
  manifest: PremiumManifest,
  files: ReadonlyMap<string, Uint8Array>,
): { readonly ok: true } | Fail {
  if (manifest.files.some((f) => checkBundlePath(f.path) !== 'ok')) return fail('bad_path');
  if (!layoutOk(manifest.files)) return fail('bad_layout');

  const listed = new Set(manifest.files.map((f) => f.path));
  for (const path of files.keys()) {
    if (!listed.has(path)) return fail('extra_file');
  }
  for (const entry of manifest.files) {
    const bytes = files.get(entry.path);
    if (bytes === undefined || bytes.length !== entry.size) return fail('file_mismatch');
    if (!SHA256_HEX.test(entry.sha256) || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
      return fail('file_mismatch');
    }
  }
  return { ok: true };
}

/** Rollback, the Lease floor, then expiry. */
export function verifyFreshness(
  manifest: PremiumManifest,
  ctx: { readonly highest: number | null; readonly floor: number; readonly nowMs: number },
): { readonly ok: true } | Fail {
  if (ctx.highest !== null && manifest.sequence < ctx.highest) return fail('rollback');
  if (manifest.sequence < ctx.floor) return fail('below_floor');
  if (ctx.nowMs >= Date.parse(manifest.expiresAt)) return fail('expired');
  return { ok: true };
}

/** The host API range, the app version, then the running flavour. */
export function verifyFit(
  manifest: PremiumManifest,
  ctx: { readonly hostApi: string; readonly appVersion: string; readonly flavor: AppFlavor },
): { readonly ok: true } | Fail {
  if (!satisfies(ctx.hostApi, manifest.hostApi)) return fail('host_range');
  if (valid(ctx.appVersion) === null || !gte(ctx.appVersion, manifest.minAppVersion)) return fail('app_too_old');
  if (!manifest.flavors.includes(ctx.flavor)) return fail('wrong_flavour');
  return { ok: true };
}

export interface BundleInput {
  readonly manifestBytes: Uint8Array;
  readonly sig: Uint8Array;
  readonly files: ReadonlyMap<string, Uint8Array>;
}

export interface VerifyContext {
  readonly keys: BundleKeyTable;
  /** The highest sequence ever accepted for this subject; null before any. */
  readonly highest: number | null;
  /** The Lease floor; 0 before any Lease. */
  readonly floor: number;
  readonly nowMs: number;
  /** The host API version this app offers. */
  readonly hostApi: string;
  readonly appVersion: string;
  readonly flavor: AppFlavor;
}

/** Every check, in order; the first failure is the reason. Nothing is written or run here. */
export function verifyBundle(
  input: BundleInput,
  ctx: VerifyContext,
): { readonly ok: true; readonly bundle: VerifiedBundle } | Fail {
  const signed = verifyManifest(input.manifestBytes, input.sig, ctx);
  if (!signed.ok) return signed;
  const files = verifyFiles(signed.manifest, input.files);
  if (!files.ok) return files;
  const fresh = verifyFreshness(signed.manifest, ctx);
  if (!fresh.ok) return fresh;
  const fits = verifyFit(signed.manifest, ctx);
  if (!fits.ok) return fits;
  return {
    ok: true,
    bundle: {
      manifest: signed.manifest,
      manifestBytes: input.manifestBytes,
      sig: input.sig,
      files: new Map(input.files),
    },
  };
}
