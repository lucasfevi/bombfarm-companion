import { describe, expect, it } from 'vitest';
import { readPremiumMeBody, readPremiumUserId } from './premium.js';

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
