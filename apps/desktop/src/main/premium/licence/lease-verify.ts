import { createPublicKey, type KeyObject, verify } from 'node:crypto';
import { LEASE_PUBLIC_KEYS, type LeasePublicKey } from '@bombfarm/contracts';

/** The checks a Lease must pass, in the order they run. The first failure is the answer. */
export type LeaseCheck = 'unknown_key' | 'signature' | 'parse' | 'version' | 'user' | 'device' | 'state' | 'lifetime';

export const LEASE_CHECK_ORDER: readonly LeaseCheck[] = [
  'unknown_key',
  'signature',
  'parse',
  'version',
  'user',
  'device',
  'state',
  'lifetime',
];

export type LeaseWireState = 'active' | 'paused_other_account' | 'ended' | 'released' | 'moved';

const LEASE_STATES: readonly string[] = ['active', 'paused_other_account', 'ended', 'released', 'moved'];

export const LEASE_MAX_LIFETIME_MS = 3_600_000;

export interface LeasePlaying {
  readonly accountId: string;
  readonly steamId64: string;
}

export interface LeasePayload {
  readonly v: 1;
  readonly user: string;
  readonly deviceKeyId: string;
  readonly state: LeaseWireState;
  readonly playing: LeasePlaying | null;
  readonly until: string | null;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly minSequence: number;
  readonly holderName?: string;
}

/** The lease public keys a Lease may be signed with, by key id. */
export type LeaseKeyTable = ReadonlyMap<string, KeyObject>;

export interface LeaseEnvelope {
  /** base64url of the exact signed JSON bytes. */
  readonly lease: string;
  /** base64url Ed25519 signature over those bytes. */
  readonly sig: string;
  readonly keyId: string;
}

export interface LeaseContext {
  readonly subject: string;
  /** The signed-in subject's own device key id. */
  readonly deviceKeyId: string;
  readonly keys: LeaseKeyTable;
}

export type LeaseVerdict =
  | {
      readonly ok: true;
      readonly payload: LeasePayload;
      /** The exact signed bytes, as decoded; never re-serialised. */
      readonly bytes: Buffer;
      /** How long the Lease is good for after it arrives: `min(expiresAt - issuedAt, 60 min)`. */
      readonly windowMs: number;
    }
  | { readonly ok: false; readonly check: LeaseCheck };

export function createLeaseKeyTable(keys: readonly LeasePublicKey[]): LeaseKeyTable {
  const table = new Map<string, KeyObject>();
  for (const { keyId, x } of keys) {
    table.set(keyId, createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x }, format: 'jwk' }));
  }
  return table;
}

/** The two keys the app ships. */
export function shippedLeaseKeys(): LeaseKeyTable {
  return createLeaseKeyTable(LEASE_PUBLIC_KEYS);
}

const BASE64URL = /^[A-Za-z0-9_-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readPlaying(value: unknown): LeasePlaying | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  const { accountId, steamId64 } = value;
  return typeof accountId === 'string' && typeof steamId64 === 'string' ? { accountId, steamId64 } : undefined;
}

type Shape = Omit<LeasePayload, 'v' | 'state'> & { readonly v: number; readonly state: string };

/** Reads the fields every check after `parse` relies on; undefined when one is missing or mistyped. */
function readShape(value: unknown): Shape | undefined {
  if (!isRecord(value)) return undefined;
  const { v, user, deviceKeyId, state, until, issuedAt, expiresAt, minSequence, holderName } = value;
  const playing = readPlaying(value['playing']);
  if (
    typeof v !== 'number' ||
    typeof user !== 'string' ||
    typeof deviceKeyId !== 'string' ||
    typeof state !== 'string' ||
    playing === undefined ||
    !(until === null || typeof until === 'string') ||
    typeof issuedAt !== 'string' ||
    typeof expiresAt !== 'string' ||
    Number.isNaN(Date.parse(issuedAt)) ||
    Number.isNaN(Date.parse(expiresAt)) ||
    typeof minSequence !== 'number' ||
    !(holderName === undefined || typeof holderName === 'string')
  ) {
    return undefined;
  }
  return {
    v,
    user,
    deviceKeyId,
    state,
    playing,
    until,
    issuedAt,
    expiresAt,
    minSequence,
    ...(holderName === undefined ? {} : { holderName }),
  };
}

/**
 * Verifies a Lease envelope for this signed-in subject and device. The signature is checked over the
 * decoded bytes before anything is parsed, and the parsed object is never serialised again.
 */
export function verifyLease(env: LeaseEnvelope, ctx: LeaseContext): LeaseVerdict {
  const key = ctx.keys.get(env.keyId);
  if (key === undefined) return { ok: false, check: 'unknown_key' };

  if (!BASE64URL.test(env.lease) || !BASE64URL.test(env.sig)) return { ok: false, check: 'signature' };
  const bytes = Buffer.from(env.lease, 'base64url');
  let signed = false;
  try {
    signed = verify(null, bytes, key, Buffer.from(env.sig, 'base64url'));
  } catch {
    signed = false;
  }
  if (!signed) return { ok: false, check: 'signature' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { ok: false, check: 'parse' };
  }
  const shape = readShape(parsed);
  if (shape === undefined) return { ok: false, check: 'parse' };
  if (shape.v !== 1) return { ok: false, check: 'version' };
  if (shape.user !== ctx.subject) return { ok: false, check: 'user' };
  if (shape.deviceKeyId !== ctx.deviceKeyId) return { ok: false, check: 'device' };
  if (!LEASE_STATES.includes(shape.state)) return { ok: false, check: 'state' };
  const lifetimeMs = Date.parse(shape.expiresAt) - Date.parse(shape.issuedAt);
  if (lifetimeMs > LEASE_MAX_LIFETIME_MS) return { ok: false, check: 'lifetime' };

  return {
    ok: true,
    payload: { ...shape, v: 1, state: shape.state as LeaseWireState },
    bytes,
    windowMs: Math.max(0, lifetimeMs),
  };
}
