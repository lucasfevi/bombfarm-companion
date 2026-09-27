import { describe, expect, it } from 'vitest';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from '../storage/test-support.js';
import { createInstallIdStore } from './install-id-store.js';

const availableBindings = detectAvailableBindings();
warnForUnavailableBindings(availableBindings);

const FIRST = '11111111-1111-4111-8111-111111111111';
const SECOND = '22222222-2222-4222-8222-222222222222';

function idsFrom(...ids: string[]): () => string {
  const queue = [...ids];
  return () => {
    const next = queue.shift();
    if (next === undefined) throw new Error('minted more ids than the test expected');
    return next;
  };
}

describe.each(availableBindings)('createInstallIdStore over the real account_meta table (%s)', (binding) => {
  it('mints one id and keeps returning it', () => {
    const open = openTestAccountDb(binding);
    const store = createInstallIdStore(open.db, idsFrom(FIRST));

    expect(store.ensure()).toBe(FIRST);
    expect(store.ensure()).toBe(FIRST);
  });

  it('a restart reads the same id back instead of minting a new one', () => {
    const open = openTestAccountDb(binding);
    createInstallIdStore(open.db, idsFrom(FIRST)).ensure();

    const afterRestart = createInstallIdStore(open.db, idsFrom());

    expect(afterRestart.ensure()).toBe(FIRST);
  });

  it('clear() deletes the stored id, so opting back in starts an unlinked history', () => {
    const open = openTestAccountDb(binding);
    const store = createInstallIdStore(open.db, idsFrom(FIRST, SECOND));
    store.ensure();

    store.clear();

    if (!open.db) throw new Error('expected an open db for this binding');
    const row = open.db.prepare('SELECT value FROM account_meta WHERE key = ?').get('usage_install_id_v1');
    expect(row).toBeUndefined();
    expect(store.ensure()).toBe(SECOND);
    expect(createInstallIdStore(open.db, idsFrom()).ensure()).toBe(SECOND);
  });

  it('a corrupt stored value is replaced rather than sent', () => {
    const open = openTestAccountDb(binding);
    if (!open.db) throw new Error('expected an open db for this binding');
    open.db
      .prepare('INSERT INTO account_meta (key, value) VALUES (?, ?)')
      .run('usage_install_id_v1', 'not-a-uuid');

    expect(createInstallIdStore(open.db, idsFrom(FIRST)).ensure()).toBe(FIRST);
  });
});

describe('createInstallIdStore without a database', () => {
  it('still gives the session one stable id', () => {
    const store = createInstallIdStore(null, idsFrom(FIRST));

    expect(store.ensure()).toBe(FIRST);
    expect(store.ensure()).toBe(FIRST);
  });
});
