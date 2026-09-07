import { beforeAll, describe, expect, it } from 'vitest';
import { EMPTY_FORGE_HISTORY } from '@bombfarm/contracts';
import { SCHEMA_VERSION } from '../storage/account-schema.js';
import type { SqliteBinding } from '../storage/index.js';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../storage/test-support.js';
import { createForgeHistory, type ForgeRunRecord } from './forge-history.js';

const AVAILABLE_BINDINGS = detectAvailableBindings();

beforeAll(() => {
  warnForUnavailableBindings(AVAILABLE_BINDINGS);
});

function firstBinding(): SqliteBinding {
  const binding = AVAILABLE_BINDINGS[0];
  if (!binding) throw new Error('no SQLite binding available in this environment — cannot run this suite');
  return binding;
}

function record(overrides: Partial<ForgeRunRecord> = {}): ForgeRunRecord {
  return {
    startedAt: '2026-09-05T10:00:00.000Z',
    finishedAt: '2026-09-05T10:00:30.000Z',
    accountId: '486',
    itemId: 'g1',
    defId: 'steel_luva',
    rarity: 1,
    slot: 2,
    itemLevel: 20,
    fromUpgrade: 8,
    toUpgrade: 10,
    target: 10,
    stop: 'target',
    reached: true,
    rolls: 3,
    fails: 1,
    crits: 0,
    safeJumps: 0,
    spent: 300,
    walletAfter: 999_700,
    durationMs: 30_000,
    ...overrides,
  };
}

describe('forge ledger', () => {
  it('creates its table beside the account tables without moving the schema version', () => {
    const open = openTestAccountDb(firstBinding());
    createForgeHistory(open.db);
    const stored = open.db?.prepare('SELECT value FROM account_meta WHERE key = ?').get('schema_version') as { value: string } | undefined;
    expect(stored?.value).toBe(String(SCHEMA_VERSION));
    const table = open.db?.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'forge_runs'").get();
    expect(table).toEqual({ name: 'forge_runs' });
  });

  it('lists newest first with totals, round-trips every column, and clears', () => {
    const open = openTestAccountDb(firstBinding());
    const history = createForgeHistory(open.db);
    history.append(record());
    history.append(record({ itemId: 'g2', stop: 'cancelled', reached: false, toUpgrade: 9, rolls: 2, fails: 0, spent: 200, walletAfter: null, slot: null }));

    const listed = history.list({ limit: 10 });
    expect(listed.rows.map((row) => row.itemId)).toEqual(['g2', 'g1']);
    expect(listed.rows[1]).toEqual({ id: 1, ...record() });
    expect(listed.rows[0]).toMatchObject({ id: 2, stop: 'cancelled', reached: false, walletAfter: null, slot: null });
    expect(listed.totals).toEqual({ runs: 2, spent: 500, rolls: 5, fails: 1 });

    expect(history.list({ limit: 1 }).rows).toHaveLength(1);

    history.clear();
    expect(history.list({ limit: 10 })).toEqual(EMPTY_FORGE_HISTORY);
  });

  it('is inert without a database', () => {
    const history = createForgeHistory(null);
    history.append(record());
    expect(history.list({ limit: 10 })).toEqual(EMPTY_FORGE_HISTORY);
    expect(() => {
      history.clear();
    }).not.toThrow();
  });
});
