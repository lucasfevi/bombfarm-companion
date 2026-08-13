import { beforeAll, describe, expect, it } from 'vitest';
import type { AccountPayload, SectionFidelity } from '@bombfarm/contracts';
import { createAccountStore } from './account-store.js';
import { detectAvailableBindings, openTestAccountDb, warnForUnavailableBindings } from './test-support.js';

const AVAILABLE_BINDINGS = detectAvailableBindings();

beforeAll(() => {
  warnForUnavailableBindings(AVAILABLE_BINDINGS);
});

const RESOLVED = (capturedAt: string): SectionFidelity => ({ status: 'resolved', capturedAt });
const MISSING: SectionFidelity = { status: 'missing' };

function fixturePayload(capturedAt: string): AccountPayload {
  return {
    account: { phase: 3 },
    fidelity: {
      account: RESOLVED(capturedAt),
      heroes: MISSING,
      skills: MISSING,
      casa: MISSING,
      items: MISSING,
    },
  };
}

/**
 * Regression coverage for fix/fixture-tick-after-db-close: a late producer call landing after
 * `close()` (a fixture tick that fired despite `GameReaderService.stop()`, an account-refresh
 * cycle resuming after an abort) must never throw the SQLite driver's raw "database is not
 * open" — every entry point on a closed store degrades to a quiet no-op instead.
 */
describe('createAccountStore() — calls after close()', () => {
  it('ran against at least one SQLite binding', () => {
    expect(AVAILABLE_BINDINGS.length).toBeGreaterThan(0);
  });

  describe.each(AVAILABLE_BINDINGS.map((binding) => ({ binding })))('binding: $binding', ({ binding }) => {
    it('persist() after close() does not throw "database is not open" — it writes nothing', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);
      store.close();

      let result: ReturnType<typeof store.persist> | undefined;
      expect(() => {
        result = store.persist(fixturePayload('2026-08-13T00:00:00.000Z'));
      }).not.toThrow();
      expect(result).toEqual({ written: [] });
    });

    it('restore() after close() does not throw — it reports unavailable, not "ok" from a stale binding', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);
      store.close();

      let restored: ReturnType<typeof store.restore> | undefined;
      expect(() => {
        restored = store.restore();
      }).not.toThrow();
      expect(restored?.status).toBe('unavailable');
      expect(restored?.gameRunning).toBe(false);
    });

    it('commit() after close() — the exact call shape a fixture tick or account-refresh cycle makes — does not throw', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);
      store.close();

      expect(() => {
        store.commit(fixturePayload('2026-08-13T00:00:00.000Z'), { gameRunning: true });
      }).not.toThrow();
    });

    it('close() itself is idempotent — calling it twice does not throw', () => {
      const open = openTestAccountDb(binding);
      const store = createAccountStore(open);
      store.close();
      expect(() => {
        store.close();
      }).not.toThrow();
    });
  });
});
