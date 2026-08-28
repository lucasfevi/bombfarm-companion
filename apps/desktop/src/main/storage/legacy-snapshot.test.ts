import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAccountStore } from './account-store.js';
import type { FsPort } from './legacy-snapshot.js';
import { readLegacySnapshotPayload } from './legacy-snapshot.js';
import { openTestAccountDb } from './test-support.js';

function fakeFs(files: Record<string, string>): FsPort {
  return {
    existsSync: (p) => Object.prototype.hasOwnProperty.call(files, p),
    readFileSync: (p) => {
      const content = files[p];
      if (content === undefined) throw new Error(`ENOENT: ${p}`);
      return content;
    },
  };
}

const USER_DATA_DIR = '/fake/user-data';
const SNAPSHOT_PATH = path.join(USER_DATA_DIR, 'last-snapshot.json');

const LEGACY_JSON = JSON.stringify({
  status: { status: 'connected', updatedAt: '2026-08-01T00:00:00.000Z' },
  mapped: { takenAt: '2026-08-02T00:00:00.000Z', source: 'live', gold: 100, bagTabs: 1, bagCapacity: 10, items: [], heroes: [] },
  raw: {
    state: { t: 'phase1', gold: '100', phase: 3 },
    inventory: { items: [{ id: 'i1', def_id: 'd1' }] },
  },
});

describe('readLegacySnapshotPayload', () => {
  it('imports state and inventory items once, stamped from the snapshot', () => {
    const result = readLegacySnapshotPayload(USER_DATA_DIR, fakeFs({ [SNAPSHOT_PATH]: LEGACY_JSON }));
    expect(result).not.toBeNull();
    expect(result?.payload.account).toEqual({ t: 'phase1', gold: '100', phase: 3 });
    expect(result?.payload.items).toEqual([{ id: 'i1', def_id: 'd1' }]);
    expect(result?.payload.fidelity.account).toEqual({ status: 'resolved', capturedAt: '2026-08-02T00:00:00.000Z' });
    expect(result?.payload.fidelity.items).toEqual({ status: 'resolved', capturedAt: '2026-08-02T00:00:00.000Z' });
  });

  it('leaves heroes/skills/casa missing rather than fabricating them', () => {
    const result = readLegacySnapshotPayload(USER_DATA_DIR, fakeFs({ [SNAPSHOT_PATH]: LEGACY_JSON }));
    expect(result?.payload.fidelity.heroes).toEqual({ status: 'missing' });
    expect(result?.payload.fidelity.skills).toEqual({ status: 'missing' });
    expect(result?.payload.fidelity.casa).toEqual({ status: 'missing' });
    expect(result?.payload.heroes).toBeUndefined();
    expect(result?.payload.skills).toBeUndefined();
    expect(result?.payload.casa).toBeUndefined();
  });

  it('falls back to status.updatedAt when mapped.takenAt is absent', () => {
    const json = JSON.stringify({
      status: { status: 'connected', updatedAt: '2026-07-01T00:00:00.000Z' },
      mapped: null,
      raw: { state: { phase: 1 }, inventory: null },
    });
    const result = readLegacySnapshotPayload(USER_DATA_DIR, fakeFs({ [SNAPSHOT_PATH]: json }));
    expect(result?.payload.fidelity.account).toEqual({ status: 'resolved', capturedAt: '2026-07-01T00:00:00.000Z' });
  });

  it('returns null when no file exists', () => {
    expect(readLegacySnapshotPayload(USER_DATA_DIR, fakeFs({}))).toBeNull();
  });

  it('returns null for unparsable JSON', () => {
    expect(readLegacySnapshotPayload(USER_DATA_DIR, fakeFs({ [SNAPSHOT_PATH]: '{not json' }))).toBeNull();
  });

  for (const badPayload of ['null', '42', '"a string"', '[1,2,3]']) {
    it(`returns null for a non-object payload (${badPayload})`, () => {
      expect(readLegacySnapshotPayload(USER_DATA_DIR, fakeFs({ [SNAPSHOT_PATH]: badPayload }))).toBeNull();
    });
  }

  it('skips the import when no ISO timestamp is available anywhere', () => {
    const json = JSON.stringify({
      status: { status: 'connected', updatedAt: 'not-a-date' },
      mapped: { takenAt: 'also-not-a-date' },
      raw: { state: { phase: 1 }, inventory: null },
    });
    expect(readLegacySnapshotPayload(USER_DATA_DIR, fakeFs({ [SNAPSHOT_PATH]: json }))).toBeNull();
  });

  it('returns null when neither raw.state nor raw.inventory.items has anything importable', () => {
    const json = JSON.stringify({
      status: { status: 'connected', updatedAt: '2026-08-01T00:00:00.000Z' },
      mapped: null,
      raw: { state: null, inventory: null },
    });
    expect(readLegacySnapshotPayload(USER_DATA_DIR, fakeFs({ [SNAPSHOT_PATH]: json }))).toBeNull();
  });

  it('imports only the account section when inventory items are absent', () => {
    const json = JSON.stringify({
      status: { status: 'connected', updatedAt: '2026-08-01T00:00:00.000Z' },
      mapped: null,
      raw: { state: { phase: 1 }, inventory: null },
    });
    const result = readLegacySnapshotPayload(USER_DATA_DIR, fakeFs({ [SNAPSHOT_PATH]: json }));
    expect(result?.payload.account).toEqual({ phase: 1 });
    expect(result?.payload.items).toBeUndefined();
    expect(result?.payload.fidelity.items).toEqual({ status: 'missing' });
  });

  it('imports only the items section when raw.state is absent', () => {
    const json = JSON.stringify({
      status: { status: 'connected', updatedAt: '2026-08-01T00:00:00.000Z' },
      mapped: null,
      raw: { state: null, inventory: { items: [{ id: 'i1' }] } },
    });
    const result = readLegacySnapshotPayload(USER_DATA_DIR, fakeFs({ [SNAPSHOT_PATH]: json }));
    expect(result?.payload.items).toEqual([{ id: 'i1' }]);
    expect(result?.payload.account).toBeUndefined();
    expect(result?.payload.fidelity.account).toEqual({ status: 'missing' });
  });
});

