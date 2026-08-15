/**
 * The rankMode migration: absent -> 'farm', the retired 'oneshot' -> 'farm', a stored 'dps'
 * respected as a deliberate past choice, and any unrecognized value -> 'farm' without throwing.
 * Each fixture is a WHOLE raw `bf-hp-account-v1` payload run through the real load path
 * (loadAccountShared), not a direct normalizeAccount call, and each also asserts an unrelated
 * stored field survives — the "must not discard unrelated stored fields" half of the migration
 * a rankMode-only assertion would miss.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAccountShared, saveAccountShared, normalizeAccount, type AccountShared } from '@/shared/lib/storage';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { selectAccountShared } from '@/shared/stores/selectors/account-selectors';

const ACCOUNT_KEY = 'bf-hp-account-v1';

function memoryLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
}

/** A whole `bf-hp-account-v1` payload with an explicit `slots`/`maxPhase` so each fixture can
 *  also prove an unrelated field survives the migration. */
function accountPayloadJson(rankModeJsonFragment: string): string {
  return (
    '{"tree":{"danoTotal":1.2,"critChance":5,"critDmg":10,"speed":3,"energy":4,"teamCoinPct":7,"luckFlatPct":6},' +
    '"teamBuffs":{"grito_guerra":2},' +
    `"context":{"houseIdx":1,"houseLevel":3,"phase":40,"mitigationPct":0.9,${rankModeJsonFragment},"targetProp":"prop_a"},` +
    '"slots":7,"forgeFloor":15,"maxPhase":123}'
  );
}

describe('rankMode storage migration', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('field absent -> farm; slots/maxPhase survive', () => {
    // The fragment below intentionally carries NO rankMode key at all.
    localStorage.setItem(ACCOUNT_KEY, accountPayloadJson('"__noRankModeKey":true'));
    const account = loadAccountShared();
    expect(account.context.rankMode).toBe('farm');
    expect(account.slots).toBe(7);
    expect(account.maxPhase).toBe(123);
  });

  it('stored "oneshot" -> farm; slots/maxPhase survive', () => {
    localStorage.setItem(ACCOUNT_KEY, accountPayloadJson('"rankMode":"oneshot"'));
    const account = loadAccountShared();
    expect(account.context.rankMode).toBe('farm');
    expect(account.slots).toBe(7);
    expect(account.maxPhase).toBe(123);
  });

  it('stored "dps" is respected as a deliberate past choice; slots/maxPhase survive', () => {
    localStorage.setItem(ACCOUNT_KEY, accountPayloadJson('"rankMode":"dps"'));
    const account = loadAccountShared();
    expect(account.context.rankMode).toBe('dps');
    expect(account.slots).toBe(7);
    expect(account.maxPhase).toBe(123);
  });

  it.each([
    ['a junk string', '"rankMode":"nonsense"'],
    ['a number', '"rankMode":42'],
    ['null', '"rankMode":null'],
    ['an object', '"rankMode":{}'],
  ])('unrecognized rankMode (%s) -> farm, without throwing; slots/maxPhase survive', (_label, fragment) => {
    localStorage.setItem(ACCOUNT_KEY, accountPayloadJson(fragment));
    let account!: AccountShared;
    expect(() => {
      account = loadAccountShared();
    }).not.toThrow();
    expect(account.context.rankMode).toBe('farm');
    expect(account.slots).toBe(7);
    expect(account.maxPhase).toBe(123);
  });

  it('is idempotent: re-normalizing an already-migrated ("farm") record is a no-op', () => {
    const once = normalizeAccount({ context: { rankMode: 'farm' } } as Partial<AccountShared>);
    const twice = normalizeAccount(once);
    expect(twice.context.rankMode).toBe('farm');
    expect(twice).toEqual(once);
  });

  it('no storage-key bump: the migrated record still lives under bf-hp-account-v1', () => {
    localStorage.setItem(ACCOUNT_KEY, accountPayloadJson('"rankMode":"oneshot"'));
    loadAccountShared();
    expect(localStorage.getItem('bf-hp-account-v2')).toBeNull();
    expect(localStorage.getItem(ACCOUNT_KEY)).not.toBeNull();
  });

  it('a plain load does not eagerly rewrite storage — a read must not write', () => {
    const raw = accountPayloadJson('"rankMode":"oneshot"');
    localStorage.setItem(ACCOUNT_KEY, raw);
    loadAccountShared();
    // The stored bytes are byte-for-byte unchanged: still "oneshot" on disk.
    expect(localStorage.getItem(ACCOUNT_KEY)).toBe(raw);
  });

  it("the normalized value reaches disk on the next ordinary save: saveAccountShared(selectAccountShared(state)) writes 'farm' after a hydrate from an 'oneshot' payload", () => {
    resetPlannerStoreForTests();
    localStorage.setItem(ACCOUNT_KEY, accountPayloadJson('"rankMode":"oneshot"'));
    const hydrated = loadAccountShared();
    expect(hydrated.context.rankMode).toBe('farm');

    usePlannerStore.getState().hydrateAccount(hydrated);
    const shared = selectAccountShared(usePlannerStore.getState());
    expect(shared.context.rankMode).toBe('farm');

    saveAccountShared(shared);
    const persisted = localStorage.getItem(ACCOUNT_KEY);
    expect(persisted).not.toBeNull();
    expect(JSON.parse(persisted!).context.rankMode).toBe('farm');

    resetPlannerStoreForTests();
  });
});
