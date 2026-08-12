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

  it('a cast-in future live status (e.g. degraded) is served as stale from the store, not as resolved', () => {
    const degradedFidelity = { status: 'degraded' } as unknown as SectionFidelity;
    const live: AccountPayload = {
      account: { phase: 999 },
      fidelity: { account: degradedFidelity, heroes: MISSING_LIVE, skills: MISSING_LIVE, casa: MISSING_LIVE, items: MISSING_LIVE },
    };
    const restored = restoredAccount(
      { account: { phase: 1 } },
      storedFidelity({ account: { status: 'stale', capturedAt: 'stored-t' } }),
    );

    const view = mergeStoredIntoLive(live, restored, { gameRunning: true, binding: 'node:sqlite' });

    expect(view.payload.fidelity?.account).toEqual({ status: 'stale', capturedAt: 'stored-t' });
    expect((view.payload as unknown as Record<string, unknown>).account).toEqual({ phase: 1 });
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
});