describe('createAccountStore — legacy import at construction', () => {
  it('imports state and inventory items once; restore() serves them stale with the legacy timestamp', () => {
    const open = openTestAccountDb('node:sqlite');
    const store = createAccountStore(open, {
      userDataDir: USER_DATA_DIR,
      legacyFs: fakeFs({ [SNAPSHOT_PATH]: LEGACY_JSON }),
    });

    const restored = store.restore();
    expect(restored.status).toBe('ok');
    expect(restored.payload.fidelity.account).toEqual({ status: 'stale', capturedAt: '2026-08-02T00:00:00.000Z' });
    expect(restored.payload.fidelity.items).toEqual({ status: 'stale', capturedAt: '2026-08-02T00:00:00.000Z' });
    expect((restored.payload as unknown as Record<string, unknown>).account).toEqual({ t: 'phase1', gold: '100', phase: 3 });
    store.close();
  });

  it('leaves heroes/skills/casa missing rather than fabricating them (end to end)', () => {
    const open = openTestAccountDb('node:sqlite');
    const store = createAccountStore(open, {
      userDataDir: USER_DATA_DIR,
      legacyFs: fakeFs({ [SNAPSHOT_PATH]: LEGACY_JSON }),
    });
    const restored = store.restore();
    expect(restored.payload.fidelity.heroes).toEqual({ status: 'missing' });
    expect(restored.payload.fidelity.skills).toEqual({ status: 'missing' });
    expect(restored.payload.fidelity.casa).toEqual({ status: 'missing' });
    store.close();
  });

  it('does not import when the section table is non-empty', () => {
    const first = openTestAccountDb('node:sqlite', ':memory:');
    if (!first.db) throw new Error('expected a usable db');
    first.db
      .prepare('INSERT INTO account_section (account_key, section, body, captured_at) VALUES (?, ?, ?, ?)')
      .run('', 'account', '{"already":"here"}', '2026-01-01T00:00:00.000Z');

    const store = createAccountStore(first, {
      userDataDir: USER_DATA_DIR,
      legacyFs: fakeFs({ [SNAPSHOT_PATH]: LEGACY_JSON }),
    });
    const restored = store.restore();
    // The pre-existing row survives untouched; the legacy file's different body never landed.
    expect((restored.payload as unknown as Record<string, unknown>).account).toEqual({ already: 'here' });
    expect(restored.payload.fidelity.items).toEqual({ status: 'missing' });
    store.close();
  });

  it('does not import twice — a second store construction against the same db does not re-read the file', () => {
    const dbPathOpen = openTestAccountDb('node:sqlite');
    if (!dbPathOpen.db) throw new Error('expected a usable db');

    let readCount = 0;
    const countingFs: FsPort = {
      existsSync: () => true,
      readFileSync: () => {
        readCount += 1;
        return LEGACY_JSON;
      },
    };

    createAccountStore(dbPathOpen, { userDataDir: USER_DATA_DIR, legacyFs: countingFs });
    expect(readCount).toBe(1);

    // A second store construction over the same still-open db must see the
    // legacy_snapshot_migrated flag and skip re-reading the file entirely.
    const second = createAccountStore(dbPathOpen, { userDataDir: USER_DATA_DIR, legacyFs: countingFs });
    expect(readCount).toBe(1);
    second.close();
  });

  it('does not import when no userDataDir dependency is given', () => {
    const open = openTestAccountDb('node:sqlite');
    const store = createAccountStore(open);
    const restored = store.restore();
    expect(restored.status).toBe('unavailable');
    expect(restored.reason).toBe('empty');
    store.close();
  });

  it('skips the import end-to-end when no ISO timestamp is available, leaving the store empty', () => {
    const json = JSON.stringify({
      status: { status: 'connected', updatedAt: 'not-a-date' },
      mapped: null,
      raw: { state: { phase: 1 }, inventory: null },
    });
    const open = openTestAccountDb('node:sqlite');
    const store = createAccountStore(open, { userDataDir: USER_DATA_DIR, legacyFs: fakeFs({ [SNAPSHOT_PATH]: json }) });
    const restored = store.restore();
    expect(restored.status).toBe('unavailable');
    expect(restored.reason).toBe('empty');
    store.close();
  });
});

