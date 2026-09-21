import { describe, expect, it } from 'vitest';
import { createWriterLock } from './writer-lock.js';

describe('createWriterLock', () => {
  it('starts unheld, acquires for its owner, and reports the holder', () => {
    const lock = createWriterLock();
    expect(lock.holder).toBeNull();
    expect(lock.acquire('forge')).toBe(true);
    expect(lock.holder).toBe('forge');
  });

  it('refuses a second acquire while held, by any owner, including the same one', () => {
    const lock = createWriterLock();
    lock.acquire('forge');
    expect(lock.acquire('apply')).toBe(false);
    expect(lock.acquire('forge')).toBe(false);
    expect(lock.holder).toBe('forge');
  });

  it('release by a non-holder is a no-op', () => {
    const lock = createWriterLock();
    lock.acquire('forge');
    lock.release('apply');
    expect(lock.holder).toBe('forge');
  });

  it('release by the holder clears it, and a fresh acquire then works', () => {
    const lock = createWriterLock();
    lock.acquire('forge');
    lock.release('forge');
    expect(lock.holder).toBeNull();
    expect(lock.acquire('apply')).toBe(true);
    expect(lock.holder).toBe('apply');
  });
});
