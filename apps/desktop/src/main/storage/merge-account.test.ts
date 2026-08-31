import { describe, expect, it } from 'vitest';
import type { AccountPayload, AccountSection, RestoredAccount, SectionFidelity, StoredAccountFidelity } from '@bombfarm/contracts';
import { createAccountStore } from './account-store.js';
import { mergeStoredIntoLive } from './merge-account.js';
import { openTestAccountDb } from './test-support.js';

const RESOLVED = (capturedAt: string): SectionFidelity => ({ status: 'resolved', capturedAt });
const STALE_LIVE = (capturedAt: string): SectionFidelity => ({ status: 'stale', capturedAt });
const MISSING_LIVE: SectionFidelity = { status: 'missing' };

function storedFidelity(overrides: Partial<StoredAccountFidelity> = {}): StoredAccountFidelity {
  return {
    account: { status: 'missing' },
    heroes: { status: 'missing' },
    skills: { status: 'missing' },
    casa: { status: 'missing' },
    items: { status: 'missing' },
    ...overrides,
  };
}

function restoredAccount(payload: Partial<Record<AccountSection, unknown>>, fidelity: StoredAccountFidelity): RestoredAccount {
  return {
    status: 'ok',
    reason: null,
    gameRunning: false,
    payload: { ...payload, fidelity } as unknown as RestoredAccount['payload'],
  };
}

