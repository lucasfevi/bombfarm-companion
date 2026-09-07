import { describe, expect, it } from 'vitest';
import { ConsentedSessionRequiredError, SessionToken, grantSession, type ConsentedSession } from './session.js';
import { grantedConsent } from './test-fixtures.js';
import {
  WriteNotEnabledError,
  grantWriteSession,
  isWriteSession,
  type WriteSession,
} from './write-session.js';

const GRANTED = grantedConsent('2026-09-03T12:00:00.000Z');
const consented = grantSession(GRANTED, { accountId: '486', token: SessionToken.create('sentinel-write-session') });

function forgeConsentedSession(): ConsentedSession {
  return {
    accountId: '486',
    token: SessionToken.create('forged'),
    grantedAt: '2026-09-03T12:00:00.000Z',
  } as unknown as ConsentedSession;
}

describe('grantWriteSession — the only constructor', () => {
  it('mints a write session when the switch is on, carrying the consented session it came from', () => {
    const write = grantWriteSession(consented, { forgeWritesEnabled: true });
    expect(isWriteSession(write)).toBe(true);
    expect(write.session).toBe(consented);
  });

  it('throws WriteNotEnabledError when the switch is off', () => {
    expect(() => grantWriteSession(consented, { forgeWritesEnabled: false })).toThrow(WriteNotEnabledError);
  });

  it('treats a non-boolean switch value reaching it at runtime as off', () => {
    const settings = { forgeWritesEnabled: 'yes' } as unknown as { forgeWritesEnabled: boolean };
    expect(() => grantWriteSession(consented, settings)).toThrow(WriteNotEnabledError);
  });

  it('throws ConsentedSessionRequiredError for a consented session forged through an unsafe cast, even with the switch on', () => {
    expect(() => grantWriteSession(forgeConsentedSession(), { forgeWritesEnabled: true })).toThrow(
      ConsentedSessionRequiredError,
    );
  });
});

describe('isWriteSession — the runtime half of the brand', () => {
  it('rejects a plain object carrying the same fields', () => {
    const forged = { session: consented } as unknown as WriteSession;
    expect(isWriteSession(forged)).toBe(false);
  });

  it('rejects a spread copy of a real write session — the private field does not survive a spread', () => {
    const real = grantWriteSession(consented, { forgeWritesEnabled: true });
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
    const copied = { ...real } as unknown as WriteSession;
    expect(isWriteSession(copied)).toBe(false);
  });

  it('rejects null, primitives and a consented session on its own', () => {
    expect(isWriteSession(null)).toBe(false);
    expect(isWriteSession('write')).toBe(false);
    expect(isWriteSession(consented)).toBe(false);
  });

  it('exposes no brand through Object.keys or getOwnPropertySymbols', () => {
    const real = grantWriteSession(consented, { forgeWritesEnabled: true });
    expect(Object.keys(real)).toEqual(['session']);
    expect(Object.getOwnPropertySymbols(real)).toEqual([]);
  });
});
