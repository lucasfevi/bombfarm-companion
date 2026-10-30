import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { SqliteBinding, SqliteDb } from '../../storage/index.js';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../../storage/test-support.js';
import type { SecretBox } from '../token-vault.js';
import {
  createLicenceStore,
  type CleanupRecord,
  type DeviceRecord,
  generateDeviceRecord,
  type LeaseRecord,
} from './licence-store.js';

const availableBindings = detectAvailableBindings();
warnForUnavailableBindings(availableBindings);

const ALICE = 'user-alice-0001';
const BOB = 'user-bob-0002';

const LEASE: LeaseRecord = { leaseB64: 'bGVhc2UtYnl0ZXM', sig: 'c2lnLWJ5dGVz', keyId: 'lCwiDkHw' };
const CLEANUP: CleanupRecord = { keyId: 'ZbYGc9btiEvwHCwiLYKtoHQPKawzVdapJcgfF_R6J7g', reason: 'moved' };

function fakeBox(overrides: Partial<SecretBox> = {}): SecretBox {
  return {
    isAvailable: () => true,
    encrypt: (plain) => Buffer.from(plain, 'utf8').reverse(),
    decrypt: (cipher) => Buffer.from(cipher).reverse().toString('utf8'),
    ...overrides,
  };
}

function openDb(binding: SqliteBinding): SqliteDb {
  const { db } = openTestAccountDb(binding);
  if (db === null) throw new Error('the test database did not open');
  return db;
}

function rowValue(db: SqliteDb, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value;
}

function device(): DeviceRecord {
  return { ...generateDeviceRecord(), fingerprintSalt: 'c2FsdC1tYXJrZXItMDAwMDAwMDAwMDAwMDAwMDAwMDA', deviceId: 'dev-0001' };
}