describe('mergeStoredIntoLive', () => {
  it('live resolved with a present body wins, served resolved with the live capturedAt', () => {
    const live: AccountPayload = {
      account: { phase: 9 },
      fidelity: { account: RESOLVED('live-t'), heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE },
    };
    const restored = restoredAccount(
      { account: { phase: 1 } },
      storedFidelity({ account: { status: 'stale', capturedAt: 'stored-t' } }),
    );

    const view = mergeStoredIntoLive(live, restored, { gameRunning: true, binding: 'node:sqlite' });

    expect(view.payload.fidelity?.account).toEqual({ status: 'resolved', capturedAt: 'live-t' });
    expect((view.payload as unknown as Record<string, unknown>).account).toEqual({ phase: 9 });
  });

  it('live resolved but body absent falls through to the stored value', () => {
    const live: AccountPayload = {
      // No `account` field even though fidelity claims resolved.
      fidelity: { account: RESOLVED('live-t'), heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE },
    };
    const restored = restoredAccount(
      { account: { phase: 5 } },
      storedFidelity({ account: { status: 'stale', capturedAt: 'stored-t' } }),
    );

    const view = mergeStoredIntoLive(live, restored, { gameRunning: true, binding: null });

    expect(view.payload.fidelity?.account).toEqual({ status: 'stale', capturedAt: 'stored-t' });
    expect((view.payload as unknown as Record<string, unknown>).account).toEqual({ phase: 5 });
  });

  for (const liveStatus of ['stale', 'missing'] as const) {
    it(`live ${liveStatus} with a stored row present takes the stored body and stored capturedAt`, () => {
      const liveFidelity: SectionFidelity = liveStatus === 'stale' ? STALE_LIVE('live-t') : MISSING_LIVE;
      const live: AccountPayload = {
        fidelity: { account: liveFidelity, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE },
      };
      const restored = restoredAccount(
        { account: { phase: 7 } },
        storedFidelity({ account: { status: 'stale', capturedAt: 'stored-t' } }),
      );

      const view = mergeStoredIntoLive(live, restored, { gameRunning: false, binding: 'node:sqlite' });

      expect(view.payload.fidelity?.account).toEqual({ status: 'stale', capturedAt: 'stored-t' });
      expect((view.payload as unknown as Record<string, unknown>).account).toEqual({ phase: 7 });
    });
  }

  it('nothing stored and nothing live resolves to missing with the body omitted', () => {
    const live: AccountPayload = {
      fidelity: { account: MISSING_LIVE, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE },
    };
    const restored = restoredAccount({}, storedFidelity());

    const view = mergeStoredIntoLive(live, restored, { gameRunning: false, binding: null });

    expect(view.payload.fidelity?.account).toEqual({ status: 'missing' });
    expect((view.payload as unknown as Record<string, unknown>).account).toBeUndefined();
  });

  it('a section that has never resolved is missing, distinct from stale', () => {
    const live: AccountPayload = {
      fidelity: { account: MISSING_LIVE, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE },
    };
    const restored = restoredAccount({}, storedFidelity());
    const view = mergeStoredIntoLive(live, restored, { gameRunning: false, binding: null });
    expect(view.payload.fidelity?.account.status).toBe('missing');
    expect(view.payload.fidelity?.account.status).not.toBe('stale');
  });

  it('a cast-in genuinely-unrecognized live status is served as stale from the store, not as resolved', () => {
    const unknownFidelity = { status: 'quantum' } as unknown as SectionFidelity;
    const live: AccountPayload = {
      account: { phase: 999 },
      fidelity: { account: unknownFidelity, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE },
    };
    const restored = restoredAccount(
      { account: { phase: 1 } },
      storedFidelity({ account: { status: 'stale', capturedAt: 'stored-t' } }),
    );

    const view = mergeStoredIntoLive(live, restored, { gameRunning: true, binding: 'node:sqlite' });

    expect(view.payload.fidelity?.account).toEqual({ status: 'stale', capturedAt: 'stored-t' });
    expect((view.payload as unknown as Record<string, unknown>).account).toEqual({ phase: 1 });
  });

  it('live degraded with only addedKeys (no missing key) wins over stored — carried through with its own status, missingKeys and addedKeys', () => {
    const degradedFidelity: SectionFidelity = {
      status: 'degraded',
      capturedAt: 'live-t',
      missingKeys: [],
      addedKeys: ['seasonal_flag'],
    };
    const live: AccountPayload = {
      casa: { field_size: 5, heroes: [], casa: { active_casa: 1 } },
      fidelity: { account: MISSING_LIVE, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: degradedFidelity, items: MISSING_LIVE },
    };
    const restored = restoredAccount(
      { casa: { field_size: 3, heroes: [], casa: { active_casa: 0 } } },
      storedFidelity({ casa: { status: 'stale', capturedAt: 'stored-t' } }),
    );

    const view = mergeStoredIntoLive(live, restored, { gameRunning: true, binding: 'node:sqlite' });

    expect(view.payload.fidelity?.casa).toEqual(degradedFidelity);
    expect((view.payload as unknown as Record<string, unknown>).casa).toEqual({
      field_size: 5,
      heroes: [],
      casa: { active_casa: 1 },
    });
  });

  it('live degraded with a missing key defers to a usable stored row — an incomplete body is not preferred, reported stale', () => {
    const degradedFidelity: SectionFidelity = {
      status: 'degraded',
      capturedAt: 'live-t',
      missingKeys: ['rescues_left'],
      addedKeys: ['seasonal_flag'],
    };
    const live: AccountPayload = {
      casa: { field_size: 5, heroes: [], casa: { active_casa: 1 } },
      fidelity: { account: MISSING_LIVE, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: degradedFidelity, items: MISSING_LIVE },
    };
    const restored = restoredAccount(
      { casa: { field_size: 3, heroes: [], casa: { active_casa: 0 } } },
      storedFidelity({ casa: { status: 'stale', capturedAt: 'stored-t' } }),
    );

    const view = mergeStoredIntoLive(live, restored, { gameRunning: true, binding: 'node:sqlite' });

    expect(view.payload.fidelity?.casa).toEqual({ status: 'stale', capturedAt: 'stored-t' });
    expect((view.payload as unknown as Record<string, unknown>).casa).toEqual({
      field_size: 3,
      heroes: [],
      casa: { active_casa: 0 },
    });
  });

  it('live degraded with a missing key and no usable stored row takes the live body anyway, still reported degraded', () => {
    const degradedFidelity: SectionFidelity = {
      status: 'degraded',
      capturedAt: 'live-t',
      missingKeys: ['rescues_left'],
      addedKeys: [],
    };
    const live: AccountPayload = {
      casa: { field_size: 5, heroes: [], casa: { active_casa: 1 } },
      fidelity: { account: MISSING_LIVE, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: degradedFidelity, items: MISSING_LIVE },
    };
    const restored = restoredAccount({}, storedFidelity());

    const view = mergeStoredIntoLive(live, restored, { gameRunning: true, binding: 'node:sqlite' });

    expect(view.payload.fidelity?.casa).toEqual(degradedFidelity);
    expect((view.payload as unknown as Record<string, unknown>).casa).toEqual({
      field_size: 5,
      heroes: [],
      casa: { active_casa: 1 },
    });
  });

  it('live degraded but body absent falls through to the stored value, same as live resolved but body absent', () => {
    const degradedFidelity: SectionFidelity = {
      status: 'degraded',
      capturedAt: 'live-t',
      missingKeys: ['rescues_left'],
      addedKeys: [],
    };
    const live: AccountPayload = {
      // No `casa` field even though fidelity claims degraded.
      fidelity: { account: MISSING_LIVE, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: degradedFidelity, items: MISSING_LIVE },
    };
    const restored = restoredAccount(
      { casa: { active_casa: 1 } },
      storedFidelity({ casa: { status: 'stale', capturedAt: 'stored-t' } }),
    );

    const view = mergeStoredIntoLive(live, restored, { gameRunning: true, binding: null });

    expect(view.payload.fidelity?.casa).toEqual({ status: 'stale', capturedAt: 'stored-t' });
    expect((view.payload as unknown as Record<string, unknown>).casa).toEqual({ active_casa: 1 });
  });

  it('serves sections in ACCOUNT_SECTIONS canonical order regardless of input key order', () => {
    const live: AccountPayload = {
      items: [{ id: 'i1' }],
      account: { phase: 1 },
      fidelity: {
        items: RESOLVED('t'),
        account: RESOLVED('t'),
        heroes: MISSING_LIVE,
        skills: MISSING_LIVE,
        casa: MISSING_LIVE,
      },
    };
    const restored = restoredAccount({}, storedFidelity());
    const view = mergeStoredIntoLive(live, restored, { gameRunning: true, binding: null });
    expect(Object.keys(view.payload.fidelity ?? {})).toEqual(['account', 'heroes', 'skills', 'casa', 'items']);
  });

  it('AccountView.store carries the restored status, reason and the given binding', () => {
    const live: AccountPayload = {
      fidelity: { account: MISSING_LIVE, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE },
    };
    const restored: RestoredAccount = {
      status: 'unavailable',
      reason: 'schema_too_new',
      gameRunning: false,
      payload: { fidelity: storedFidelity() },
    };
    const view = mergeStoredIntoLive(live, restored, { gameRunning: false, binding: 'better-sqlite3' });
    expect(view.store).toEqual({ status: 'unavailable', reason: 'schema_too_new', binding: 'better-sqlite3' });
  });

  it('carries gameRunning from opts, independent of live/stored data', () => {
    const live: AccountPayload = {
      fidelity: { account: MISSING_LIVE, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE },
    };
    const restored = restoredAccount({}, storedFidelity());
    expect(mergeStoredIntoLive(live, restored, { gameRunning: true, binding: null }).gameRunning).toBe(true);
    expect(mergeStoredIntoLive(live, restored, { gameRunning: false, binding: null }).gameRunning).toBe(false);
  });

  it('a payload with no fidelity block at all treats every section as not-resolved (falls to stored/missing)', () => {
    const live: AccountPayload = {};
    const restored = restoredAccount(
      { heroes: [{ id: 'h1' }] },
      storedFidelity({ heroes: { status: 'stale', capturedAt: 'stored-t' } }),
    );
    const view = mergeStoredIntoLive(live, restored, { gameRunning: false, binding: null });
    expect(view.payload.fidelity?.heroes).toEqual({ status: 'stale', capturedAt: 'stored-t' });
  });
});

