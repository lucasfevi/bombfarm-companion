import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, type KeyObject } from 'node:crypto';
import type { SqliteDb } from '../../storage/index.js';
import type { SecretBox } from '../token-vault.js';

/** The PC's identity for one signed-in user. `fingerprintSalt` and `deviceId` are null until the server hands them out. */
export interface DeviceRecord {
  readonly privateKey: KeyObject;
  /** The raw 32-byte public key, base64url (the JWK `x`). */
  readonly publicKey: string;
  /** base64url(sha256(raw public key)), the full 43 characters. */
  readonly keyId: string;
  readonly fingerprintSalt: string | null;
  readonly deviceId: string | null;
}

/** The exact signed bytes of the last verified Lease, with its signature and the lease key id. */
export interface LeaseRecord {
  readonly leaseB64: string;
  readonly sig: string;
  readonly keyId: string;
}

/** Owed to the server: a removal report for the device key that left. */
export interface CleanupRecord {
  readonly keyId: string;
  readonly reason: string;
}

export type WriteOutcome = 'written' | 'unavailable';

export interface LicenceStore {
  readDevice(subject: string): DeviceRecord | null;
  writeDevice(subject: string, record: DeviceRecord): WriteOutcome;
  clearDevice(subject: string): void;
  readLease(subject: string): LeaseRecord | null;
  writeLease(subject: string, record: LeaseRecord): WriteOutcome;
  clearLease(subject: string): void;
  readCleanup(subject: string): CleanupRecord | null;
  writeCleanup(subject: string, record: CleanupRecord): WriteOutcome;
  clearCleanup(subject: string): void;
}

const DEVICE_PREFIX = 'premium_device_v1';
const LEASE_PREFIX = 'premium_lease_v1';
const CLEANUP_PREFIX = 'premium_cleanup_v1';

/** A fresh Ed25519 key for a first activation, or for a Move made with a new key. */
export function generateDeviceRecord(): DeviceRecord {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const raw = String(publicKey.export({ format: 'jwk' }).x);
  const keyId = createHash('sha256').update(Buffer.from(raw, 'base64url')).digest('base64url');
  return { privateKey, publicKey: raw, keyId, fingerprintSalt: null, deviceId: null };
}

interface MetaRow {
  value: string;
}

type Parse<T> = (value: Record<string, unknown>) => T | null;

const isString = (value: unknown): value is string => typeof value === 'string';
const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';

const parseDevice: Parse<DeviceRecord> = (v) => {
  const { privateKeyPkcs8, publicKeyRaw, keyId, fingerprintSalt, deviceId } = v;
  if (!isString(privateKeyPkcs8) || !isString(publicKeyRaw) || !isString(keyId)) return null;
  if (!isStringOrNull(fingerprintSalt) || !isStringOrNull(deviceId)) return null;
  try {
    const privateKey = createPrivateKey({ key: Buffer.from(privateKeyPkcs8, 'base64'), format: 'der', type: 'pkcs8' });
    // The stored public half must be the one this private key makes, or the record is not usable.
    const derived = String(createPublicKey(privateKey).export({ format: 'jwk' }).x);
    if (derived !== publicKeyRaw) return null;
    return { privateKey, publicKey: publicKeyRaw, keyId, fingerprintSalt, deviceId };
  } catch {
    return null;
  }
};

const parseLease: Parse<LeaseRecord> = ({ leaseB64, sig, keyId }) =>
  isString(leaseB64) && isString(sig) && isString(keyId) ? { leaseB64, sig, keyId } : null;

const parseCleanup: Parse<CleanupRecord> = ({ keyId, reason }) =>
  isString(keyId) && isString(reason) ? { keyId, reason } : null;

const serializeDevice = (record: DeviceRecord): string =>
  JSON.stringify({
    privateKeyPkcs8: record.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
    publicKeyRaw: record.publicKey,
    keyId: record.keyId,
    fingerprintSalt: record.fingerprintSalt,
    deviceId: record.deviceId,
  });

export function createLicenceStore(db: SqliteDb | null, box: SecretBox): LicenceStore {
  function deleteRow(key: string): void {
    if (!db) return;
    try {
      db.prepare('DELETE FROM account_meta WHERE key = ?').run(key);
    } catch {
      // A row that cannot be deleted is read again, and deleted again, on the next read.
    }
  }

  function read<T>(key: string, parse: Parse<T>): T | null {
    if (!db || !box.isAvailable()) return null;
    let stored: string | undefined;
    try {
      stored = (db.prepare('SELECT value FROM account_meta WHERE key = ?').get(key) as MetaRow | undefined)?.value;
    } catch {
      return null;
    }
    if (stored === undefined) return null;
    let record: T | null = null;
    try {
      const value: unknown = JSON.parse(box.decrypt(Buffer.from(stored, 'base64')));
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        record = parse(value as Record<string, unknown>);
      }
    } catch {
      record = null;
    }
    if (record === null) deleteRow(key);
    return record;
  }

  function write(key: string, json: () => string): WriteOutcome {
    if (!db || !box.isAvailable()) return 'unavailable';
    try {
      const value = box.encrypt(json()).toString('base64');
      db.prepare(
        'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
      ).run(key, value);
      return 'written';
    } catch {
      return 'unavailable';
    }
  }

  return {
    readDevice: (subject) => read(`${DEVICE_PREFIX}:${subject}`, parseDevice),
    writeDevice: (subject, record) => write(`${DEVICE_PREFIX}:${subject}`, () => serializeDevice(record)),
    clearDevice: (subject) => {
      deleteRow(`${DEVICE_PREFIX}:${subject}`);
    },
    readLease: (subject) => read(`${LEASE_PREFIX}:${subject}`, parseLease),
    writeLease: (subject, record) => write(`${LEASE_PREFIX}:${subject}`, () => JSON.stringify(record)),
    clearLease: (subject) => {
      deleteRow(`${LEASE_PREFIX}:${subject}`);
    },
    readCleanup: (subject) => read(`${CLEANUP_PREFIX}:${subject}`, parseCleanup),
    writeCleanup: (subject, record) => write(`${CLEANUP_PREFIX}:${subject}`, () => JSON.stringify(record)),
    clearCleanup: (subject) => {
      deleteRow(`${CLEANUP_PREFIX}:${subject}`);
    },
  };
}
