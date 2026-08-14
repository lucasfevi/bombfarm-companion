import { describe, expect, it } from 'vitest';
import { normalizeAccount } from '@/shared/lib/account-shared';

/**
 * `maxPhase` normalize coverage — absent / out of range /
 * non-integer / valid; `null` round-trips as `null`; a record without the field at all
 * round-trips unchanged (the pre-feature legacy-load proof `normalizeAccount`'s fixed-field
 * rebuild depends on).
 */
describe('normalizeAccount maxPhase (persist half)', () => {
  it('a record with no maxPhase field at all normalizes to null', () => {
    const account = normalizeAccount({});
    expect(account.maxPhase).toBeNull();
  });

  it('undefined normalizes to null', () => {
    const account = normalizeAccount({ maxPhase: undefined });
    expect(account.maxPhase).toBeNull();
  });

  it('an explicit null round-trips as null', () => {
    const account = normalizeAccount({ maxPhase: null });
    expect(account.maxPhase).toBeNull();
  });

  it('a valid in-range integer round-trips unchanged', () => {
    const account = normalizeAccount({ maxPhase: 42 });
    expect(account.maxPhase).toBe(42);
  });

  it('a non-integer is rounded', () => {
    const account = normalizeAccount({ maxPhase: 42.6 });
    expect(account.maxPhase).toBe(43);
  });

  it('below 1 clamps to 1', () => {
    const account = normalizeAccount({ maxPhase: 0 });
    expect(account.maxPhase).toBe(1);
    const negative = normalizeAccount({ maxPhase: -5 });
    expect(negative.maxPhase).toBe(1);
  });

  it('above 600 clamps to 600', () => {
    const account = normalizeAccount({ maxPhase: 9999 });
    expect(account.maxPhase).toBe(600);
  });

  it('NaN / Infinity normalize to null (not finite)', () => {
    expect(normalizeAccount({ maxPhase: Number.NaN }).maxPhase).toBeNull();
    expect(normalizeAccount({ maxPhase: Number.POSITIVE_INFINITY }).maxPhase).toBeNull();
  });

  it('calling normalizeAccount with no raw argument at all (fresh default) yields null', () => {
    expect(normalizeAccount().maxPhase).toBeNull();
    expect(normalizeAccount(null).maxPhase).toBeNull();
  });
});