describe('generateDeviceRecord', () => {
  it('makes an Ed25519 key whose id is the full base64url sha256 of the raw public key', () => {
    const record = generateDeviceRecord();

    expect(record.publicKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(record.keyId).toBe(createHash('sha256').update(Buffer.from(record.publicKey, 'base64url')).digest('base64url'));
    expect(record.keyId).toHaveLength(43);
    expect(record.fingerprintSalt).toBeNull();
    expect(record.deviceId).toBeNull();
  });

  it('makes a different key each time', () => {
    expect(generateDeviceRecord().keyId).not.toBe(generateDeviceRecord().keyId);
  });
});

describe.each(availableBindings)('createLicenceStore over the real account_meta table (%s)', (binding) => {
  it('round-trips the device record through a fresh store, as after a restart', () => {
    const db = openDb(binding);
    const record = device();

    expect(createLicenceStore(db, fakeBox()).writeDevice(ALICE, record)).toBe('written');

    const read = createLicenceStore(db, fakeBox()).readDevice(ALICE);
    expect(read?.keyId).toBe(record.keyId);
    expect(read?.publicKey).toBe(record.publicKey);
    expect(read?.fingerprintSalt).toBe(record.fingerprintSalt);
    expect(read?.deviceId).toBe('dev-0001');
  });

  it('keeps a null salt and a null device id as null', () => {
    const db = openDb(binding);
    createLicenceStore(db, fakeBox()).writeDevice(ALICE, generateDeviceRecord());

    const read = createLicenceStore(db, fakeBox()).readDevice(ALICE);
    expect(read?.fingerprintSalt).toBeNull();
    expect(read?.deviceId).toBeNull();
  });

  it('restores a private key that still signs for the same public key', () => {
    const db = openDb(binding);
    const record = device();
    createLicenceStore(db, fakeBox()).writeDevice(ALICE, record);

    const read = createLicenceStore(db, fakeBox()).readDevice(ALICE);
    expect(read).not.toBeNull();
    if (read === null) return;
    const message = Buffer.from('POST\n/v1/premium/lease\n1792497600\nabc');
    const signature = sign(null, message, read.privateKey);
    const publicKey = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: record.publicKey }, format: 'jwk' });
    expect(verify(null, message, publicKey, signature)).toBe(true);
  });

  it('seals the private key, the salt and the device id: none is readable in the row', () => {
    const db = openDb(binding);
    const record = device();
    createLicenceStore(db, fakeBox()).writeDevice(ALICE, record);

    const value = rowValue(db, `premium_device_v1:${ALICE}`) ?? '';
    const plain = Buffer.from(value, 'base64').toString('utf8');
    const reversed = Buffer.from(Buffer.from(value, 'base64')).reverse().toString('utf8');
    for (const secret of [record.fingerprintSalt ?? '', 'dev-0001', record.publicKey, record.keyId]) {
      expect(value).not.toContain(secret);
      expect(plain).not.toContain(secret);
    }
    // The fake box is a reversal, so what it sealed is the JSON: the secrets live only inside it.
    expect(reversed).toContain(record.keyId);
  });

  it('round-trips the lease record under its own key', () => {
    const db = openDb(binding);
    createLicenceStore(db, fakeBox()).writeLease(ALICE, LEASE);

    expect(createLicenceStore(db, fakeBox()).readLease(ALICE)).toEqual(LEASE);
    expect(rowValue(db, `premium_lease_v1:${ALICE}`)).toBeDefined();
  });

  it('round-trips the cleanup record under its own key', () => {
    const db = openDb(binding);
    createLicenceStore(db, fakeBox()).writeCleanup(ALICE, CLEANUP);

    expect(createLicenceStore(db, fakeBox()).readCleanup(ALICE)).toEqual(CLEANUP);
    expect(rowValue(db, `premium_cleanup_v1:${ALICE}`)).toBeDefined();
  });

  it('keeps the three kinds apart: clearing one leaves the other two', () => {
    const db = openDb(binding);
    const store = createLicenceStore(db, fakeBox());
    store.writeDevice(ALICE, device());
    store.writeLease(ALICE, LEASE);
    store.writeCleanup(ALICE, CLEANUP);

    store.clearLease(ALICE);

    expect(store.readLease(ALICE)).toBeNull();
    expect(rowValue(db, `premium_lease_v1:${ALICE}`)).toBeUndefined();
    expect(store.readDevice(ALICE)).not.toBeNull();
    expect(store.readCleanup(ALICE)).toEqual(CLEANUP);
  });

  it('clearDevice removes the device row and the next read is absent', () => {
    const db = openDb(binding);
    const store = createLicenceStore(db, fakeBox());
    store.writeDevice(ALICE, device());

    store.clearDevice(ALICE);

    expect(rowValue(db, 'premium_device_v1:' + ALICE)).toBeUndefined();
    expect(createLicenceStore(db, fakeBox()).readDevice(ALICE)).toBeNull();
  });

  it('clearCleanup removes the cleanup row and the next read is absent', () => {
    const db = openDb(binding);
    const store = createLicenceStore(db, fakeBox());
    store.writeCleanup(ALICE, CLEANUP);

    store.clearCleanup(ALICE);

    expect(rowValue(db, 'premium_cleanup_v1:' + ALICE)).toBeUndefined();
    expect(createLicenceStore(db, fakeBox()).readCleanup(ALICE)).toBeNull();
  });

  it('never lets two subjects collide', () => {
    const db = openDb(binding);
    const store = createLicenceStore(db, fakeBox());
    const alice = device();
    const bob = device();
    store.writeDevice(ALICE, alice);
    store.writeDevice(BOB, bob);
    store.writeLease(ALICE, LEASE);
    store.writeCleanup(BOB, CLEANUP);

    expect(store.readDevice(ALICE)?.keyId).toBe(alice.keyId);
    expect(store.readDevice(BOB)?.keyId).toBe(bob.keyId);
    expect(store.readLease(BOB)).toBeNull();
    expect(store.readCleanup(ALICE)).toBeNull();

    store.clearDevice(ALICE);
    expect(store.readDevice(ALICE)).toBeNull();
    expect(store.readDevice(BOB)?.keyId).toBe(bob.keyId);
  });

  it('replaces a row on a second write', () => {
    const db = openDb(binding);
    const store = createLicenceStore(db, fakeBox());
    store.writeDevice(ALICE, { ...device(), deviceId: null });
    store.writeDevice(ALICE, { ...(store.readDevice(ALICE) as DeviceRecord), deviceId: 'dev-0002' });

    expect(createLicenceStore(db, fakeBox()).readDevice(ALICE)?.deviceId).toBe('dev-0002');
    const count = db
      .prepare('SELECT COUNT(*) AS n FROM account_meta WHERE key = ?')
      .get(`premium_device_v1:${ALICE}`) as { n: number };
    expect(count.n).toBe(1);
  });

  it('reads absent when nothing was stored', () => {
    const db = openDb(binding);
    const store = createLicenceStore(db, fakeBox());
    expect(store.readDevice(ALICE)).toBeNull();
    expect(store.readLease(ALICE)).toBeNull();
    expect(store.readCleanup(ALICE)).toBeNull();
  });

  describe('a row that cannot be used is deleted and read as absent', () => {
    const rows = [
      ['device', 'premium_device_v1', (s: ReturnType<typeof createLicenceStore>) => s.readDevice(ALICE)],
      ['lease', 'premium_lease_v1', (s: ReturnType<typeof createLicenceStore>) => s.readLease(ALICE)],
      ['cleanup', 'premium_cleanup_v1', (s: ReturnType<typeof createLicenceStore>) => s.readCleanup(ALICE)],
    ] as const;

    it.each(rows)('%s: bytes the box cannot decrypt', (_kind, prefix, read) => {
      const db = openDb(binding);
      db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(`${prefix}:${ALICE}`, 'bm90LXNlYWxlZA==');
      const box = fakeBox({
        decrypt: () => {
          throw new Error('cannot decrypt');
        },
      });

      expect(read(createLicenceStore(db, box))).toBeNull();
      expect(rowValue(db, `${prefix}:${ALICE}`)).toBeUndefined();
    });

    it.each(rows)('%s: decrypts to something that is not the record', (_kind, prefix, read) => {
      const db = openDb(binding);
      const box = fakeBox();
      db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(
        `${prefix}:${ALICE}`,
        box.encrypt('{"unexpected":true}').toString('base64'),
      );

      expect(read(createLicenceStore(db, box))).toBeNull();
      expect(rowValue(db, `${prefix}:${ALICE}`)).toBeUndefined();
    });

    it.each(rows)('%s: decrypts to text that is not JSON', (_kind, prefix, read) => {
      const db = openDb(binding);
      const box = fakeBox();
      db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(
        `${prefix}:${ALICE}`,
        box.encrypt('not json').toString('base64'),
      );

      expect(read(createLicenceStore(db, box))).toBeNull();
      expect(rowValue(db, `${prefix}:${ALICE}`)).toBeUndefined();
    });

    it('device: a private key that is not PKCS#8', () => {
      const db = openDb(binding);
      const box = fakeBox();
      const good = device();
      db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(
        `premium_device_v1:${ALICE}`,
        box
          .encrypt(
            JSON.stringify({
              privateKeyPkcs8: 'AAAA',
              publicKeyRaw: good.publicKey,
              keyId: good.keyId,
              fingerprintSalt: null,
              deviceId: null,
            }),
          )
          .toString('base64'),
      );

      expect(createLicenceStore(db, box).readDevice(ALICE)).toBeNull();
      expect(rowValue(db, `premium_device_v1:${ALICE}`)).toBeUndefined();
    });

    it('leaves the other subject and the other kinds untouched when one row is deleted', () => {
      const db = openDb(binding);
      const store = createLicenceStore(db, fakeBox());
      store.writeLease(BOB, LEASE);
      store.writeCleanup(ALICE, CLEANUP);
      db.prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)').run(`premium_device_v1:${ALICE}`, 'AAAA');

      expect(store.readDevice(ALICE)).toBeNull();

      expect(store.readLease(BOB)).toEqual(LEASE);
      expect(store.readCleanup(ALICE)).toEqual(CLEANUP);
    });
  });

  describe('when the box is unavailable', () => {
    const unavailable = (): SecretBox => fakeBox({ isAvailable: () => false });

    it('writes nothing and answers unavailable, for each kind', () => {
      const db = openDb(binding);
      const store = createLicenceStore(db, unavailable());

      expect(store.writeDevice(ALICE, device())).toBe('unavailable');
      expect(store.writeLease(ALICE, LEASE)).toBe('unavailable');
      expect(store.writeCleanup(ALICE, CLEANUP)).toBe('unavailable');

      const count = db.prepare('SELECT COUNT(*) AS n FROM account_meta WHERE key LIKE ?').get('premium_%') as { n: number };
      expect(count.n).toBe(0);
    });

    it('answers unavailable when the box throws while sealing, and writes nothing', () => {
      const db = openDb(binding);
      const box = fakeBox({
        encrypt: () => {
          throw new Error('encryption failed');
        },
      });

      expect(createLicenceStore(db, box).writeDevice(ALICE, device())).toBe('unavailable');
      expect(rowValue(db, `premium_device_v1:${ALICE}`)).toBeUndefined();
    });

    it('reads absent but does not delete a stored row it merely cannot open yet', () => {
      const db = openDb(binding);
      createLicenceStore(db, fakeBox()).writeDevice(ALICE, device());

      expect(createLicenceStore(db, unavailable()).readDevice(ALICE)).toBeNull();
      expect(rowValue(db, `premium_device_v1:${ALICE}`)).toBeDefined();
    });
  });

  it('writes nothing and answers unavailable when there is no database', () => {
    const store = createLicenceStore(null, fakeBox());
    expect(store.writeDevice(ALICE, device())).toBe('unavailable');
    expect(store.readDevice(ALICE)).toBeNull();
  });
});