describe('mergeStoredIntoLive — table-driven across all five sections', () => {
  const ARRAY_SECTIONS: AccountSection[] = ['heroes', 'items'];
  const sampleBody = (section: AccountSection, tag: string): unknown =>
    ARRAY_SECTIONS.includes(section) ? [{ id: tag }] : { tag };

  describe.each((['account', 'heroes', 'skills', 'casa', 'items'] as AccountSection[]).map((section) => ({ section })))(
    'section: $section',
    ({ section }) => {
      it('live resolved with a body wins over a stored value', () => {
        const liveBody = sampleBody(section, 'live');
        const storedBody = sampleBody(section, 'stored');
        const live: AccountPayload = {
          [section]: liveBody,
          fidelity: { account: MISSING_LIVE, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE, [section]: RESOLVED('live-t') },
        };
        const restored = restoredAccount({ [section]: storedBody }, storedFidelity({ [section]: { status: 'stale', capturedAt: 'stored-t' } }));

        const view = mergeStoredIntoLive(live, restored, { gameRunning: true, binding: null });

        expect(view.payload.fidelity?.[section]).toEqual({ status: 'resolved', capturedAt: 'live-t' });
        expect((view.payload as unknown as Record<string, unknown>)[section]).toEqual(liveBody);
      });

      it('live stale takes the stored body and the stored capturedAt', () => {
        const storedBody = sampleBody(section, 'stored');
        const live: AccountPayload = {
          fidelity: { account: MISSING_LIVE, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE, [section]: STALE_LIVE('live-t') },
        };
        const restored = restoredAccount({ [section]: storedBody }, storedFidelity({ [section]: { status: 'stale', capturedAt: 'stored-t' } }));

        const view = mergeStoredIntoLive(live, restored, { gameRunning: true, binding: null });

        expect(view.payload.fidelity?.[section]).toEqual({ status: 'stale', capturedAt: 'stored-t' });
        expect((view.payload as unknown as Record<string, unknown>)[section]).toEqual(storedBody);
      });

      it('nothing live and nothing stored resolves to missing with the body omitted', () => {
        const live: AccountPayload = {
          fidelity: { account: MISSING_LIVE, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE },
        };
        const restored = restoredAccount({}, storedFidelity());

        const view = mergeStoredIntoLive(live, restored, { gameRunning: false, binding: null });

        expect(view.payload.fidelity?.[section]).toEqual({ status: 'missing' });
        expect((view.payload as unknown as Record<string, unknown>)[section]).toBeUndefined();
      });
    },
  );
});

