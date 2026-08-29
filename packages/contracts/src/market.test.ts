import { describe, expect, it } from 'vitest';
import {
  MARKET_QUOTE_CURRENCY,
  emptyMarketSnapshotView,
  isMarketQuoteTarget,
  type MarketQuoteResult,
} from './market.js';

describe('isMarketQuoteTarget', () => {
  it('accepts a key target', () => {
    expect(isMarketQuoteTarget({ kind: 'key', key: 'ember_luva#2' })).toBe(true);
  });

  it('accepts a hash-name target', () => {
    expect(isMarketQuoteTarget({ kind: 'hashName', hashName: 'Gold Gloves (Legendary)' })).toBe(true);
  });

  it('rejects an empty identity, which would quote nothing', () => {
    expect(isMarketQuoteTarget({ kind: 'key', key: '' })).toBe(false);
    expect(isMarketQuoteTarget({ kind: 'hashName', hashName: '' })).toBe(false);
  });

  it('rejects a target whose identity is the wrong field for its kind', () => {
    expect(isMarketQuoteTarget({ kind: 'key', hashName: 'Gold Gloves (Legendary)' })).toBe(false);
    expect(isMarketQuoteTarget({ kind: 'hashName', key: 'ember_luva#2' })).toBe(false);
  });

  it('rejects anything that is not a target at all', () => {
    for (const value of [null, undefined, 'ember_luva#2', 7, [], {}, { kind: 'defId', defId: 'x' }]) {
      expect(isMarketQuoteTarget(value)).toBe(false);
    }
  });
});

describe('market snapshot view', () => {
  it('starts with nothing adopted and no error to report', () => {
    expect(emptyMarketSnapshotView()).toEqual({
      snapshot: null,
      source: 'none',
      publishedUtc: null,
      adoptedUtc: null,
      checkedUtc: null,
      lastError: null,
    });
  });
});

describe('market quote result', () => {
  it('carries the price it kept when a refresh fails, so a caller can say what is still standing', () => {
    const failure: MarketQuoteResult = {
      ok: false,
      key: 'ember_luva#2',
      hashName: 'Gold Gloves (Legendary)',
      reason: 'not-quoted',
      keptAmount: 25,
      at: '2026-08-29T00:00:00.000Z',
    };
    expect(failure.ok).toBe(false);
    expect(failure.keptAmount).toBe(25);
  });

  it('quotes in one currency', () => {
    expect(MARKET_QUOTE_CURRENCY).toBe('BRL');
  });
});
