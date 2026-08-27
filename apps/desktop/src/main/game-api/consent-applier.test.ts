import { CONSENT_TEXT_VERSION } from '@bombfarm/game-api';
import type { ConsentEvent, ConsentRecord } from '@bombfarm/game-api';
import type { AppLocale } from '@bombfarm/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createConsentApplier, type ConsentApplierDeps } from './consent-applier.js';

const GRANTED_AT = '2026-08-12T13:15:38.000Z';
const LOCALE: AppLocale = 'en';

const GRANTED: ConsentRecord = { decision: 'granted', grantedAt: GRANTED_AT, textVersion: CONSENT_TEXT_VERSION };
const UNASKED: ConsentRecord = { decision: 'unasked', textVersion: CONSENT_TEXT_VERSION };
const REVOKED: ConsentRecord = { decision: 'revoked', textVersion: CONSENT_TEXT_VERSION };
const STALE_GRANT: ConsentRecord = {
  decision: 'granted',
  grantedAt: GRANTED_AT,
  textVersion: CONSENT_TEXT_VERSION - 1,
};

const REVOKE_EVENT: ConsentEvent = { type: 'revoke' };
const DECLINE_EVENT: ConsentEvent = { type: 'decline', locale: LOCALE };
const ACCEPT_EVENT: ConsentEvent = { type: 'accept', now: GRANTED_AT, locale: LOCALE };

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function buildDeps(record: ConsentRecord, overrides: Partial<ConsentApplierDeps> = {}): ConsentApplierDeps {
  return {
    read: () => record,
    write: vi.fn(),
    beforeLosingConsent: [],
    afterApplied: [],
    ...overrides,
  };
}

describe('createConsentApplier', () => {
  it('runs the pre-persist hook to completion before writing the transition for a revoke from granted', async () => {
    const { promise, resolve } = deferred<undefined>();
    const hook = vi.fn(() => promise);
    const write = vi.fn();
    const applier = createConsentApplier(buildDeps(GRANTED, { beforeLosingConsent: [hook], write }));

    const applied = applier(REVOKE_EVENT);

    await Promise.resolve();
    await Promise.resolve();
    expect(hook).toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();

    resolve(undefined);
    await applied;

    expect(write).toHaveBeenCalledWith({ decision: 'revoked', textVersion: CONSENT_TEXT_VERSION });
  });

  it('runs the pre-persist hook for a decline from granted, not only for a revoke', async () => {
    const hook = vi.fn(() => Promise.resolve());
    const applier = createConsentApplier(buildDeps(GRANTED, { beforeLosingConsent: [hook] }));

    await applier(DECLINE_EVENT);

    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('runs no pre-persist hook for an accept from unasked', async () => {
    const hook = vi.fn(() => Promise.resolve());
    const applier = createConsentApplier(buildDeps(UNASKED, { beforeLosingConsent: [hook] }));

    await applier(ACCEPT_EVENT);

    expect(hook).not.toHaveBeenCalled();
  });

  it('runs no pre-persist hook for an accept from revoked', async () => {
    const hook = vi.fn(() => Promise.resolve());
    const applier = createConsentApplier(buildDeps(REVOKED, { beforeLosingConsent: [hook] }));

    await applier(ACCEPT_EVENT);

    expect(hook).not.toHaveBeenCalled();
  });

  it('runs no pre-persist hook for a decline from unasked', async () => {
    const hook = vi.fn(() => Promise.resolve());
    const applier = createConsentApplier(buildDeps(UNASKED, { beforeLosingConsent: [hook] }));

    await applier(DECLINE_EVENT);

    expect(hook).not.toHaveBeenCalled();
  });

  it('runs no pre-persist hook when a stored record only claims granted, since isGranted already rejected it', async () => {
    const hook = vi.fn(() => Promise.resolve());
    const applier = createConsentApplier(buildDeps(STALE_GRANT, { beforeLosingConsent: [hook] }));

    await applier(REVOKE_EVENT);

    expect(hook).not.toHaveBeenCalled();
  });

  it('runs multiple pre-persist hooks sequentially in order, each awaited before the next starts', async () => {
    const order: string[] = [];
    const first = vi.fn(async () => {
      order.push('first-start');
      await Promise.resolve();
      order.push('first-end');
    });
    const second = vi.fn(async () => {
      order.push('second-start');
      await Promise.resolve();
      order.push('second-end');
    });
    const applier = createConsentApplier(buildDeps(GRANTED, { beforeLosingConsent: [first, second] }));

    await applier(REVOKE_EVENT);

    expect(order).toEqual(['first-start', 'first-end', 'second-start', 'second-end']);
  });

  it('runs afterApplied hooks after the write, in order, with the persisted record', async () => {
    const order: string[] = [];
    const write = vi.fn(() => {
      order.push('write');
    });
    const first = vi.fn((next: ConsentRecord) => {
      order.push(`first:${next.decision}`);
    });
    const second = vi.fn((next: ConsentRecord) => {
      order.push(`second:${next.decision}`);
    });
    const applier = createConsentApplier(buildDeps(UNASKED, { write, afterApplied: [first, second] }));

    await applier(ACCEPT_EVENT);

    expect(order).toEqual(['write', 'first:granted', 'second:granted']);
  });

  it('persists the transition and reports the error through onError when a pre-persist hook rejects', async () => {
    const failure = new Error('teardown boom');
    const hook = vi.fn(() => Promise.reject(failure));
    const write = vi.fn();
    const onError = vi.fn();
    const applier = createConsentApplier(buildDeps(GRANTED, { beforeLosingConsent: [hook], write, onError }));

    await applier(REVOKE_EVENT);

    expect(write).toHaveBeenCalledWith({ decision: 'revoked', textVersion: CONSENT_TEXT_VERSION });
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it('returns the record that was written', async () => {
    const applier = createConsentApplier(buildDeps(UNASKED));

    const result = await applier(ACCEPT_EVENT);

    expect(result).toEqual({
      decision: 'granted',
      grantedAt: GRANTED_AT,
      textVersion: CONSENT_TEXT_VERSION,
      textLocale: LOCALE,
    });
  });
});
