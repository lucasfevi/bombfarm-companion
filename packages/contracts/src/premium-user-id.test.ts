import { describe, expect, it } from 'vitest';
import { readPremiumMeAudience, readPremiumMeBody, readPremiumUserId } from './premium.js';

const ME_BODY = { v: 1, signInMethods: ['discord'], steamVerified: true, gameAccountLinked: false, admitted: true };

describe('readPremiumUserId', () => {
  it('reads the user id from the account answer', () => {
    expect(readPremiumUserId({ ...ME_BODY, userId: 'u-1' })).toBe('u-1');
  });

  it.each([
    ['missing', ME_BODY],
    ['empty', { ...ME_BODY, userId: '' }],
    ['a number', { ...ME_BODY, userId: 7 }],
    ['null', { ...ME_BODY, userId: null }],
    ['not an object', 'u-1'],
    ['an array', ['u-1']],
  ])('is null when the id is %s', (_name, body) => {
    expect(readPremiumUserId(body)).toBeNull();
  });

  it('leaves the account view without the id', () => {
    expect(readPremiumMeBody({ ...ME_BODY, userId: 'u-1' })).not.toHaveProperty('userId');
  });
});

describe('readPremiumMeAudience', () => {
  it.each(['owner', 'tester', 'public'])('keeps %s', (audience) => {
    expect(readPremiumMeAudience({ ...ME_BODY, audience })).toBe(audience);
  });

  it.each([
    ['missing', ME_BODY],
    ['unknown', { ...ME_BODY, audience: 'admin' }],
    ['a number', { ...ME_BODY, audience: 1 }],
    ['not an object', 'owner'],
  ])('is null when the audience is %s', (_name, body) => {
    expect(readPremiumMeAudience(body)).toBeNull();
  });

  it('leaves the account view without the audience', () => {
    expect(readPremiumMeBody({ ...ME_BODY, audience: 'owner' })).not.toHaveProperty('audience');
  });
});