describe('source guard: no module under apps/desktop/src writes last-snapshot.json', () => {
  // The one sanctioned mention is in a comment/read in legacy-snapshot.ts (the reader) and
  // account-store.ts (the one-time-import orchestrator, which only ever calls the reader and
  // never itself opens the file) — neither writes it. Any other file naming the legacy
  // filename is a reintroduced writer/reader and must fail this guard.
  const SANCTIONED_FILES = ['legacy-snapshot.ts', 'account-store.ts'];

  it('no file writes to fs.writeFileSync/fs.write with the legacy filename', () => {
    const srcDir = path.resolve(__dirname, '..', '..');
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
        const content = fs.readFileSync(full, 'utf8');
        const mentionsWrite = /writeFileSync|\.write\(/.test(content) && content.includes('last-snapshot.json');
        if (mentionsWrite) {
          offenders.push(full);
        }
      }
    };
    walk(srcDir);

    expect(offenders).toEqual([]);
  });

  it('no unsanctioned file even mentions the legacy filename', () => {
    const srcDir = path.resolve(__dirname, '..', '..');
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
          continue;
        }
        if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts')) continue;
        if (SANCTIONED_FILES.includes(entry.name)) continue;
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes('last-snapshot.json')) {
          offenders.push(full);
        }
      }
    };
    walk(srcDir);

    expect(offenders).toEqual([]);
  });
});
