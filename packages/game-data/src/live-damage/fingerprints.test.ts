import { describe, expect, it } from 'vitest';
import { createFingerprintBook, FUSE_TOLERANCE } from './fingerprints.js';

const present = (...ids: string[]) => new Set(ids);

describe('fingerprint book', () => {
  it('matches two fuse totals that differ by 1e-9', () => {
    const book = createFingerprintBook();
    book.seed('a', 1.5);
    expect(book.resolve(1.5 + 1e-9, present('a'))).toEqual({ kind: 'unique', heroId: 'a' });
  });

  it('does not match two fuse totals that differ by 1e-3', () => {
    const book = createFingerprintBook();
    book.seed('a', 1.5);
    expect(book.resolve(1.5 + 1e-3, present('a'))).toEqual({ kind: 'unknown' });
  });

  it('declares its tolerance as 1e-6', () => {
    expect(FUSE_TOLERANCE).toBe(1e-6);
  });

  it('resolves a seed alone to its hero', () => {
    const book = createFingerprintBook();
    book.seed('a', 1.2);
    book.seed('b', 1.4);
    expect(book.resolve(1.4, present('a', 'b'))).toEqual({ kind: 'unique', heroId: 'b' });
  });

  it('lets a learned value override the same hero seed', () => {
    const book = createFingerprintBook();
    book.seed('a', 1.2);
    book.learn('a', 1.3);
    book.learn('a', 1.3);
    expect(book.resolve(1.3, present('a'))).toEqual({ kind: 'unique', heroId: 'a' });
    expect(book.resolve(1.2, present('a'))).toEqual({ kind: 'unknown' });
  });

  it('does not overwrite a learned value on a single contradicting observation', () => {
    const book = createFingerprintBook();
    book.learn('a', 1.3);
    book.learn('a', 0.9);
    expect(book.fuseOf('a')).toBe(1.3);
  });

  it('drops a pending observation when the established value is seen again', () => {
    const book = createFingerprintBook();
    book.learn('a', 1.3);
    book.learn('a', 0.9);
    book.learn('a', 1.3);
    book.learn('a', 0.9);
    expect(book.fuseOf('a')).toBe(1.3);
  });

  it('overwrites a learned value once the same new value is seen twice in a row', () => {
    const book = createFingerprintBook();
    book.learn('a', 1.3);
    book.learn('a', 0.9);
    book.learn('a', 0.9);
    expect(book.fuseOf('a')).toBe(0.9);
  });

  it('clears a stale learned value when the seed moves beyond tolerance', () => {
    const book = createFingerprintBook();
    book.seed('a', 1.2);
    book.learn('a', 1.3);
    book.learn('a', 1.3);
    book.seed('a', 0.4);
    expect(book.fuseOf('a')).toBe(0.4);
    expect(book.resolve(0.4, present('a'))).toEqual({ kind: 'unique', heroId: 'a' });
  });

  it('keeps a learned value when the seed is re-sent unchanged', () => {
    const book = createFingerprintBook();
    book.seed('a', 1.2);
    book.learn('a', 1.3);
    book.learn('a', 1.3);
    book.seed('a', 1.2 + 1e-9);
    expect(book.fuseOf('a')).toBe(1.3);
  });

  it('remembers a hero radius until cleared', () => {
    const book = createFingerprintBook();
    expect(book.radiusOf('a')).toBeUndefined();
    book.learnRadius('a', 3);
    expect(book.radiusOf('a')).toBe(3);
    book.clear();
    expect(book.radiusOf('a')).toBeUndefined();
  });

  it('reports two heroes with identical seeds as shared', () => {
    const book = createFingerprintBook();
    book.seed('a', 1.2);
    book.seed('b', 1.2);
    expect(book.resolve(1.2, present('a', 'b'))).toEqual({ kind: 'shared' });
  });

  it('reports a fuse learned for two heroes as shared and no longer decisive alone', () => {
    const book = createFingerprintBook();
    book.learn('a', 1.1);
    expect(book.resolve(1.1, present('a', 'b'))).toEqual({ kind: 'unique', heroId: 'a' });
    book.learn('b', 1.1);
    expect(book.resolve(1.1, present('a', 'b'))).toEqual({ kind: 'shared' });
  });

  it('becomes unique again when only one of the sharing heroes is present', () => {
    const book = createFingerprintBook();
    book.learn('a', 1.1);
    book.learn('b', 1.1);
    expect(book.resolve(1.1, present('b'))).toEqual({ kind: 'unique', heroId: 'b' });
  });

  it('never returns a hero that is absent from the present set, even when its fuse matches', () => {
    const book = createFingerprintBook();
    book.seed('away', 1.2);
    book.learn('away', 1.2);
    expect(book.resolve(1.2, present('other'))).toEqual({ kind: 'unknown' });
    expect(book.resolve(1.2, present())).toEqual({ kind: 'unknown' });
  });

  it('answers unknown when no present hero is within tolerance', () => {
    const book = createFingerprintBook();
    book.seed('a', 1.2);
    expect(book.resolve(1.9, present('a'))).toEqual({ kind: 'unknown' });
  });

  it('answers unknown for an empty book', () => {
    expect(createFingerprintBook().resolve(1.2, present('a'))).toEqual({ kind: 'unknown' });
  });

  it('returns a disagreement when the learned fuse differs from the seed beyond tolerance', () => {
    const book = createFingerprintBook();
    book.seed('a', 1.2);
    book.learn('a', 1.3);
    expect(book.learn('a', 1.3)).toEqual({ heroId: 'a', seeded: 1.2, learned: 1.3 });
  });

  it('returns the disagreement only once per hero', () => {
    const book = createFingerprintBook();
    book.seed('a', 1.2);
    book.learn('a', 1.3);
    expect(book.learn('a', 1.3)).not.toBeNull();
    expect(book.learn('a', 1.3)).toBeNull();
    expect(book.learn('a', 1.4)).toBeNull();
  });

  it('returns no disagreement when the learned fuse is within tolerance of the seed', () => {
    const book = createFingerprintBook();
    book.seed('a', 1.2);
    expect(book.learn('a', 1.2 + 1e-9)).toBeNull();
  });

  it('returns no disagreement for a hero that has no seed', () => {
    expect(createFingerprintBook().learn('a', 1.2)).toBeNull();
  });

  it('reports a disagreement for each hero separately', () => {
    const book = createFingerprintBook();
    book.seed('a', 1.2);
    book.seed('b', 1.2);
    book.learn('a', 1.3);
    book.learn('b', 1.3);
    expect(book.learn('a', 1.3)?.heroId).toBe('a');
    expect(book.learn('b', 1.3)?.heroId).toBe('b');
  });

  it('forgets seeds, learned values and reported disagreements on clear', () => {
    const book = createFingerprintBook();
    book.seed('a', 1.2);
    book.learn('a', 1.3);
    book.learn('a', 1.3);
    book.seed('b', 1.5);
    book.clear();
    expect(book.resolve(1.3, present('a', 'b'))).toEqual({ kind: 'unknown' });
    expect(book.resolve(1.5, present('a', 'b'))).toEqual({ kind: 'unknown' });
    book.seed('a', 1.2);
    book.learn('a', 1.3);
    expect(book.learn('a', 1.3)).toEqual({ heroId: 'a', seeded: 1.2, learned: 1.3 });
  });
});
