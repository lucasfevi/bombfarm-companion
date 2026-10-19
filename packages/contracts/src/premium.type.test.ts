import { describe, expect, it } from 'vitest';
import { signedOutPremiumView, type PremiumView } from './premium.js';

type Forbidden = 'token' | 'code' | 'verifier' | 'state' | 'url';
type NoForbiddenKeys<T> = Extract<keyof T, Forbidden> extends never ? true : never;

const premiumViewHasNoSecretKeys: NoForbiddenKeys<PremiumView> = true;

describe('the premium view carries no secret', () => {
  it('has no key named token, code, verifier, state or url', () => {
    expect(premiumViewHasNoSecretKeys).toBe(true);
    for (const key of Object.keys(signedOutPremiumView)) {
      expect(['token', 'code', 'verifier', 'state', 'url']).not.toContain(key);
    }
  });

  it('would fail to compile if a token key were added', () => {
    // @ts-expect-error a PremiumView with a token key is not assignable to the guard
    const guarded: NoForbiddenKeys<PremiumView & { token: string }> = true;
    expect(guarded).toBe(true);
  });
});