describe('mergeStoredIntoLive — purity', () => {
  it('is deterministic: identical inputs produce deep-equal outputs across repeated calls', () => {
    const live: AccountPayload = {
      account: { phase: 1 },
      fidelity: { account: RESOLVED('t'), heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE },
    };
    const restored = restoredAccount({}, storedFidelity());
    const first = mergeStoredIntoLive(live, restored, { gameRunning: true, binding: 'node:sqlite' });
    const second = mergeStoredIntoLive(live, restored, { gameRunning: true, binding: 'node:sqlite' });
    expect(first).toEqual(second);
  });
});

describe('createAccountStore().commit()', () => {
  it('persists resolved sections, then serves resolved-live over stale-stored and missing for the rest', () => {
    const open = openTestAccountDb('node:sqlite');
    const store = createAccountStore(open);

    // First poll: resolve account and heroes fully.
    store.commit(
      {
        account: { phase: 1 },
        heroes: [{ id: 'h1' }],
        fidelity: {
          account: RESOLVED('t1'),
          heroes: RESOLVED('t1'),
          skills: MISSING_LIVE,
          casa: MISSING_LIVE,
          items: MISSING_LIVE,
        },
      },
      { gameRunning: true },
    );

    // Second poll: only account resolves again; heroes was not read this time; skills/casa/items
    // have never resolved.
    const view = store.commit(
      {
        account: { phase: 2 },
        fidelity: {
          account: RESOLVED('t2'),
          heroes: MISSING_LIVE,
          skills: MISSING_LIVE,
          casa: MISSING_LIVE,
          items: MISSING_LIVE,
        },
      },
      { gameRunning: true },
    );

    expect(view.payload.fidelity?.account).toEqual({ status: 'resolved', capturedAt: 't2' });
    expect((view.payload as unknown as Record<string, unknown>).account).toEqual({ phase: 2 });

    expect(view.payload.fidelity?.heroes).toEqual({ status: 'stale', capturedAt: 't1' });
    expect((view.payload as unknown as Record<string, unknown>).heroes).toEqual([{ id: 'h1' }]);

    expect(view.payload.fidelity?.skills).toEqual({ status: 'missing' });
    expect(view.payload.fidelity?.casa).toEqual({ status: 'missing' });
    expect(view.payload.fidelity?.items).toEqual({ status: 'missing' });

    expect(view.gameRunning).toBe(true);
    expect(view.store.status).toBe('ok');
    store.close();
  });

  it('commit reports gameRunning false when the caller says the game is not running', () => {
    const open = openTestAccountDb('node:sqlite');
    const store = createAccountStore(open);
    const view = store.commit(
      { fidelity: { account: MISSING_LIVE, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE } },
      { gameRunning: false },
    );
    expect(view.gameRunning).toBe(false);
    store.close();
  });

  /**
   * This test used to be named for a persist-then-restore round trip it never performed. A
   * drifted section is deliberately not written (`persist` allow-lists `resolved` alone), so
   * restore returns nothing for it and the merge serves the live body — which is what actually
   * makes the drifted body reach the view. Named as a round trip, it read as the proof that
   * degraded sections survive storage, and it passed with `persist()` deleted. The pass-through
   * is asserted here; the non-persistence it depends on is pinned in the test below.
   */
  it('a drifted casa body reaches the committed view from the live payload: its body, missingKeys and addedKeys all survive the merge', () => {
    const open = openTestAccountDb('node:sqlite');
    const store = createAccountStore(open);

    const view = store.commit(
      {
        casa: { field_size: 5, heroes: [], casa: { active_casa: 1 }, rescues_left: 2, rescues_max: 3 },
        fidelity: {
          account: MISSING_LIVE,
          heroes: MISSING_LIVE,
          skills: MISSING_LIVE,
          casa: { status: 'degraded', capturedAt: 't1', missingKeys: [], addedKeys: ['seasonal_flag'] },
          items: MISSING_LIVE,
        },
      },
      { gameRunning: true },
    );

    expect(view.payload.fidelity?.casa).toEqual({
      status: 'degraded',
      capturedAt: 't1',
      missingKeys: [],
      addedKeys: ['seasonal_flag'],
    });
    expect((view.payload as unknown as Record<string, unknown>).casa).toEqual({
      field_size: 5,
      heroes: [],
      casa: { active_casa: 1 },
      rescues_left: 2,
      rescues_max: 3,
    });
    store.close();
  });

  /**
   * The other half of the test above, and the reason it cannot be read as a storage proof:
   * `persist` writes `resolved` sections alone, so a drifted body is never stored and a later
   * restore cannot serve it. Asserted rather than assumed — without this, deleting `persist()`
   * changes no test outcome anywhere in this file.
   */
  it('a drifted section that lost no key is written and served stale later, so a game update that only adds a field does not cost the last-known-good', () => {
    const open = openTestAccountDb('node:sqlite');
    const store = createAccountStore(open);
    const body = { field_size: 5, heroes: [], casa: { active_casa: 1 }, rescues_left: 2, rescues_max: 3 };

    const written = store.persist({
      casa: body,
      fidelity: {
        account: MISSING_LIVE,
        heroes: MISSING_LIVE,
        skills: MISSING_LIVE,
        casa: { status: 'degraded', capturedAt: 't1', missingKeys: [], addedKeys: ['seasonal_flag'] },
        items: MISSING_LIVE,
      },
    });

    expect(written.written).toEqual(['casa']);

    const restored = store.restore();
    expect((restored.payload as unknown as Record<string, unknown>).casa).toEqual(body);
    expect(restored.payload.fidelity.casa).toEqual({ status: 'stale', capturedAt: 't1' });
    store.close();
  });

  it('a drifted section that lost a key is still not written, so a body that may carry a substituted default never becomes the fallback', () => {
    const open = openTestAccountDb('node:sqlite');
    const store = createAccountStore(open);

    const written = store.persist({
      casa: { field_size: 5, heroes: [], casa: { active_casa: 1 }, rescues_left: 2, rescues_max: 3 },
      fidelity: {
        account: MISSING_LIVE,
        heroes: MISSING_LIVE,
        skills: MISSING_LIVE,
        casa: { status: 'degraded', capturedAt: 't1', missingKeys: ['casa.rescues_max'], addedKeys: [] },
        items: MISSING_LIVE,
      },
    });

    expect(written.written).toEqual([]);

    const restored = store.restore();
    expect((restored.payload as unknown as Record<string, unknown>).casa).toBeUndefined();
    store.close();
  });
});
