import { CONSENT_TEXT_VERSION, initialConsent, type ConsentRecord } from '@bombfarm/game-api';
import { describe, expect, it, vi } from 'vitest';
import { createGrantedGameIdentityReader } from './granted-game-identity.js';

const IDENTITY = { accountId: 'account-fixture-4410', steamId64: '76561198012345678' };
const ACCOUNT = { id: IDENTITY.accountId, name: 'Some Player' };
const noAccount = () => null;

const GRANTED: ConsentRecord = {
  decision: 'granted',
  textVersion: CONSENT_TEXT_VERSION,
  grantedAt: '2026-10-01T00:00:00.000Z',
};

describe('the game identity behind the consent', () => {
  it('reads the identity with the granted record', () => {
    const readIdentity = vi.fn(() => IDENTITY);
    const read = createGrantedGameIdentityReader({ readConsent: () => GRANTED, readIdentity, readAccount: noAccount });

    expect(read()).toEqual({ ...IDENTITY, playerName: null });
    expect(readIdentity).toHaveBeenCalledWith(GRANTED);
  });

  it.each([
    ['unasked', initialConsent()],
    ['declined', { ...GRANTED, decision: 'declined' }],
    ['revoked', { ...GRANTED, decision: 'revoked' }],
    ['granted without a grant time', { decision: 'granted', textVersion: CONSENT_TEXT_VERSION }],
    ['granted under an older disclosure text', { ...GRANTED, textVersion: CONSENT_TEXT_VERSION - 1 }],
  ] as [string, ConsentRecord][])('answers null and reads nothing when consent is %s', (_name, record) => {
    const readIdentity = vi.fn(() => IDENTITY);
    const readAccount = vi.fn(() => ACCOUNT);
    const read = createGrantedGameIdentityReader({ readConsent: () => record, readIdentity, readAccount });

    expect(read()).toBeNull();
    expect(readIdentity).not.toHaveBeenCalled();
    expect(readAccount).not.toHaveBeenCalled();
  });

  it('follows the consent as it changes', () => {
    let current: ConsentRecord = GRANTED;
    const read = createGrantedGameIdentityReader({
      readConsent: () => current,
      readIdentity: () => IDENTITY,
      readAccount: noAccount,
    });

    expect(read()).toEqual({ ...IDENTITY, playerName: null });
    current = { ...GRANTED, decision: 'revoked' };
    expect(read()).toBeNull();
  });

  it('passes on a null identity when the session file cannot be read', () => {
    const readAccount = vi.fn(() => ACCOUNT);
    const read = createGrantedGameIdentityReader({ readConsent: () => GRANTED, readIdentity: () => null, readAccount });

    expect(read()).toBeNull();
    expect(readAccount).not.toHaveBeenCalled();
  });
});

describe('the player name beside the identity', () => {
  it('carries the name of the account the session file names', () => {
    const read = createGrantedGameIdentityReader({
      readConsent: () => GRANTED,
      readIdentity: () => IDENTITY,
      readAccount: () => ACCOUNT,
    });

    expect(read()).toEqual({ ...IDENTITY, playerName: 'Some Player' });
  });

  it('drops the name when the account read belongs to another game account', () => {
    const read = createGrantedGameIdentityReader({
      readConsent: () => GRANTED,
      readIdentity: () => IDENTITY,
      readAccount: () => ({ id: 'account-fixture-9921', name: 'Someone Else' }),
    });

    expect(read()).toEqual({ ...IDENTITY, playerName: null });
  });

  it('answers a null name when the account read has none', () => {
    const read = createGrantedGameIdentityReader({
      readConsent: () => GRANTED,
      readIdentity: () => IDENTITY,
      readAccount: () => ({ id: IDENTITY.accountId, name: null }),
    });

    expect(read()).toEqual({ ...IDENTITY, playerName: null });
  });
});
